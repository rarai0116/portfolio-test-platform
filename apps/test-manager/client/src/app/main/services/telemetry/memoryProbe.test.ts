import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  appendFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  getAppMetrics: vi.fn(() => []),
  getAllWindows: vi.fn(() => []),
  ipcOn: vi.fn(),
  ipcRemoveListener: vi.fn(),
  beep: vi.fn(),
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    default: {
      ...actual,
      appendFileSync: mocks.appendFileSync,
      mkdirSync: mocks.mkdirSync,
    },
    appendFileSync: mocks.appendFileSync,
    mkdirSync: mocks.mkdirSync,
  };
});
vi.mock('electron', () => ({
  app: { getAppMetrics: mocks.getAppMetrics },
  BrowserWindow: { getAllWindows: mocks.getAllWindows },
  ipcMain: {
    on: mocks.ipcOn,
    removeListener: mocks.ipcRemoveListener,
  },
  shell: { beep: mocks.beep },
}));

import {
  classifyMeasurementWindow,
  MemoryProbe,
  resolveMemoryProbeShortcutLabel,
} from './memoryProbe';

describe('memory probe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MEMORY_PROBE;
    delete process.env.MEMORY_PROBE_OUTPUT_DIR;
  });

  afterEach(() => {
    delete process.env.MEMORY_PROBE;
    delete process.env.MEMORY_PROBE_OUTPUT_DIR;
  });

  it('classifies the PDF output preview separately', () => {
    expect(
      classifyMeasurementWindow(
        'http://127.0.0.1/createPdfPreviewWindow?slot=mock',
      ),
    ).toBe('preview');
    expect(classifyMeasurementWindow('http://127.0.0.1/')).toBe('main');
  });

  it('does not register IPC or write files when disabled', () => {
    const probe = new MemoryProbe(false);
    probe.start();
    probe.mark('S0');
    probe.stop();

    expect(mocks.mkdirSync).not.toHaveBeenCalled();
    expect(mocks.ipcOn).not.toHaveBeenCalled();
    expect(mocks.appendFileSync).not.toHaveBeenCalled();
  });

  it('resolves shifted number shortcuts from their physical key code', () => {
    expect(
      resolveMemoryProbeShortcutLabel({
        type: 'keyDown',
        control: true,
        alt: true,
        shift: true,
        key: '!',
        code: 'Digit1',
        isAutoRepeat: false,
      } as never),
    ).toBe('S1');
    expect(
      resolveMemoryProbeShortcutLabel({
        type: 'keyDown',
        control: true,
        alt: true,
        shift: true,
        key: 'End',
        code: 'Numpad1',
        isAutoRepeat: false,
      } as never),
    ).toBe('S1');
  });

  it('falls back to JIS and US shifted key values for nonstandard codes', () => {
    expect(
      resolveMemoryProbeShortcutLabel({
        type: 'keyDown',
        control: true,
        alt: true,
        shift: true,
        key: '!',
        code: 'Unidentified',
        isAutoRepeat: false,
      } as never),
    ).toBe('S1');
    expect(
      resolveMemoryProbeShortcutLabel({
        type: 'keyDown',
        control: true,
        alt: true,
        shift: true,
        key: '"',
        code: '',
        isAutoRepeat: false,
      } as never),
    ).toBe('S2');
    expect(
      resolveMemoryProbeShortcutLabel({
        type: 'keyDown',
        control: true,
        alt: true,
        shift: true,
        key: '@',
        code: 'Unidentified',
        isAutoRepeat: false,
      } as never),
    ).toBe('S2');
  });

  it('rejects auto-repeat and unrelated physical keys', () => {
    expect(
      resolveMemoryProbeShortcutLabel({
        type: 'keyDown',
        control: true,
        alt: true,
        shift: true,
        key: '!',
        code: 'Digit1',
        isAutoRepeat: true,
      } as never),
    ).toBeNull();
    expect(
      resolveMemoryProbeShortcutLabel({
        type: 'keyDown',
        control: true,
        alt: true,
        shift: true,
        key: '!',
        code: 'Digit5',
        isAutoRepeat: false,
      } as never),
    ).toBeNull();
  });

  it('writes samples and flushes a shortcut mark before stopping', async () => {
    process.env.MEMORY_PROBE = '1';
    process.env.MEMORY_PROBE_OUTPUT_DIR = path.resolve(
      'measurement',
      'attempt',
    );
    let inputListener:
      | ((event: { preventDefault: () => void }, input: object) => void)
      | undefined;
    const webContents = {
      on: vi.fn(
        (
          _channel: string,
          listener: (
            event: { preventDefault: () => void },
            input: object,
          ) => void,
        ) => {
          inputListener = listener;
        },
      ),
    };
    const window = {
      webContents,
      isDestroyed: vi.fn(() => false),
      setTitle: vi.fn(),
    };
    const probe = new MemoryProbe(true);
    probe.start();
    probe.attachWindow(window as never);
    const event = { preventDefault: vi.fn() };
    inputListener?.(event, {
      type: 'keyDown',
      control: true,
      alt: true,
      shift: true,
      key: '"',
      code: 'Digit2',
      isAutoRepeat: false,
    });
    inputListener?.(event, {
      type: 'rawKeyDown',
      control: true,
      alt: true,
      shift: true,
      key: '"',
      code: 'Digit2',
      isAutoRepeat: false,
    });
    await Promise.resolve();
    probe.stop();

    expect(mocks.ipcOn).toHaveBeenCalledOnce();
    expect(event.preventDefault).toHaveBeenCalledTimes(2);
    const written = mocks.appendFileSync.mock.calls
      .map((call) => String(call[1]))
      .join('');
    expect(written).toContain('"kind":"start"');
    expect(written).toContain('"kind":"sample"');
    expect(written).toContain('"kind":"mark"');
    expect(written).toContain('"label":"S2"');
    expect(written.match(/"kind":"mark"/g)).toHaveLength(1);
    expect(mocks.beep).toHaveBeenCalledOnce();
    expect(window.setTitle).toHaveBeenCalledWith('【計測マーク S2 記録済み】');
    expect(written).toContain('"kind":"stop"');
    expect(mocks.ipcRemoveListener).toHaveBeenCalledOnce();
  });
});
