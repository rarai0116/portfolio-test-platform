import {
  subscribeCreatePdfPreviewUpdated,
} from '@renderer/api/pdfPreviewBridge';
import type {
  CreatePdfPersistScope,
  CreatePdfPreviewCacheMeta,
  CreatePdfPreviewSnapshot,
  CreatePdfPreviewUpdatedEvent,
  CreatePdfWorkbookMode,
  CreationType,
} from '@shared/types/pdfPreview';
import type { CreatePdfPreviewIssue } from '@views/createPdf/types/viewState';

// --- slotKey パーサ ---

const VALID_WORKBOOK_MODES = new Set<string>([
  'qaa',
  'qaaAllTrue',
  'qaaAllFalse',
  'multipleChoice',
]);

type ParsedSlotKey = {
  gradeNumber: 1 | 2;
  grade: 'firstGrade' | 'secondGrade';
  workbookMode: CreatePdfWorkbookMode | null;
};

/**
 * buildSlotKey の逆変換。
 * `grade:1` / `grade:2:workbookMode:qaa` 等を解析して ParsedSlotKey を返す。
 * 正規パターンに一致しない場合は null を返す。
 */
export const parseSlotKey = (slotKey: string): ParsedSlotKey | null => {
  const simple = /^grade:(1|2)$/.exec(slotKey);
  if (simple) {
    const gradeNumber = Number(simple[1]) as 1 | 2;
    return {
      gradeNumber,
      grade: gradeNumber === 1 ? 'firstGrade' : 'secondGrade',
      workbookMode: null,
    };
  }

  const withMode = /^grade:(1|2):workbookMode:(.+)$/.exec(slotKey);
  if (withMode) {
    const gradeNumber = Number(withMode[1]) as 1 | 2;
    const mode = withMode[2];
    if (!VALID_WORKBOOK_MODES.has(mode)) return null;
    return {
      gradeNumber,
      grade: gradeNumber === 1 ? 'firstGrade' : 'secondGrade',
      workbookMode: mode as CreatePdfWorkbookMode,
    };
  }

  return null;
};

// --- snapshot 型 ---

/**
 * beginSession で確立するセッションスコープ。
 * slotKey を parseSlotKey で分解した値を含む。
 * controller が useCreatePdfViewStore の変化を監視して beginSession を呼ぶ。
 * previewPanel 自身は view store を直接参照しない。
 */
export type PreviewSessionScope = {
  creationType: CreationType;
  slotKey: string;
  gradeNumber: 1 | 2;
  grade: 'firstGrade' | 'secondGrade';
  workbookMode: CreatePdfWorkbookMode | null;
};

/**
 * useSyncExternalStore で外部から読む「表示すべき PDF プレビューの状態」。
 *
 * - sessionId / sessionScope    : スコープ識別（beginSession で確定）
 * - lastMeta                    : updated 通知から取得したメタ
 * - resolvedScope               : read 後に確定した slot.scope（grade 等を含む）
 * - requiredImageKeys           : read 後に確定した必要画像キー
 * - imageKeyToItemIds           : 同上。健全性判定・issue 管理用
 * - sessionIssues               : controller・command から設定する session 内 issue
 */
export type PreviewOrderSnapshot = {
  sessionId: string;
  sessionScope: PreviewSessionScope | null;
  lastMeta: CreatePdfPreviewCacheMeta | null;
  resolvedScope: CreatePdfPersistScope | null;
  previewSnapshot: CreatePdfPreviewSnapshot | null;
  requiredImageKeys: readonly string[];
  imageKeyToItemIds: Readonly<Record<string, readonly string[]>>;
  sessionIssues: readonly CreatePdfPreviewIssue[];
};

const INITIAL_SNAPSHOT: PreviewOrderSnapshot = {
  sessionId: '',
  sessionScope: null,
  lastMeta: null,
  resolvedScope: null,
  previewSnapshot: null,
  requiredImageKeys: [],
  imageKeyToItemIds: {},
  sessionIssues: [],
};

// --- store クラス ---

/**
 * createPdf preview の「表示すべき状態」を一括管理するクラス。
 * useSyncExternalStore の subscribe / getSnapshot を実装している。
 *
 * 責務:
 *   - IPC updated / patch 通知を受けて snapshot を更新する
 *   - controller からの mutation 呼び出しを session ガード付きで反映する
 *   - 実際の読み込み・描画・asset request 等の命令実行は持たない
 *
 * 購読者が存在するときだけ IPC イベントを購読し、全員が離脱したら解除する。
 */
class CreatePdfPreviewOrderStore {
  private current: PreviewOrderSnapshot = { ...INITIAL_SNAPSHOT };
  private listeners = new Set<() => void>();
  private unsubUpdated: (() => void) | null = null;
  private activeCreationType: CreationType | null = null;
  // patch フィルタの高速化用（snapshot.requiredImageKeys と常に同期）
  private requiredImageKeysSet = new Set<string>();

  // --- useSyncExternalStore API ---

  /**
   * React の useSyncExternalStore に渡す subscribe 関数。
   * 最初の購読者が現れたとき IPC イベントへの購読を開始する。
   */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      this.attachIpcSubscriptions();
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.detachIpcSubscriptions();
      }
    };
  };

  /**
   * React の useSyncExternalStore に渡す getSnapshot 関数。
   * snapshot オブジェクト自体はイミュータブル（毎回同一参照を返す）。
   */
  readonly getSnapshot = (): PreviewOrderSnapshot => this.current;

  // --- controller から呼ぶ mutation メソッド ---

  clearSession(): void {
    this.requiredImageKeysSet.clear();
    this.current = { ...INITIAL_SNAPSHOT };
    this.notify();
  }

  setActiveCreationType(creationType: CreationType | null): void {
    this.activeCreationType = creationType;
  }

  /**
   * 表示スコープが変わったとき（grade / creationType / workbookMode 切替）に呼ぶ。
   * sessionId は controller が生成して渡す。以降の mutation の陳腐化判定に使う。
   * slotKey が正規パターンでない場合は warning を出して何もしない。
   */
  beginSession(
    sessionId: string,
    creationType: CreationType,
    slotKey: string,
  ): void {
    if (!this.isActiveCreationType(creationType)) return;
    const parsed = parseSlotKey(slotKey);
    if (!parsed) {
      console.warn(
        `[createPdfPreviewOrderStore] beginSession: slotKey を解析できません: "${slotKey}"`,
      );
      return;
    }
    const scope: PreviewSessionScope = { creationType, slotKey, ...parsed };
    this.requiredImageKeysSet.clear();
    this.current = {
      ...INITIAL_SNAPSHOT,
      sessionId,
      sessionScope: scope,
    };
    this.notify();
  }

  /**
   * read 後に slot.scope（grade 等）が確定したときに呼ぶ。
   * panel / controller がここから assetGrade 等を導出できるようにする。
   */
  setResolvedScope(sessionId: string, scope: CreatePdfPersistScope): void {
    if (!this.guardSession(sessionId)) return;
    this.current = { ...this.current, resolvedScope: scope };
    this.notify();
  }

  /**
   * read 後に必要画像情報が確定したときに呼ぶ。
   */
  setRequiredImages(
    sessionId: string,
    requiredImageKeys: string[],
    imageKeyToItemIds: Record<string, string[]>,
  ): void {
    if (!this.guardSession(sessionId)) return;
    this.requiredImageKeysSet = new Set(requiredImageKeys);
    this.current = { ...this.current, requiredImageKeys, imageKeyToItemIds };
    this.notify();
  }

  /**
   * read した slot の previewSnapshot が確定したときに呼ぶ。
   * panel の render トリガーになる。
   */
  setPreviewSnapshot(
    sessionId: string,
    snapshot: CreatePdfPreviewSnapshot,
  ): void {
    if (!this.guardSession(sessionId)) return;
    this.current = { ...this.current, previewSnapshot: snapshot };
    this.notify();
  }

  /**
   * sessionIssues を全置換する。rendering / katex 等の静的 issue 管理に使う。
   */
  replaceSessionIssues(
    sessionId: string,
    issues: CreatePdfPreviewIssue[],
  ): void {
    if (!this.guardSession(sessionId)) return;
    this.current = { ...this.current, sessionIssues: issues };
    this.notify();
  }

  /**
   * 単一 issue を id 照合で upsert する。
   */
  upsertSessionIssue(sessionId: string, issue: CreatePdfPreviewIssue): void {
    if (!this.guardSession(sessionId)) return;
    const rest = this.current.sessionIssues.filter((i) => i.id !== issue.id);
    this.current = { ...this.current, sessionIssues: [...rest, issue] };
    this.notify();
  }

  /**
   * 単一 issue を id で削除する。
   */
  removeSessionIssue(sessionId: string, issueId: string): void {
    if (!this.guardSession(sessionId)) return;
    this.current = {
      ...this.current,
      sessionIssues: this.current.sessionIssues.filter((i) => i.id !== issueId),
    };
    this.notify();
  }


  // --- IPC イベントハンドラ ---

  private attachIpcSubscriptions(): void {
    this.unsubUpdated = subscribeCreatePdfPreviewUpdated(this.handleUpdated);
  }

  private detachIpcSubscriptions(): void {
    this.unsubUpdated?.();
    this.unsubUpdated = null;
  }

  private handleUpdated = (event: CreatePdfPreviewUpdatedEvent): void => {
    if (!this.isActiveCreationType(event.creationType)) return;
    const { sessionScope, lastMeta } = this.current;

    // slotKey が正規でない場合は処理しない
    const parsed = parseSlotKey(event.slotKey);
    if (!parsed) {
      console.warn(
        `[createPdfPreviewOrderStore] handleUpdated: slotKey を解析できません: "${event.slotKey}"`,
      );
      return;
    }

    // sessionScope が未確立、または別スコープ → IPC イベントを正本として自律確立
    if (
      !sessionScope ||
      event.creationType !== sessionScope.creationType ||
      event.slotKey !== sessionScope.slotKey
    ) {
      const sessionId = crypto?.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
      this.beginSession(sessionId, event.creationType, event.slotKey);
      if (this.current.sessionId === sessionId) {
        this.current = {
          ...this.current,
          lastMeta: {
            creationType: event.creationType,
            slotKey: event.slotKey,
            revision: event.revision,
            updatedAt: event.updatedAt,
          },
        };
        this.notify();
      }
      return;
    }

    // 同スコープで revision が古い場合は無視する
    if (lastMeta !== null && event.revision <= lastMeta.revision) {
      return;
    }

    // 新しい revision → 必要画像 / patch キュー / issue / previewSnapshot をリセットして再読み込みを促す
    // resolvedScope はセッション継続中のため保持する（beginSession でのみリセット）
    this.requiredImageKeysSet.clear();
    this.current = {
      ...this.current,
      lastMeta: {
        creationType: event.creationType,
        slotKey: event.slotKey,
        revision: event.revision,
        updatedAt: event.updatedAt,
      },
      previewSnapshot: null,
      requiredImageKeys: [],
      imageKeyToItemIds: {},
          sessionIssues: [],
    };
    this.notify();
  };

  /** sessionId ガード。不一致の場合は何もしない。 */
  private guardSession(sessionId: string): boolean {
    return this.current.sessionId === sessionId;
  }

  private isActiveCreationType(creationType: CreationType): boolean {
    return (
      this.activeCreationType === null ||
      this.activeCreationType === creationType
    );
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

/** createPdf previewPanel / controller が useSyncExternalStore で参照するシングルトン */
export const createPdfPreviewOrderStore = new CreatePdfPreviewOrderStore();
