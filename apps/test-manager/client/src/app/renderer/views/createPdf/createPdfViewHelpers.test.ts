/**
 * CreatePdfView の静的ヘルパー関数のテスト
 * applyInitialSnapshot / saveDraftToFile の動作を検証する
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── モック（インポートより前に宣言する必要がある） ──────────────────────────

// CSS/スタイルのインポートを無効化
vi.mock('dockview-react/dist/styles/dockview.css', () => ({}));

// dockview-react: DockviewReact コンポーネントをダミーに
vi.mock('dockview-react', () => ({
  DockviewReact: vi.fn(() => null),
  themeLightSpaced: {},
}));

// react-router
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useLocation: vi.fn(() => ({ pathname: '/createPdf/exam', state: null })),
    useNavigate: vi.fn(() => vi.fn()),
  };
});

// UI コンポーネント
vi.mock('@parts/basicDialog', () => ({ default: vi.fn(() => null) }));

// テンプレート群
vi.mock('@views/createPdf/templates/examPanel', () => ({
  default: vi.fn(() => null),
}));
vi.mock('@views/createPdf/templates/workbookPanel', () => ({
  default: vi.fn(() => null),
}));
vi.mock('@views/createPdf/templates/testTablePanel', () => ({
  default: vi.fn(() => null),
}));
vi.mock('@views/createPdf/templates/tempExamPanel', () => ({
  default: vi.fn(() => null),
}));
vi.mock('@views/createPdf/templates/tempWorkbookPanel', () => ({
  default: vi.fn(() => null),
}));

// hooks
vi.mock('@views/createPdf/hooks/useCreatePdfDockviewPanelManager', () => ({
  default: vi.fn(() => ({
    defaultPanelOptions: {},
    addPanelWithPosition: vi.fn(),
    closePanel: vi.fn(),
    isPanelOpen: vi.fn(() => false),
  })),
}));
vi.mock('@views/createPdf/hooks/useSyncCreatePdfTestData', () => ({
  default: vi.fn(),
}));

// IPC bridge
vi.mock('@renderer/api/pdfPreviewBridge', () => ({
  commitCreatePdfPreviewDocument: vi.fn().mockResolvedValue(undefined),
  readCreatePdfPreviewDocument: vi.fn().mockResolvedValue({ ok: false }),
}));
vi.mock('@renderer/api/createPdfExportBridge', () => ({
  getCreatePdfPreviewWindowStatus: vi.fn().mockResolvedValue({ ok: false }),
  loadConditionJson: vi.fn(),
  openCreatePdfPreviewWindow: vi.fn(),
}));

// Zustand stores ─────────────────────────────────────────────────────────────

vi.mock('@views/createPdf/store/useCreatePdfResourceStore', () => {
  const store = {
    getState: vi.fn(() => ({
      testData: {
        maps: { byNo: new Map(), byId: new Map(), byUuid: new Map() },
      },
      actions: { reset: vi.fn() },
    })),
    subscribe: vi.fn(() => () => {}),
    setState: vi.fn(),
  };
  return { default: store };
});

vi.mock('@views/createPdf/store/useWorkbookDraftStore', () => {
  const store = {
    getState: vi.fn(() => ({
      basic: { grade: 1 as const, title: '' },
      stepTwo: {
        workbookMode: 'qaa' as const,
        categoryTable: [],
        difficulty: {
          isEnabled: false,
          ratios: [50, 50] as [number, number],
          isCalculated: false,
          entityCount: [0, 0, 0] as [number, number, number],
          settableDifficultyRanges: null,
        },
        options: {
          excludedTagIds: [],
          excludePastExam: false,
          excludeOriginal: false,
          isShuffleChoices: false,
          shuffleSeed: null,
        },
      },
      stepThree: {
        selectedOutputFolder: null,
        includeCover: true,
        excludeMiddleCover: false,
        saveConditionJson: true,
      },
    })),
    subscribe: vi.fn(() => () => {}),
    setState: vi.fn(),
  };
  return { default: store };
});

vi.mock('@views/createPdf/store/useExamDraftStore', () => {
  const store = {
    getState: vi.fn(() => ({
      basic: { grade: 1 as const, title: '' },
      stepTwo: {
        options: {
          excludedTagIds: [],
          excludePastExam: false,
          excludeOriginal: false,
          isShuffleChoices: false,
          shuffleSeed: null,
        },
        difficulty: {
          isEnabled: false,
          ratios: [50, 50] as [number, number],
          isCalculated: false,
          entityCount: [0, 0, 0] as [number, number, number],
          settableDifficultyRanges: null,
        },
        categoryTable: [],
      },
      stepThree: {
        selectedOutputFolder: null,
        includeCover: true,
        excludeMiddleCover: false,
        saveConditionJson: true,
      },
    })),
    subscribe: vi.fn(() => () => {}),
    setState: vi.fn(),
  };
  return { default: store };
});

vi.mock('@views/createPdf/store/useTestTableStore', () => {
  const store = {
    getState: vi.fn(() => ({
      sections: [],
      sectionMode: 'single' as const,
      settings: { showQaaChoiceIndex: false },
      lastAppliedDrawConditionKey: null,
      lastSavedOrRestoredTableKey: null,
    })),
    subscribe: vi.fn(() => () => {}),
    setState: vi.fn(),
  };
  return { default: store };
});

vi.mock(
  '@views/createPdf/store/useCreatePdfViewStore',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@views/createPdf/store/useCreatePdfViewStore')
      >();
    const store = Object.assign(vi.fn(), {
      getState: vi.fn(() => ({
        actions: { clearDirty: vi.fn(), setCreationType: vi.fn() },
      })),
      subscribe: vi.fn(() => () => {}),
      setState: vi.fn(),
    });
    return { ...actual, default: store };
  },
);

vi.mock('@views/createPdf/store/useCreatePdfDockviewStore', () => {
  const store = {
    getState: vi.fn(() => ({})),
    subscribe: vi.fn(() => () => {}),
    setState: vi.fn(),
  };
  return { default: store };
});

vi.mock('@views/createPdf/store/createPdfPreviewOrderStore', () => ({
  createPdfPreviewOrderStore: {
    getSnapshot: vi.fn(() => ({ sessionId: 0, sessionScope: null })),
    subscribe: vi.fn(() => () => {}),
  },
}));

// ── テスト対象のインポート ───────────────────────────────────────────────────

import { commitCreatePdfPreviewDocument } from '@renderer/api/pdfPreviewBridge';
import {
  applyInitialSnapshot,
  resolveRestoreSlotKey,
  saveDraftToFile,
} from './index';

// ── applyInitialSnapshot ─────────────────────────────────────────────────────

describe('applyInitialSnapshot', () => {
  it('exam モードで applySnapshotFn が1回呼ばれる', () => {
    const applyFn = vi.fn();
    applyInitialSnapshot('exam', null, applyFn);
    expect(applyFn).toHaveBeenCalledOnce();
  });

  it('exam モードで applySnapshotFn に渡される第1引数が exam になる', () => {
    const applyFn = vi.fn();
    applyInitialSnapshot('exam', null, applyFn);
    const [mode] = applyFn.mock.calls[0];
    expect(mode).toBe('exam');
  });

  it('workbook モードで applySnapshotFn に渡される第1引数が workbook になる', () => {
    const applyFn = vi.fn();
    applyInitialSnapshot('workbook', null, applyFn);
    const [mode] = applyFn.mock.calls[0];
    expect(mode).toBe('workbook');
  });

  it('applySnapshotFn に渡される第2引数は非null のスナップショットである', () => {
    const applyFn = vi.fn();
    applyInitialSnapshot('exam', null, applyFn);
    const [, snapshot] = applyFn.mock.calls[0];
    expect(snapshot).not.toBeNull();
  });
});

// ── resolveRestoreSlotKey ────────────────────────────────────────────────────

describe('resolveRestoreSlotKey', () => {
  const restoreState = { version: 1 } as never;

  it('lastActiveSlotKey の restoreState が存在する場合は lastActive を優先する', () => {
    const result = resolveRestoreSlotKey(
      {
        'grade:1:workbookMode:qaa': { restoreState },
        'grade:2:workbookMode:multipleChoice': { restoreState },
      },
      'grade:2:workbookMode:multipleChoice',
      'grade:1:workbookMode:qaa',
    );

    expect(result).toBe('grade:2:workbookMode:multipleChoice');
  });

  it('lastActiveSlotKey が存在しない場合は fallback を返す', () => {
    const result = resolveRestoreSlotKey(
      {
        'grade:1:workbookMode:qaa': { restoreState },
      },
      undefined,
      'grade:1:workbookMode:qaa',
    );

    expect(result).toBe('grade:1:workbookMode:qaa');
  });

  it('lastActiveSlotKey が壊れている場合は fallback を返す', () => {
    const result = resolveRestoreSlotKey(
      {
        'grade:1:workbookMode:qaa': { restoreState },
      },
      'grade:2:workbookMode:multipleChoice',
      'grade:1:workbookMode:qaa',
    );

    expect(result).toBe('grade:1:workbookMode:qaa');
  });

  it('lastActiveSlotKey の restoreState が null の場合は fallback を返す', () => {
    const result = resolveRestoreSlotKey(
      {
        'grade:1:workbookMode:qaa': { restoreState },
        'grade:2:workbookMode:multipleChoice': { restoreState: null },
      },
      'grade:2:workbookMode:multipleChoice',
      'grade:1:workbookMode:qaa',
    );

    expect(result).toBe('grade:1:workbookMode:qaa');
  });
});

// ── saveDraftToFile ──────────────────────────────────────────────────────────

describe('saveDraftToFile', () => {
  beforeEach(() => {
    vi.mocked(commitCreatePdfPreviewDocument).mockClear();
  });

  it('mode が null の場合は IPC を呼ばない', () => {
    const pendingRef = { current: null };
    const hasRestoredRef = { current: true };
    saveDraftToFile(null, pendingRef, hasRestoredRef);
    expect(commitCreatePdfPreviewDocument).not.toHaveBeenCalled();
  });

  it('hasRestoredRef.current が false の場合は IPC を呼ばない', () => {
    const pendingRef = { current: null };
    // false = restore が未完了（スキップされた）
    const hasRestoredRef = { current: false };
    saveDraftToFile('exam', pendingRef, hasRestoredRef);
    expect(commitCreatePdfPreviewDocument).not.toHaveBeenCalled();
  });

  it('exam モードで hasRestoredRef.current が true の場合は commitCreatePdfPreviewDocument を呼ぶ', () => {
    const pendingRef = { current: null };
    const hasRestoredRef = { current: true };
    saveDraftToFile('exam', pendingRef, hasRestoredRef);
    expect(commitCreatePdfPreviewDocument).toHaveBeenCalledOnce();
    const [arg] = vi.mocked(commitCreatePdfPreviewDocument).mock.calls[0];
    expect(arg.creationType).toBe('exam');
  });

  it('workbook モードで hasRestoredRef.current が true の場合は commitCreatePdfPreviewDocument を呼ぶ', () => {
    const pendingRef = { current: null };
    const hasRestoredRef = { current: true };
    saveDraftToFile('workbook', pendingRef, hasRestoredRef);
    expect(commitCreatePdfPreviewDocument).toHaveBeenCalledOnce();
    const [arg] = vi.mocked(commitCreatePdfPreviewDocument).mock.calls[0];
    expect(arg.creationType).toBe('workbook');
  });
});
