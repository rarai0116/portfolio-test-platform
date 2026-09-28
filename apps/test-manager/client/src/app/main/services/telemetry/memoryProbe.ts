import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  MemoryProbeChannels,
  type MemoryProbeLabel,
} from '@shared/types/memoryProbe';
import {
  app,
  BrowserWindow,
  type Event,
  type Input,
  ipcMain,
  type ProcessMetric,
  shell,
} from 'electron';

const SAMPLE_INTERVAL_MS = 5_000;
const OUTPUT_FILE_NAME = 'memory-probe.jsonl';
const VALID_LABELS = new Set<MemoryProbeLabel>(['S0', 'S1', 'S2', 'S3', 'S4']);
const SHORTCUT_LABEL_BY_KEY: Readonly<Record<string, MemoryProbeLabel>> = {
  '0': 'S0',
  ')': 'S0',
  '1': 'S1',
  '!': 'S1',
  '2': 'S2',
  '@': 'S2',
  '"': 'S2',
  '3': 'S3',
  '#': 'S3',
  '4': 'S4',
  $: 'S4',
};

type JsonRecord = Record<string, unknown> & {
  kind: string;
  timestamp: string;
};

class JsonlSink {
  private readonly pending: string[] = [];

  constructor(private readonly filePath: string) {}

  write(record: JsonRecord): void {
    this.pending.push(`${JSON.stringify(record)}\n`);
    this.flushSync();
  }

  flushSync(): void {
    if (this.pending.length === 0) return;
    const content = this.pending.join('');
    appendFileSync(this.filePath, content, 'utf8');
    this.pending.splice(0, this.pending.length);
  }
}

function finiteOrNull(value: number | undefined): number | null {
  return Number.isFinite(value) ? (value ?? null) : null;
}

export function classifyMeasurementWindow(url: string): 'main' | 'preview' {
  return url.includes('createPdfPreviewWindow') ? 'preview' : 'main';
}

function processSnapshot(metric: ProcessMetric): Record<string, unknown> {
  return {
    pid: metric.pid,
    type: metric.type,
    name: metric.name ?? null,
    serviceName: metric.serviceName ?? null,
    workingSetSizeKb: finiteOrNull(metric.memory.workingSetSize),
    peakWorkingSetSizeKb: finiteOrNull(metric.memory.peakWorkingSetSize),
  };
}

function isMeasurementLabel(value: unknown): value is MemoryProbeLabel {
  return (
    typeof value === 'string' && VALID_LABELS.has(value as MemoryProbeLabel)
  );
}

export function resolveMemoryProbeShortcutLabel(
  input: Input,
): MemoryProbeLabel | null {
  if (
    (input.type !== 'keyDown' && input.type !== 'rawKeyDown') ||
    input.isAutoRepeat ||
    !input.control ||
    !input.alt ||
    !input.shift
  ) {
    return null;
  }

  // 通常は配列に左右されない物理キーを使う。Electron が標準外の code を
  // 返す入力環境だけ、JIS/US の Shift 後の key 表現で補完する。
  const physicalDigit = /^(?:Digit|Numpad)([0-9])$/.exec(input.code);
  if (physicalDigit) {
    return Number(physicalDigit[1]) <= 4
      ? (`S${physicalDigit[1]}` as MemoryProbeLabel)
      : null;
  }
  return SHORTCUT_LABEL_BY_KEY[input.key] ?? null;
}

export class MemoryProbe {
  private readonly attachedWindows = new WeakSet<BrowserWindow>();
  private interval: NodeJS.Timeout | undefined;
  private sink: JsonlSink | undefined;
  private started = false;
  private sampling = false;

  constructor(
    private readonly enabled: boolean = process.env.MEMORY_PROBE === '1',
  ) {}

  private readonly ipcListener = (
    _event: Electron.IpcMainEvent,
    label: unknown,
  ) => {
    if (isMeasurementLabel(label)) this.mark(label);
  };

  start(): void {
    if (!this.enabled || this.started) return;

    const outputDir = process.env.MEMORY_PROBE_OUTPUT_DIR;
    if (!outputDir || !path.isAbsolute(outputDir)) {
      throw new Error(
        'MEMORY_PROBE_OUTPUT_DIR must be an absolute path in measurement mode.',
      );
    }

    mkdirSync(outputDir, { recursive: true });
    this.sink = new JsonlSink(path.join(outputDir, OUTPUT_FILE_NAME));
    this.started = true;
    ipcMain.on(MemoryProbeChannels.mark, this.ipcListener);
    this.write({
      kind: 'start',
      timestamp: new Date().toISOString(),
      phase: process.env.MEMORY_PROBE_PHASE ?? null,
      run: process.env.MEMORY_PROBE_RUN ?? null,
      commit: process.env.MEMORY_PROBE_COMMIT ?? null,
      electronVersion: process.versions.electron ?? null,
      chromeVersion: process.versions.chrome ?? null,
      nodeVersion: process.versions.node,
    });
    void this.sample();
    this.interval = setInterval(() => void this.sample(), SAMPLE_INTERVAL_MS);
  }

  attachWindow(window: BrowserWindow): void {
    if (!this.enabled || this.attachedWindows.has(window)) return;
    this.attachedWindows.add(window);
    const pressedCodes = new Set<string>();
    window.webContents.on(
      'before-input-event',
      (event: Event, input: Input) => {
        if (input.type === 'keyUp') {
          pressedCodes.delete(input.code);
          return;
        }

        const label = resolveMemoryProbeShortcutLabel(input);
        if (label === null) return;

        event.preventDefault();
        if (pressedCodes.has(input.code)) return;
        pressedCodes.add(input.code);
        if (this.mark(label)) {
          this.showMarkFeedback(window, label);
        }
      },
    );
  }

  mark(label: MemoryProbeLabel): boolean {
    if (!this.started || !isMeasurementLabel(label)) return false;
    return this.write({
      kind: 'mark',
      timestamp: new Date().toISOString(),
      label,
    });
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    if (this.interval) clearInterval(this.interval);
    this.interval = undefined;
    ipcMain.removeListener(MemoryProbeChannels.mark, this.ipcListener);
    this.write({ kind: 'stop', timestamp: new Date().toISOString() });
    this.sink?.flushSync();
  }

  private async sample(): Promise<void> {
    if (!this.started || this.sampling) return;
    this.sampling = true;
    try {
      const windows = await Promise.all(
        BrowserWindow.getAllWindows().map(async (window) => {
          let url = '';
          let usedJsHeapBytes: number | null = null;
          try {
            if (window.isDestroyed() || window.webContents.isDestroyed()) {
              return {
                id: window.id,
                windowKind: 'main',
                url: null,
                usedJsHeapBytes: null,
              };
            }
            url = window.webContents.getURL();
            if (!window.webContents.isLoading()) {
              const measured = await window.webContents.executeJavaScript(
                "typeof performance.memory?.usedJSHeapSize === 'number' ? performance.memory.usedJSHeapSize : null",
                true,
              );
              usedJsHeapBytes =
                typeof measured === 'number' && Number.isFinite(measured)
                  ? measured
                  : null;
            }
          } catch {
            usedJsHeapBytes = null;
          }
          return {
            id: window.id,
            windowKind: classifyMeasurementWindow(url),
            url: url || null,
            usedJsHeapBytes,
          };
        }),
      );
      if (!this.started) return;
      this.write({
        kind: 'sample',
        timestamp: new Date().toISOString(),
        processes: app.getAppMetrics().map(processSnapshot),
        windows,
      });
    } catch (error) {
      if (!this.started) return;
      this.write({
        kind: 'error',
        timestamp: new Date().toISOString(),
        operation: 'sample',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.sampling = false;
    }
  }

  private showMarkFeedback(
    window: BrowserWindow,
    label: MemoryProbeLabel,
  ): void {
    console.info(`[memory-probe] recorded ${label}`);
    try {
      shell.beep();
      if (!window.isDestroyed()) {
        window.setTitle(`【計測マーク ${label} 記録済み】`);
      }
    } catch (error) {
      console.warn('Failed to show memory probe mark feedback:', error);
    }
  }

  private write(record: JsonRecord): boolean {
    try {
      this.sink?.write(record);
      return this.sink !== undefined;
    } catch (error) {
      console.error('Failed to write memory probe record:', error);
      return false;
    }
  }
}

export const memoryProbe = new MemoryProbe();
