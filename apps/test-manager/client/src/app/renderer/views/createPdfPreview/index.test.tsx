import type { AssetReadyNotice } from '@shared/types/assets';
import type {
  CreatePdfPersistedDocument,
  CreatePdfPreviewReadResult,
  CreatePdfPreviewUpdatedEvent,
  CreationType,
} from '@shared/types/pdfPreview';
import { buildSlotKey } from '@shared/types/pdfPreview';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fullRenderPreviewMock, viewerTemplate } = vi.hoisted(() => ({
  fullRenderPreviewMock: vi.fn(async (..._args: unknown[]) => {}),
  viewerTemplate: `<!doctype html>
<html>
  <head><style>body { margin: 0; }</style></head>
  <body>
    <div id="title-container"></div>
    <div id="question-container"></div>
    <div id="answer-container"></div>
    <div id="tmp-question-container"></div>
    <div id="tmp-answer-container"></div>
  </body>
</html>`,
}));

vi.mock('@templates/preview/layout/fullRenderPreview', () => ({
  fullRenderPreview: fullRenderPreviewMock,
}));

vi.mock('@views/testDataEditor/templates/previewRenderShared', () => ({
  ensureKatexFontStyle: vi.fn(),
  ensureKatexOverrideStyle: vi.fn(),
  ensureKatexStyle: vi.fn(),
}));

vi.mock('@templates/preview/viewer.html?raw', () => ({
  default: viewerTemplate,
}));

vi.mock('@templates/preview/viewer-exam.html?raw', () => ({
  default: viewerTemplate,
}));

type AssetReadyHandler = (item: AssetReadyNotice) => void;

const slotKey = buildSlotKey({ grade: 1, workbookMode: 'qaa' });

let CreatePdfPreviewWindowView: typeof import('./index')['default'];

const defer = <T,>() => {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
};

const getPreviewHost = () => {
  const host = document.querySelector(
    '[data-create-pdf-preview-host]',
  ) as HTMLElement | null;
  if (!host) {
    throw new Error('preview host missing');
  }
  return host;
};

const buildDocument = (revision = 7): CreatePdfPersistedDocument => ({
  schemaVersion: 1,
  creationType: 'workbook',
  revision,
  updatedAt: '2026-05-10T00:00:00.000Z',
  slots: {
    [slotKey]: {
      scope: {
        grade: 1,
        workbookMode: 'qaa',
      },
      restoreState: {
        version: 1,
        creationType: 'workbook',
        gradeId: 1,
        title: 'Preview Workbook',
        createdAt: '2026-05-10T00:00:00.000Z',
        shuffleSeed: null,
        mode: 'qaa',
        excludedTagIds: [],
        excludePastExam: false,
        excludeOriginal: false,
        isChoiceShuffle: false,
        difficulty: { isEnabled: false, ratios: [34, 33] },
        conditions: [],
        table: [],
      },
      previewSnapshot: {
        schemaVersion: 1,
        creationType: 'workbook',
        workbookMode: 'qaa',
        grade: 1,
        title: 'Preview Workbook',
        layout: {
          pageSize: 'A4',
          hasCover: true,
          hasSubCategoryHeading: false,
        },
        items: [
          {
            itemId: 'item-1',
            sourceNo: 1,
            sourceKind: 'existing',
            questionHtml: '<p><img alt="image-1" /></p>',
            answerHtml: '',
          },
        ],
        imageRefs: [
          {
            grade: 'firstGrade',
            key: 'image-1',
            width: 120,
            height: 80,
          },
          {
            grade: 'firstGrade',
            key: 'unused-image',
            width: 90,
            height: 60,
          },
        ],
        generatedAt: '2026-05-10T00:00:00.000Z',
      },
      updatedAt: '2026-05-10T00:00:00.000Z',
    },
  },
});

describe('CreatePdfPreviewWindowView', () => {
  let assetReadyHandler: AssetReadyHandler | null = null;
  let readMock: ReturnType<typeof vi.fn>;
  let requestMock: ReturnType<typeof vi.fn>;
  let requestPreviewUpdateMock: ReturnType<typeof vi.fn>;
  let updatedHandler: ((event: CreatePdfPreviewUpdatedEvent) => void) | null =
    null;

  beforeEach(async () => {
    vi.resetModules();
    fullRenderPreviewMock.mockReset();
    fullRenderPreviewMock.mockImplementation(async (..._args: unknown[]) => {});
    assetReadyHandler = null;
    updatedHandler = null;
    readMock = vi.fn(
      async (
        _creationType: CreationType,
      ): Promise<CreatePdfPreviewReadResult> => ({
        ok: true as const,
        document: buildDocument(),
      }),
    );
    requestMock = vi.fn(async () => ({
      ok: true as const,
      ready: [],
      pending: [
        {
          grade: 'firstGrade' as const,
          key: 'image-1',
        },
      ],
    }));
    requestPreviewUpdateMock = vi.fn(async () => ({ ok: true as const }));

    window.pdfPreview = {
      commit: vi.fn(),
      refresh: vi.fn(),
      notifyPatch: vi.fn(),
      read: readMock as Window['pdfPreview']['read'],
      onUpdated: vi.fn((handler) => {
        updatedHandler = handler;
        return () => {
          updatedHandler = null;
        };
      }),
      onPatch: vi.fn(() => () => {}),
    };

    window.assets = {
      request: requestMock as Window['assets']['request'],
      onReady: vi.fn((handler: AssetReadyHandler) => {
        assetReadyHandler = handler;
        return () => {
          assetReadyHandler = null;
        };
      }),
    } as unknown as Window['assets'];

    window.createPdfExport = {
      openPreviewWindow: vi.fn(),
      closePreviewWindow: vi.fn(),
      getPreviewWindowStatus: vi.fn(),
      requestPreviewUpdate:
        requestPreviewUpdateMock as Window['createPdfExport']['requestPreviewUpdate'],
      selectOutputDirectory: vi.fn(),
      exportPdf: vi.fn(),
      loadConditionJson: vi.fn(),
      onPreviewWindowClosed: vi.fn(() => () => {}),
      onPreviewUpdateRequested: vi.fn(() => () => {}),
    } as unknown as Window['createPdfExport'];

    ({ default: CreatePdfPreviewWindowView } = await import('./index'));
  });

  it('relevant な画像が ready になったとき再描画せず DOM 画像を差し替える', async () => {
    fullRenderPreviewMock.mockImplementation(async (...args: unknown[]) => {
      const root = args[1];
      const doc = root as Document;
      const questionContainer = doc.getElementById('question-container');
      if (questionContainer) {
        questionContainer.innerHTML =
          '<p><img alt="image-1" src="dummy-before" width="120" height="80" /></p>';
      }
    });

    render(
      <MemoryRouter
        initialEntries={[
          `/createPdfPreviewWindow?creationType=workbook&slotKey=${slotKey}`,
        ]}
      >
        <Routes>
          <Route
            path="/createPdfPreviewWindow"
            element={<CreatePdfPreviewWindowView />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fullRenderPreviewMock).toHaveBeenCalledTimes(1);
    });
    expect(getPreviewHost().style.visibility).toBe('visible');
    expect(readMock).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledWith([
      {
        grade: 'firstGrade',
        key: 'image-1',
      },
    ]);

    const initialRenderCall = fullRenderPreviewMock.mock.calls[0] as
      | unknown[]
      | undefined;
    if (!initialRenderCall) {
      throw new Error('initial render call missing');
    }
    const initialImages = initialRenderCall[2] as {
      [key: string]: { base64: string };
    };
    expect(initialImages['image-1'].base64).not.toBe('ready-base64');
    expect(document.querySelector('img')?.getAttribute('src')).toBe(
      'dummy-before',
    );

    act(() => {
      assetReadyHandler?.({
        grade: 'firstGrade',
        key: 'image-1',
        version: 'md5READY',
        contentType: 'image/png',
      });
    });

    await waitFor(() => {
      expect(document.querySelector('img')?.getAttribute('src')).toBe(
        'demo-asset://images/firstGrade/image-1.png?v=md5READY',
      );
    });
    expect(fullRenderPreviewMock).toHaveBeenCalledTimes(1);
    expect(readMock).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('irrelevant な画像 ready では再描画しない', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          `/createPdfPreviewWindow?creationType=workbook&slotKey=${slotKey}`,
        ]}
      >
        <Routes>
          <Route
            path="/createPdfPreviewWindow"
            element={<CreatePdfPreviewWindowView />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fullRenderPreviewMock).toHaveBeenCalledTimes(1);
    });
    expect(readMock).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledTimes(1);

    act(() => {
      assetReadyHandler?.({
        grade: 'firstGrade',
        key: 'unused-image',
        version: 'md5IGNORED',
        contentType: 'image/png',
      });
    });

    await waitFor(() => {
      expect(fullRenderPreviewMock).toHaveBeenCalledTimes(1);
    });
    expect(readMock).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('render 中の更新は pending として保持し、完了後に最新 render へ追従する', async () => {
    const firstRender = defer<void>();
    const secondRender = defer<void>();
    let renderCallIndex = 0;
    fullRenderPreviewMock.mockImplementation(async () => {
      const current =
        renderCallIndex === 0
          ? firstRender
          : renderCallIndex === 1
            ? secondRender
            : null;
      renderCallIndex++;
      await current?.promise;
    });

    render(
      <MemoryRouter
        initialEntries={[
          `/createPdfPreviewWindow?creationType=workbook&slotKey=${slotKey}`,
        ]}
      >
        <Routes>
          <Route
            path="/createPdfPreviewWindow"
            element={<CreatePdfPreviewWindowView />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('レイアウトを整理しています')).toBeTruthy();
    expect(screen.getByText('4/5')).toBeTruthy();
    expect(getPreviewHost().style.visibility).toBe('hidden');

    act(() => {
      updatedHandler?.({
        creationType: 'workbook',
        slotKey,
        revision: 8,
        updatedAt: '2026-05-10T00:00:01.000Z',
      });
    });
    readMock.mockResolvedValue({
      ok: true as const,
      document: buildDocument(8),
    });

    expect(fullRenderPreviewMock).toHaveBeenCalledTimes(1);
    expect(
      document.querySelector('[data-create-pdf-preview-loading-overlay]'),
    ).toBeTruthy();

    await act(async () => {
      firstRender.resolve();
      await firstRender.promise;
    });

    await waitFor(() => {
      expect(fullRenderPreviewMock).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      secondRender.resolve();
      await secondRender.promise;
    });

    await waitFor(() => {
      expect(
        document.querySelector('[data-create-pdf-preview-loading-overlay]'),
      ).toBeNull();
    });
    expect(getPreviewHost().style.visibility).toBe('visible');
  });

  it('更新ボタン後の render ではプレビューウィンドウのローディングを再表示する', async () => {
    const secondRender = defer<void>();
    let renderCallIndex = 0;
    fullRenderPreviewMock.mockImplementation(async () => {
      renderCallIndex++;
      if (renderCallIndex === 2) {
        await secondRender.promise;
      }
    });

    render(
      <MemoryRouter
        initialEntries={[
          `/createPdfPreviewWindow?creationType=workbook&slotKey=${slotKey}`,
        ]}
      >
        <Routes>
          <Route
            path="/createPdfPreviewWindow"
            element={<CreatePdfPreviewWindowView />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fullRenderPreviewMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(
        document.querySelector('[data-create-pdf-preview-loading-overlay]'),
      ).toBeNull();
    });
    expect(getPreviewHost().style.visibility).toBe('visible');

    fireEvent.click(screen.getByRole('button', { name: '更新' }));

    act(() => {
      updatedHandler?.({
        creationType: 'workbook',
        slotKey,
        revision: 8,
        updatedAt: '2026-05-10T00:00:01.000Z',
      });
    });

    expect(await screen.findByText('レイアウトを整理しています')).toBeTruthy();
    expect(screen.getByText('4/5')).toBeTruthy();
    expect(getPreviewHost().style.visibility).toBe('hidden');

    await act(async () => {
      secondRender.resolve();
      await secondRender.promise;
    });

    await waitFor(() => {
      expect(
        document.querySelector('[data-create-pdf-preview-loading-overlay]'),
      ).toBeNull();
    });
    expect(getPreviewHost().style.visibility).toBe('visible');
  });

  it('初回完了後の自動 render 中もプレビュー本体を非表示にする', async () => {
    const secondRender = defer<void>();
    let renderCallIndex = 0;
    fullRenderPreviewMock.mockImplementation(async () => {
      renderCallIndex++;
      if (renderCallIndex === 2) {
        await secondRender.promise;
      }
    });

    render(
      <MemoryRouter
        initialEntries={[
          `/createPdfPreviewWindow?creationType=workbook&slotKey=${slotKey}`,
        ]}
      >
        <Routes>
          <Route
            path="/createPdfPreviewWindow"
            element={<CreatePdfPreviewWindowView />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fullRenderPreviewMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(getPreviewHost().style.visibility).toBe('visible');
    });

    readMock.mockResolvedValue({
      ok: true as const,
      document: buildDocument(8),
    });
    act(() => {
      updatedHandler?.({
        creationType: 'workbook',
        slotKey,
        revision: 8,
        updatedAt: '2026-05-10T00:00:01.000Z',
      });
    });

    await waitFor(() => {
      expect(fullRenderPreviewMock).toHaveBeenCalledTimes(2);
    });
    expect(getPreviewHost().style.visibility).toBe('hidden');
    expect(
      document.querySelector('[data-create-pdf-preview-loading-overlay]'),
    ).toBeNull();

    await act(async () => {
      secondRender.resolve();
      await secondRender.promise;
    });

    await waitFor(() => {
      expect(getPreviewHost().style.visibility).toBe('visible');
    });
  });

  it('自動更新 OFF では updated event による render を止め、ON に戻すと未反映更新を描画する', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          `/createPdfPreviewWindow?creationType=workbook&slotKey=${slotKey}`,
        ]}
      >
        <Routes>
          <Route
            path="/createPdfPreviewWindow"
            element={<CreatePdfPreviewWindowView />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fullRenderPreviewMock).toHaveBeenCalledTimes(1);
    });
    readMock.mockResolvedValue({
      ok: true as const,
      document: buildDocument(8),
    });

    const autoUpdateCheckbox = screen.getByRole('checkbox', {
      name: '自動更新を有効にする',
    }) as HTMLInputElement;
    expect(autoUpdateCheckbox.checked).toBe(true);

    fireEvent.click(autoUpdateCheckbox);
    expect(autoUpdateCheckbox.checked).toBe(false);

    act(() => {
      updatedHandler?.({
        creationType: 'workbook',
        slotKey,
        revision: 8,
        updatedAt: '2026-05-10T00:00:01.000Z',
      });
    });

    expect(await screen.findByText(/未反映の更新があります/)).toBeTruthy();
    expect(fullRenderPreviewMock).toHaveBeenCalledTimes(1);

    fireEvent.click(autoUpdateCheckbox);
    expect(autoUpdateCheckbox.checked).toBe(true);

    await waitFor(() => {
      expect(fullRenderPreviewMock).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.queryByText(/未反映の更新があります/)).toBeNull();
    });
  });

  it('自動更新 OFF でも更新ボタン後の対象 updated event は render し、未反映表示を消す', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          `/createPdfPreviewWindow?creationType=workbook&slotKey=${slotKey}`,
        ]}
      >
        <Routes>
          <Route
            path="/createPdfPreviewWindow"
            element={<CreatePdfPreviewWindowView />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fullRenderPreviewMock).toHaveBeenCalledTimes(1);
    });

    const autoUpdateCheckbox = screen.getByRole('checkbox', {
      name: '自動更新を有効にする',
    }) as HTMLInputElement;
    fireEvent.click(autoUpdateCheckbox);

    act(() => {
      updatedHandler?.({
        creationType: 'workbook',
        slotKey,
        revision: 8,
        updatedAt: '2026-05-10T00:00:01.000Z',
      });
    });

    expect(await screen.findByText(/未反映の更新があります/)).toBeTruthy();
    expect(fullRenderPreviewMock).toHaveBeenCalledTimes(1);

    readMock.mockResolvedValue({
      ok: true as const,
      document: buildDocument(9),
    });

    fireEvent.click(screen.getByRole('button', { name: '更新' }));
    act(() => {
      updatedHandler?.({
        creationType: 'workbook',
        slotKey,
        revision: 9,
        updatedAt: '2026-05-10T00:00:02.000Z',
      });
    });

    await waitFor(() => {
      expect(fullRenderPreviewMock).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.queryByText(/未反映の更新があります/)).toBeNull();
    });
    expect(requestPreviewUpdateMock).toHaveBeenCalledWith({
      creationType: 'workbook',
      slotKey,
    });
  });

  it('更新ボタンからプレビュー更新要求を送る', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          `/createPdfPreviewWindow?creationType=workbook&slotKey=${slotKey}`,
        ]}
      >
        <Routes>
          <Route
            path="/createPdfPreviewWindow"
            element={<CreatePdfPreviewWindowView />}
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: '更新' }));

    await waitFor(() => {
      expect(requestPreviewUpdateMock).toHaveBeenCalledWith({
        creationType: 'workbook',
        slotKey,
      });
    });
  });
});
