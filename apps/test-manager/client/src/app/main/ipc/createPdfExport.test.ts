import { mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let tmpDir: string;

const {
  handleMock,
  removeHandlerMock,
  fromWebContentsMock,
  openExternalMock,
  openPathMock,
  showOpenDialogMock,
  showMessageBoxMock,
  getRendererBaseUrlMock,
  attachWindowTelemetryMock,
  isSafeExternalUrlMock,
} = vi.hoisted(() => ({
  handleMock: vi.fn(),
  removeHandlerMock: vi.fn(),
  fromWebContentsMock: vi.fn(),
  openExternalMock: vi.fn(),
  openPathMock: vi.fn(),
  showOpenDialogMock: vi.fn(),
  showMessageBoxMock: vi.fn(),
  getRendererBaseUrlMock: vi.fn(() => 'http://localhost:5173'),
  attachWindowTelemetryMock: vi.fn(),
  isSafeExternalUrlMock: vi.fn(() => true),
}));

type EventHandler = (...args: unknown[]) => void;

class BrowserWindowMock {
  static instances: BrowserWindowMock[] = [];
  static getAllWindows = vi.fn(() => BrowserWindowMock.instances);
  static fromWebContents = fromWebContentsMock;

  private destroyed = false;
  private eventHandlers = new Map<string, EventHandler[]>();
  private onceHandlers = new Map<string, EventHandler[]>();
  loadedUrl = '';
  options: Record<string, unknown>;

  webContents = {
    getURL: vi.fn(() => this.loadedUrl),
    setWindowOpenHandler: vi.fn(),
    openDevTools: vi.fn(),
    executeJavaScript: vi.fn(),
    printToPDF: vi.fn(),
    send: vi.fn(),
    on: vi.fn(),
  };

  show = vi.fn();
  focus = vi.fn();
  loadURL = vi.fn(async (url: string) => {
    this.loadedUrl = url;
  });
  close = vi.fn(() => {
    this.destroyed = true;
    this.emit('closed');
  });
  isDestroyed = vi.fn(() => this.destroyed);

  constructor(options: Record<string, unknown>) {
    this.options = options;
    BrowserWindowMock.instances.push(this);
  }

  on(event: string, handler: EventHandler): this {
    const handlers = this.eventHandlers.get(event) ?? [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
    return this;
  }

  once(event: string, handler: EventHandler): this {
    const handlers = this.onceHandlers.get(event) ?? [];
    handlers.push(handler);
    this.onceHandlers.set(event, handlers);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    const handlers = this.eventHandlers.get(event) ?? [];
    for (const handler of handlers) {
      handler(...args);
    }

    const onceHandlers = this.onceHandlers.get(event) ?? [];
    this.onceHandlers.delete(event);
    for (const handler of onceHandlers) {
      handler(...args);
    }
  }
}

vi.mock('electron', () => ({
  BrowserWindow: BrowserWindowMock,
  dialog: {
    showOpenDialog: showOpenDialogMock,
    showMessageBox: showMessageBoxMock,
  },
  ipcMain: {
    handle: handleMock,
    removeHandler: removeHandlerMock,
  },
  shell: {
    openExternal: openExternalMock,
    // exportPdf は出力後に出力先フォルダを shell.openPath で開くためモックが必要
    openPath: openPathMock,
  },
}));

vi.mock('@main/services/rendererBase', () => ({
  getRendererBaseUrl: getRendererBaseUrlMock,
}));

vi.mock('@main/services/telemetry/windowMonitor', () => ({
  attachWindowTelemetry: attachWindowTelemetryMock,
}));

vi.mock('@main/services/externalUrl', () => ({
  isSafeExternalUrl: isSafeExternalUrlMock,
}));

beforeEach(async () => {
  tmpDir = join(tmpdir(), `createPdfExport-test-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });
  BrowserWindowMock.instances = [];
  handleMock.mockReset();
  removeHandlerMock.mockReset();
  fromWebContentsMock.mockReset();
  showOpenDialogMock.mockReset();
  showMessageBoxMock.mockReset();
  attachWindowTelemetryMock.mockReset();
  openExternalMock.mockReset();
  openPathMock.mockReset();
  getRendererBaseUrlMock.mockReturnValue('http://localhost:5173');
  isSafeExternalUrlMock.mockReturnValue(true);
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-24T01:02:03.000Z'));
});

afterEach(async () => {
  vi.useRealTimers();
  await rm(tmpDir, { recursive: true, force: true });
});

const setupHandlers = async () => {
  vi.resetModules();
  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>();

  const { ipcMain } = await import('electron');
  vi.mocked(ipcMain.handle).mockImplementation(
    (channel: string, cb: unknown) => {
      handlers.set(channel, cb as (...args: unknown[]) => Promise<unknown>);
    },
  );

  const { registerCreatePdfExportIpc } = await import('./createPdfExport');
  registerCreatePdfExportIpc();
  return handlers;
};

describe('registerCreatePdfExportIpc', () => {
  it('PreviewWindow を専用 entry の createPdfPreviewWindow ルートで開く', async () => {
    const handlers = await setupHandlers();
    const openHandler = handlers.get('createPdfExport:openPreviewWindow');
    if (!openHandler) {
      throw new Error('createPdfExport:openPreviewWindow handler is missing');
    }

    const ownerWindow = new BrowserWindowMock({});
    fromWebContentsMock.mockReturnValue(ownerWindow);

    const result = await openHandler(
      { sender: { id: 'sender' } },
      { creationType: 'workbook', slotKey: 'grade:1:workbookMode:qaa' },
    );

    expect(result).toEqual({ ok: true, reused: false });
    expect(BrowserWindowMock.instances).toHaveLength(2);
    expect(BrowserWindowMock.instances[1]?.loadURL).toHaveBeenCalledWith(
      'http://localhost:5173/createPdfPreviewWindow.html#/createPdfPreviewWindow?creationType=workbook&slotKey=grade%3A1%3AworkbookMode%3Aqaa',
    );
  });

  it('PreviewWindow からの更新要求を親ウィンドウへ転送する', async () => {
    const handlers = await setupHandlers();
    const openHandler = handlers.get('createPdfExport:openPreviewWindow');
    const requestUpdateHandler = handlers.get(
      'createPdfExport:requestPreviewUpdate',
    );
    if (!openHandler || !requestUpdateHandler) {
      throw new Error('createPdfExport handlers are missing');
    }

    const ownerWindow = new BrowserWindowMock({});
    fromWebContentsMock.mockReturnValue(ownerWindow);

    await openHandler(
      { sender: { id: 'sender' } },
      { creationType: 'workbook', slotKey: 'grade:1:workbookMode:qaa' },
    );

    const previewWindow = BrowserWindowMock.instances[1];
    if (!previewWindow) {
      throw new Error('preview window is missing');
    }

    const request = {
      creationType: 'workbook',
      slotKey: 'grade:1:workbookMode:qaa',
    };
    fromWebContentsMock.mockReturnValue(previewWindow);

    const result = await requestUpdateHandler(
      { sender: previewWindow.webContents },
      request,
    );

    expect(result).toEqual({ ok: true });
    expect(ownerWindow.webContents.send).toHaveBeenCalledWith(
      'createPdfExport:previewUpdateRequested',
      request,
    );
  });

  it('pagesRange なし unit は pageRanges なしで printToPDF する', async () => {
    const handlers = await setupHandlers();
    const openHandler = handlers.get('createPdfExport:openPreviewWindow');
    const exportHandler = handlers.get('createPdfExport:exportPdf');
    if (!openHandler || !exportHandler) {
      throw new Error('createPdfExport handlers are missing');
    }

    const ownerWindow = new BrowserWindowMock({});
    fromWebContentsMock.mockReturnValue(ownerWindow);

    await openHandler(
      { sender: { id: 'sender' } },
      { creationType: 'workbook', slotKey: 'grade:1:workbookMode:qaa' },
    );

    const previewWindow = BrowserWindowMock.instances[1];
    if (!previewWindow) {
      throw new Error('preview window is missing');
    }

    previewWindow.webContents.executeJavaScript.mockImplementation(
      async (script: string) => {
        if (script.includes('getStatus')) {
          return {
            isOpen: true,
            isReady: true,
            creationType: 'workbook',
            slotKey: 'grade:1:workbookMode:qaa',
            revision: 5,
            isRendering: false,
          };
        }

        if (script.includes('getManifest')) {
          return {
            ok: true,
            manifest: {
              creationType: 'workbook',
              slotKey: 'grade:1:workbookMode:qaa',
              revision: 5,
              title: '確認用タイトル',
              units: [
                {
                  unitId: 'workbook',
                  kind: 'workbook',
                  groupId: 'workbook',
                  fileName: '問題集_1級_一問一答_確認用タイトル.pdf',
                },
              ],
            },
          };
        }

        return null;
      },
    );
    previewWindow.webContents.printToPDF.mockResolvedValue(Buffer.from('pdf'));

    const result = await exportHandler(
      {},
      {
        creationType: 'workbook',
        slotKey: 'grade:1:workbookMode:qaa',
        expectedRevision: 5,
        outputDirectory: tmpDir,
        includeCover: true,
      },
    );

    expect(result).toMatchObject({ ok: true });
    expect(previewWindow.webContents.printToPDF).toHaveBeenCalledWith({
      printBackground: true,
      preferCSSPageSize: true,
      margins: { marginType: 'none' },
    });

    if (
      !result ||
      typeof result !== 'object' ||
      !('ok' in result) ||
      result.ok !== true ||
      !('files' in result) ||
      !Array.isArray(result.files)
    ) {
      throw new Error('export result should be ok:true');
    }

    const [outputFilePath] = result.files;
    if (!outputFilePath || typeof outputFilePath !== 'string') {
      throw new Error('exported file path is missing');
    }

    const written = await readFile(outputFilePath);
    expect(written.toString()).toBe('pdf');
  });

  it('pagesRange あり unit は pageRanges を組み立てる', async () => {
    const handlers = await setupHandlers();
    const openHandler = handlers.get('createPdfExport:openPreviewWindow');
    const exportHandler = handlers.get('createPdfExport:exportPdf');
    if (!openHandler || !exportHandler) {
      throw new Error('createPdfExport handlers are missing');
    }

    const ownerWindow = new BrowserWindowMock({});
    fromWebContentsMock.mockReturnValue(ownerWindow);

    await openHandler(
      { sender: { id: 'sender' } },
      { creationType: 'exam', slotKey: 'grade:1' },
    );

    const previewWindow = BrowserWindowMock.instances[1];
    if (!previewWindow) {
      throw new Error('preview window is missing');
    }

    previewWindow.webContents.executeJavaScript.mockImplementation(
      async (script: string) => {
        if (script.includes('getStatus')) {
          return {
            isOpen: true,
            isReady: true,
            creationType: 'exam',
            slotKey: 'grade:1',
            revision: 7,
            isRendering: false,
          };
        }

        if (script.includes('getManifest')) {
          return {
            ok: true,
            manifest: {
              creationType: 'exam',
              slotKey: 'grade:1',
              revision: 7,
              title: '模擬試験',
              units: [
                {
                  unitId: 'question-1',
                  kind: 'exam-question',
                  groupId: 'question-1',
                  fileName: '問題用紙_学科Ⅰ・II.pdf',
                  pagesRange: {
                    start: 2,
                    end: 5,
                  },
                },
              ],
            },
          };
        }

        return null;
      },
    );
    previewWindow.webContents.printToPDF.mockResolvedValue(Buffer.from('pdf'));

    const result = await exportHandler(
      {},
      {
        creationType: 'exam',
        slotKey: 'grade:1',
        expectedRevision: 7,
        outputDirectory: tmpDir,
        includeCover: true,
      },
    );

    expect(result).toMatchObject({ ok: true });
    expect(previewWindow.webContents.printToPDF).toHaveBeenCalledWith({
      printBackground: true,
      preferCSSPageSize: true,
      margins: { marginType: 'none' },
      pageRanges: '2-5',
    });
  });

  it('pagesRanges あり unit はカンマ区切りの pageRanges を組み立てる', async () => {
    const handlers = await setupHandlers();
    const openHandler = handlers.get('createPdfExport:openPreviewWindow');
    const exportHandler = handlers.get('createPdfExport:exportPdf');
    if (!openHandler || !exportHandler) {
      throw new Error('createPdfExport handlers are missing');
    }

    const ownerWindow = new BrowserWindowMock({});
    fromWebContentsMock.mockReturnValue(ownerWindow);

    await openHandler(
      { sender: { id: 'sender' } },
      { creationType: 'exam', slotKey: 'grade:1' },
    );

    const previewWindow = BrowserWindowMock.instances[1];
    if (!previewWindow) {
      throw new Error('preview window is missing');
    }

    previewWindow.webContents.executeJavaScript.mockImplementation(
      async (script: string) => {
        if (script.includes('getStatus')) {
          return {
            isOpen: true,
            isReady: true,
            creationType: 'exam',
            slotKey: 'grade:1',
            revision: 7,
            isRendering: false,
          };
        }

        if (script.includes('getManifest')) {
          expect(script).toContain('"includeCover":false');
          expect(script).toContain('"includeMiddleCover":false');
          return {
            ok: true,
            manifest: {
              creationType: 'exam',
              slotKey: 'grade:1',
              revision: 7,
              title: '模擬試験',
              units: [
                {
                  unitId: 'question-1',
                  kind: 'exam-question',
                  groupId: 'question-1',
                  fileName: '問題用紙_学科Ⅰ・II.pdf',
                  pagesRanges: [
                    { start: 3, end: 4 },
                    { start: 6, end: 6 },
                  ],
                },
              ],
            },
          };
        }

        return null;
      },
    );
    previewWindow.webContents.printToPDF.mockResolvedValue(Buffer.from('pdf'));

    const result = await exportHandler(
      {},
      {
        creationType: 'exam',
        slotKey: 'grade:1',
        expectedRevision: 7,
        outputDirectory: tmpDir,
        includeCover: false,
        includeMiddleCover: false,
      },
    );

    expect(result).toMatchObject({ ok: true });
    expect(previewWindow.webContents.printToPDF).toHaveBeenCalledWith({
      printBackground: true,
      preferCSSPageSize: true,
      margins: { marginType: 'none' },
      pageRanges: '3-4,6',
    });
  });

  it('conditionJson 指定時は出題条件.jsonを保存して files に含める', async () => {
    const handlers = await setupHandlers();
    const openHandler = handlers.get('createPdfExport:openPreviewWindow');
    const exportHandler = handlers.get('createPdfExport:exportPdf');
    if (!openHandler || !exportHandler) {
      throw new Error('createPdfExport handlers are missing');
    }

    const ownerWindow = new BrowserWindowMock({});
    fromWebContentsMock.mockReturnValue(ownerWindow);

    await openHandler(
      { sender: { id: 'sender' } },
      { creationType: 'workbook', slotKey: 'grade:1:workbookMode:qaa' },
    );

    const previewWindow = BrowserWindowMock.instances[1];
    if (!previewWindow) {
      throw new Error('preview window is missing');
    }

    previewWindow.webContents.executeJavaScript.mockImplementation(
      async (script: string) => {
        if (script.includes('getStatus')) {
          return {
            isOpen: true,
            isReady: true,
            creationType: 'workbook',
            slotKey: 'grade:1:workbookMode:qaa',
            revision: 5,
            isRendering: false,
          };
        }

        if (script.includes('getManifest')) {
          return {
            ok: true,
            manifest: {
              creationType: 'workbook',
              slotKey: 'grade:1:workbookMode:qaa',
              revision: 5,
              title: '確認用タイトル',
              units: [
                {
                  unitId: 'workbook',
                  kind: 'workbook',
                  groupId: 'workbook',
                  fileName: '問題集_1級_一問一答_確認用タイトル.pdf',
                },
              ],
            },
          };
        }

        return null;
      },
    );
    previewWindow.webContents.printToPDF.mockResolvedValue(Buffer.from('pdf'));

    const result = await exportHandler(
      {},
      {
        creationType: 'workbook',
        slotKey: 'grade:1:workbookMode:qaa',
        expectedRevision: 5,
        outputDirectory: tmpDir,
        includeCover: true,
        conditionJson: {
          version: 1,
          creationType: 'workbook',
          title: '確認用タイトル',
        },
      },
    );

    if (
      !result ||
      typeof result !== 'object' ||
      !('ok' in result) ||
      result.ok !== true ||
      !('files' in result) ||
      !Array.isArray(result.files)
    ) {
      throw new Error('export result should be ok:true');
    }

    const jsonPath = result.files.find((filePath) =>
      String(filePath).endsWith('出題条件.json'),
    );
    expect(jsonPath).toBeDefined();
    expect(await readFile(String(jsonPath), 'utf-8')).toContain(
      '"creationType": "workbook"',
    );
  });

  it('exam の複数 unit を順に PDF 出力する', async () => {
    const handlers = await setupHandlers();
    const openHandler = handlers.get('createPdfExport:openPreviewWindow');
    const exportHandler = handlers.get('createPdfExport:exportPdf');
    if (!openHandler || !exportHandler) {
      throw new Error('createPdfExport handlers are missing');
    }

    const ownerWindow = new BrowserWindowMock({});
    fromWebContentsMock.mockReturnValue(ownerWindow);

    await openHandler(
      { sender: { id: 'sender' } },
      { creationType: 'exam', slotKey: 'grade:1' },
    );

    const previewWindow = BrowserWindowMock.instances[1];
    if (!previewWindow) {
      throw new Error('preview window is missing');
    }

    let documentTitle = 'プレビュー';
    previewWindow.webContents.executeJavaScript.mockImplementation(
      async (script: string) => {
        if (script.includes('getStatus')) {
          return {
            isOpen: true,
            isReady: true,
            creationType: 'exam',
            slotKey: 'grade:1',
            revision: 8,
            isRendering: false,
          };
        }

        if (script.includes('getManifest')) {
          return {
            ok: true,
            manifest: {
              creationType: 'exam',
              slotKey: 'grade:1',
              revision: 8,
              title: '模擬試験',
              units: [
                {
                  unitId: 'question-booklet-1',
                  kind: 'exam-question',
                  groupId: 'question-booklet-1',
                  fileName: '問題用紙_学科Ⅰ・Ⅱ.pdf',
                  pagesRange: {
                    start: 1,
                    end: 4,
                  },
                },
                {
                  unitId: 'answer-booklet-学科Ⅰ',
                  kind: 'exam-answer',
                  groupId: 'answer-booklet-学科Ⅰ',
                  fileName: '解説用紙_学科Ⅰ（計画）.pdf',
                  pagesRange: {
                    start: 5,
                    end: 6,
                  },
                },
              ],
            },
          };
        }

        if (script.includes('document.title =')) {
          const previousTitle = documentTitle;
          const match = script.match(/document\.title = ("(?:\\.|[^"])*")/);
          if (match?.[1]) {
            documentTitle = JSON.parse(match[1]) as string;
          }
          return previousTitle;
        }

        return null;
      },
    );
    previewWindow.webContents.printToPDF
      .mockResolvedValueOnce(Buffer.from('question-pdf'))
      .mockResolvedValueOnce(Buffer.from('answer-pdf'));

    const result = await exportHandler(
      {},
      {
        creationType: 'exam',
        slotKey: 'grade:1',
        expectedRevision: 8,
        outputDirectory: tmpDir,
        includeCover: true,
      },
    );

    expect(result).toMatchObject({ ok: true });
    expect(previewWindow.webContents.printToPDF).toHaveBeenNthCalledWith(1, {
      printBackground: true,
      preferCSSPageSize: true,
      margins: { marginType: 'none' },
      pageRanges: '1-4',
    });
    expect(previewWindow.webContents.printToPDF).toHaveBeenNthCalledWith(2, {
      printBackground: true,
      preferCSSPageSize: true,
      margins: { marginType: 'none' },
      pageRanges: '5-6',
    });
    const titleScripts =
      previewWindow.webContents.executeJavaScript.mock.calls
        .map(([script]) => String(script))
        .filter((script) => script.includes('document.title ='));
    expect(titleScripts).toHaveLength(3);
    expect(titleScripts[0]).toContain('問題用紙_学科Ⅰ・Ⅱ');
    expect(titleScripts[1]).toContain('解説用紙_学科Ⅰ（計画）');
    expect(titleScripts[2]).toContain('プレビュー');

    if (
      !result ||
      typeof result !== 'object' ||
      !('ok' in result) ||
      result.ok !== true ||
      !('files' in result) ||
      !Array.isArray(result.files)
    ) {
      throw new Error('export result should be ok:true');
    }

    expect(result.files).toHaveLength(2);
  });
});
