import type {
  AssetCancelPayload,
  AssetCancelResult,
  AssetDeletePayload,
  AssetDeleteResult,
  AssetKey,
  AssetLoadFailureResult,
  AssetLoadReport,
  AssetLoadSuccessResult,
  AssetReadyNotice,
  AssetReplacePayload,
  AssetReplaceResult,
  AssetsPrioritizePayload,
  AssetsRequestPayload,
  AssetsRequestResult,
  AssetUploadBufferPayload,
  AssetUploadPayload,
  AssetUploadResult,
} from '@shared/types/assets';
import { AssetChannels } from '@shared/types/assets';
import type { GradeId } from '@shared/types/contracts';
import { EditorChannels, type EditorInsertPayload } from '@shared/types/editor';
import { contextBridge, ipcRenderer } from 'electron';

type InflightId = string;

// 要求中管理の identity は常に {grade,key} へ統一する（設計9.4）。
// ready通知や失敗結果は version などの余分なフィールドを持つため、
// 識別に使うのは grade と key だけにする。
const getKeyId = (key: AssetKey): InflightId =>
  JSON.stringify({ grade: key?.grade, key: key?.key });

const getGrade = (key: AssetKey): string | undefined => {
  return typeof key === 'object' && key !== null && 'grade' in key
    ? String(key.grade)
    : undefined;
};

const toAssetKey = (value: unknown): AssetKey | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = value as { grade?: unknown; key?: unknown };
  if (
    typeof candidate.grade !== 'string' ||
    typeof candidate.key !== 'string'
  ) {
    return undefined;
  }
  return { grade: candidate.grade as AssetKey['grade'], key: candidate.key };
};

// inflight 管理: id => AssetKey
const inflightById = new Map<InflightId, AssetKey>();
// grade => Set<id>
const inflightByGrade = new Map<string, Set<InflightId>>();

const registerInflight = (items: AssetKey[]) => {
  for (const key of items) {
    const id = getKeyId(key);
    inflightById.set(id, key);
    const grade = getGrade(key);
    if (grade) {
      const bucket = inflightByGrade.get(grade) ?? new Set<InflightId>();
      bucket.add(id);
      inflightByGrade.set(grade, bucket);
    }
  }
};

const unregisterInflightById = (id: InflightId) => {
  const key = inflightById.get(id);
  if (!key) return;
  inflightById.delete(id);
  const grade = getGrade(key);
  if (grade) {
    const bucket = inflightByGrade.get(grade);
    bucket?.delete(id);
    if (bucket && bucket.size === 0) {
      inflightByGrade.delete(grade);
    }
  }
};

const unregisterInflightByKey = (key: AssetKey) => {
  unregisterInflightById(getKeyId(key));
};

// ready/error イベントペイロードから {grade,key} を取り出して除去
const maybeExtractKeyFromEvent = (e: unknown): AssetKey | undefined => {
  const direct = toAssetKey(e);
  if (direct) return direct;

  if (typeof e === 'object' && e !== null && 'item' in e) {
    return toAssetKey((e as { item?: unknown }).item);
  }
  return undefined;
};

const unregisterFromEventPayload = (payload: unknown) => {
  const key = maybeExtractKeyFromEvent(payload);
  if (key) unregisterInflightByKey(key);
};

// キャンセル API
const cancelInflight = async (filter?: {
  grade?: string;
  items?: AssetKey[];
}): Promise<AssetCancelResult> => {
  let ids: InflightId[] = [];

  if (filter?.items?.length) {
    ids = filter.items.map(getKeyId);
  } else if (filter?.grade) {
    ids = [...(inflightByGrade.get(filter.grade)?.values() ?? [])];
  } else {
    ids = [...inflightById.keys()];
  }

  const items = ids
    .map((id) => inflightById.get(id))
    .filter((v): v is AssetKey => Boolean(v));

  if (items.length === 0) {
    return { ok: true, canceled: 0 };
  }

  const result = (await ipcRenderer.invoke(AssetChannels.cancel, {
    items,
  } as AssetCancelPayload)) as AssetCancelResult;

  if (result.ok) {
    for (const item of items) {
      unregisterInflightByKey(item);
    }
  }

  return result;
};

// assets 用の安全なブリッジを公開
contextBridge.exposeInMainWorld('assets', {
  // inflight 登録と応答 ready の分だけ除去
  request: (items: AssetKey[]) => {
    registerInflight(items);
    return ipcRenderer
      .invoke(AssetChannels.request, {
        items,
      } as AssetsRequestPayload)
      .then((res: AssetsRequestResult) => {
        if (res?.ok === true) {
          // ready と failed は要求中集合から除外し、pending だけ維持する（設計9.4）。
          for (const item of [
            ...(Array.isArray(res.ready) ? res.ready : []),
            ...(Array.isArray(res.failed) ? res.failed : []),
          ]) {
            unregisterFromEventPayload(item);
          }
        }
        // invoke 自体が reject した場合は main が一部受理した可能性があるため自動解除しない。
        return res;
      }) as Promise<AssetsRequestResult>;
  },
  upload: (filePath: string, grade: GradeId, timeoutMs?: number) =>
    ipcRenderer.invoke(AssetChannels.upload, {
      filePath,
      grade,
      timeoutMs,
    } as AssetUploadPayload) as Promise<AssetUploadResult>,
  uploadBuffer: (
    fileName: string,
    bytes: Uint8Array,
    grade: GradeId,
    contentType?: string,
    timeoutMs?: number,
  ) =>
    ipcRenderer.invoke(AssetChannels.uploadBuffer, {
      fileName,
      bytes,
      grade,
      contentType,
      timeoutMs,
    } as AssetUploadBufferPayload) as Promise<AssetUploadResult>,
  replace: (
    filePath: string,
    grade: GradeId,
    key: string,
    timeoutMs?: number,
  ) =>
    ipcRenderer.invoke(AssetChannels.replace, {
      filePath,
      grade,
      key,
      timeoutMs,
    } as AssetReplacePayload) as Promise<AssetReplaceResult>,
  prioritize: (items: AssetKey[], priority?: number) =>
    ipcRenderer.invoke(AssetChannels.prioritize, {
      items,
      priority,
    } as AssetsPrioritizePayload),

  onReady: (handler: (item: AssetReadyNotice) => void) => {
    const listener = (_: unknown, item: AssetReadyNotice) => {
      // ready 受信時に inflight から除去
      unregisterFromEventPayload(item);
      handler(item);
    };
    ipcRenderer.on(AssetChannels.ready, listener);
    return () => ipcRenderer.off(AssetChannels.ready, listener);
  },

  onProgress: (handler: (e: unknown) => void) => {
    const listener = (_: unknown, e: unknown) => handler(e);
    ipcRenderer.on(AssetChannels.progress, listener);
    return () => ipcRenderer.off(AssetChannels.progress, listener);
  },

  onError: (handler: (e: unknown) => void) => {
    const listener = (_: unknown, e: unknown) => {
      // エラー対象が特定できる場合は inflight から除去
      unregisterFromEventPayload(e);
      handler(e);
    };
    ipcRenderer.on(AssetChannels.error, listener);
    return () => ipcRenderer.off(AssetChannels.error, listener);
  },
  delete: async (params: {
    grade: GradeId;
    key: string;
  }): Promise<AssetDeleteResult> => {
    const payload: AssetDeletePayload = {
      grade: params.grade,
      key: params.key,
    };
    const res = (await ipcRenderer.invoke(
      AssetChannels.delete,
      payload,
    )) as AssetDeleteResult;
    return res;
  },
  /** demo-asset URL の表示失敗を報告する（設計5.2） */
  reportLoadFailure: (report: AssetLoadReport) =>
    ipcRenderer.invoke(
      AssetChannels.loadFailure,
      report,
    ) as Promise<AssetLoadFailureResult>,

  /** r付きURLの表示成功だけを報告する（設計5.2） */
  reportLoadSuccess: (report: AssetLoadReport) =>
    ipcRenderer.invoke(
      AssetChannels.loadSuccess,
      report,
    ) as Promise<AssetLoadSuccessResult>,

  cancel: (filter?: { grade?: string; items?: AssetKey[] }) =>
    cancelInflight(filter),
  // クリアキャッシュ
  clearCache: async (scope?: { grade?: string }) => {
    await cancelInflight(scope);
    return ipcRenderer.invoke(AssetChannels.clearCache, scope);
  },
});

// editor 用
contextBridge.exposeInMainWorld('editor', {
  insertImage: (payload: EditorInsertPayload) =>
    ipcRenderer.invoke(EditorChannels.insert, payload).catch((e) => ({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    })),
  onInsertImage: (handler: (payload: EditorInsertPayload) => void) => {
    const listener = (_: unknown, payload: EditorInsertPayload) =>
      handler(payload);
    ipcRenderer.on(EditorChannels.insert, listener);
    return () => ipcRenderer.off(EditorChannels.insert, listener);
  },
});
