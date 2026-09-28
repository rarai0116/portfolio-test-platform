// 変更点: 楽観的オーバーレイに加え、committed から「自分のコミット」を除外するオプションを追加

import type {
  CachedDoc,
  FirestoreQuerySpec,
  GetOnceResult,
  OrderDirection,
  OutboxItem,
  OutboxUpdate,
  PatchEvent,
  Version,
  WhereOp,
} from '@shared/types/contracts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// CRUD
export const randomId = () => {
  return `t_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;
};

// 共有: 簡易キー生成（spec を安定化JSONにして一意なキーに）
function makeQueryKey(spec: FirestoreQuerySpec): string {
  const where = (spec.where ?? []).map(([f, op, v]) => [f, op, v]);
  const orderBy = (spec.orderBy ?? []).map(([f, d]) => [f, d ?? 'asc']);
  const s = JSON.stringify({
    collectionPath: spec.collectionPath,
    group: !!spec.group,
    where,
    orderBy,
    limit: spec.limit ?? null,
  });
  return `q:${s}`;
}

// 共有: ウィンドウ内で購読キーを合算・同期するレジストリ（refCount）
const ActiveKeysRegistry = (() => {
  type Entry = { spec: FirestoreQuerySpec; refs: number };
  const map = new Map<string, Entry>();

  // 共有ハートビート（購読総数 > 0 のときだけ起動）
  let hbTimer: number | null = null;
  let subscribers = 0;
  const WINDOW_ID = 1;

  const sync = () => {
    if (!('fs' in window)) return;
    const keys = Array.from(map.keys());
    const specs: Record<string, FirestoreQuerySpec> = {};
    for (const [k, e] of map) specs[k] = e.spec;
    void window.fs
      .setActiveKeys({ windowId: WINDOW_ID, keys, specs })
      .catch((e) => console.error('setActiveKeys(sync) error', e));
  };

  const startHeartbeat = () => {
    if (!('fs' in window)) return;
    if (hbTimer) return;
    const doPing = () =>
      window.fs
        .ping({ windowId: WINDOW_ID })
        .catch((e) => console.error('ping error', e));
    doPing();
    hbTimer = window.setInterval(doPing, 30_000);
  };

  const stopHeartbeat = () => {
    if (hbTimer) {
      clearInterval(hbTimer);
      hbTimer = null;
    }
  };

  return {
    add(key: string, spec: FirestoreQuerySpec) {
      const cur = map.get(key);
      if (cur) {
        cur.refs += 1;
        map.set(key, cur);
      } else {
        map.set(key, { spec, refs: 1 });
      }
      subscribers += 1;
      sync();
      startHeartbeat();
    },
    remove(key: string) {
      const cur = map.get(key);
      if (!cur) return;
      cur.refs -= 1;
      if (cur.refs <= 0) map.delete(key);
      subscribers = Math.max(0, subscribers - 1);
      sync();
      if (subscribers === 0) stopHeartbeat();
    },
    clearAll() {
      map.clear();
      subscribers = 0;
      sync();
      stopHeartbeat();
    },
  };
})();

// 楽観的更新のための型とユーティリティ
type OptimisticKind = 'create' | 'update' | 'delete';
type OptimisticEntry<T> = {
  kind: OptimisticKind;
  path: string;
  patch?: Partial<T>;
  prev?: T;
  clientGenerated?: boolean;
  at: number;
};

const isPendingStatus = (s: string) =>
  s === 'PENDING' || s === 'RESERVED' || s === 'RETRYING';
const isFailedStatus = (s: string) => s === 'FAILED' || s === 'CANCELED';

export type HandlerOptions = {
  // 読み取りクエリ
  collectionPath: string;
  group?: boolean;
  where?: Array<[field: string, op: WhereOp, value: unknown]>;
  orderBy?: Array<[field: string, dir?: OrderDirection]>;
  limit?: number;

  // ライフサイクル
  autoSubscribe?: boolean; // mount時に自動subscribe
  includeOutbox?: boolean; // Outboxのスナップショット/更新も購読

  // committed 検知から「自分のコミット」を除外する
  excludeSelfCommittedFromStamp?: boolean;
};

export type HandlerResult<T> = {
  // UI用（楽観オーバーレイ適用済み）
  docs: Array<{ path: string; data?: T; updateTime: Version }>;

  // サーバ確定のみ（オーバーレイ未反映）
  committedDocs: Array<{ path: string; data?: T; updateTime: Version }>;
  committedStamp: string;

  isSubscribed: boolean;
  loading: boolean;
  error?: unknown;

  // 操作
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  refresh: () => Promise<void>;

  // CRUD
  create: (data: Partial<T>, id?: string) => Promise<string>;
  createAtPath: (path: string, data: Partial<T>) => Promise<string>;
  update: (idOrPath: string, data: Partial<T>) => Promise<string>;
  remove: (idOrPath: string) => Promise<void>;

  // 任意: Outbox
  outboxItems?: OutboxItem[];
  outboxLog?: Array<OutboxUpdate>;
};

export function useFirestoreHandler<T = unknown>(
  options: HandlerOptions,
): HandlerResult<T> {
  const {
    collectionPath,
    group,
    where,
    orderBy,
    limit,
    autoSubscribe = true,
    includeOutbox = false,
    excludeSelfCommittedFromStamp = false,
  } = options;

  const hasFs = typeof window !== 'undefined' && 'fs' in window;
  const spec = useMemo<FirestoreQuerySpec>(
    () => ({ collectionPath, group, where, orderBy, limit }),
    [collectionPath, group, where, orderBy, limit],
  );
  const key = useMemo(() => makeQueryKey(spec), [spec]);

  const [docs, setDocs] = useState<CachedDoc[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(autoSubscribe);
  const [error, setError] = useState<unknown>(undefined);

  const [outboxItems, setOutboxItems] = useState<OutboxItem[] | undefined>(
    includeOutbox ? [] : undefined,
  );
  const [outboxLog, setOutboxLog] = useState<Array<OutboxUpdate> | undefined>(
    includeOutbox ? [] : undefined,
  );

  // 楽観的オーバーレイ
  const optimisticRef = useRef<Map<string, OptimisticEntry<T>>>(new Map());
  const [overlayTick, setOverlayTick] = useState(0); // オーバーレイ変更トリガ

  // 自分の変更トラッキング（コミット除外用）
  const myMutationIdsRef = useRef<Set<string>>(new Set());
  const selfChangedPathsRef = useRef<Set<string>>(new Set());
  const selfPathTimersRef = useRef<Map<string, number>>(new Map());
  const [selfTick, setSelfTick] = useState(0); // 自分コミット除外の再計算トリガ
  const tickSelf = useCallback(() => setSelfTick((v) => v + 1), []);

  // サーバ確定のみ（オーバーレイ未反映）
  const committedDocs = useMemo(
    () =>
      docs.map((d) => ({
        path: d.path,
        data: d.data as T | undefined,
        updateTime: d.updateTime,
      })),
    [docs],
  );

  // サーバ確定のうち「自分のコミット」を除外したビュー
  // biome-ignore lint/correctness/useExhaustiveDependencies: selfTick で再評価
  const committedDocsFiltered = useMemo(() => {
    if (!excludeSelfCommittedFromStamp) return committedDocs;
    if (selfChangedPathsRef.current.size === 0) return committedDocs;
    const ex = selfChangedPathsRef.current;
    return committedDocs.filter((d) => !ex.has(d.path));
    // 依存に ex を直接入れないため、tickSelf で再評価
  }, [committedDocs, excludeSelfCommittedFromStamp, selfTick]);

  // サーバ確定のみの変更検知用スタンプ
  const committedStamp = useMemo(() => {
    const base = excludeSelfCommittedFromStamp
      ? committedDocsFiltered
      : committedDocs;
    return base
      .map((d) => `${d.path}:${d.updateTime.seconds}:${d.updateTime.nanos}`)
      .sort()
      .join('|');
  }, [committedDocs, committedDocsFiltered, excludeSelfCommittedFromStamp]);

  // Patch を適用（このフックの key 以外は無視）
  const applyPatch = useCallback(
    (ev: PatchEvent) => {
      if (ev.key !== key) return;
      setDocs((prev) => {
        if (ev.type === 'reset') return [];
        if (ev.type === 'removed') {
          return prev.filter((d) => d.path !== ev.doc.path);
        }
        const i = prev.findIndex((d) => d.path === ev.doc.path);
        if (i === -1) return [...prev, ev.doc];
        const next = prev.slice();
        next[i] = ev.doc;
        return next;
      });

      if (!includeOutbox && ev.type !== 'reset' && ev.doc?.path) {
        // Outbox未購読時: サーバパッチ受信でオーバーレイを消す
        if (optimisticRef.current.has(ev.doc.path)) {
          optimisticRef.current.delete(ev.doc.path);
          setOverlayTick((v) => v + 1);
        }
      }

      if (excludeSelfCommittedFromStamp && ev.doc?.path) {
        // 自分のコミット除外: パッチが来たら短い遅延後に除外解除（1回分スキップする）
        if (selfChangedPathsRef.current.has(ev.doc.path)) {
          const path = ev.doc.path;
          const prevTimer = selfPathTimersRef.current.get(path);
          if (prevTimer) clearTimeout(prevTimer);
          const t = window.setTimeout(() => {
            selfChangedPathsRef.current.delete(path);
            selfPathTimersRef.current.delete(path);
            tickSelf();
          }, 60);
          selfPathTimersRef.current.set(path, t as unknown as number);
        }
      }
    },
    [key, includeOutbox, excludeSelfCommittedFromStamp, tickSelf],
  );

  // getOnce
  const refresh = useCallback(async () => {
    if (!hasFs) return;
    try {
      const res: GetOnceResult = await window.fs.getOnce({ key, spec });
      if (res.key === key) setDocs(res.docs);
    } catch (e) {
      setError(e);
      console.error('getOnce error', e);
    }
  }, [hasFs, key, spec]);

  // subscribe/unsubscribe
  const subscribe = useCallback(async () => {
    if (!hasFs) return;
    try {
      ActiveKeysRegistry.add(key, spec);
      setIsSubscribed(true);
    } catch (e) {
      setError(e);
      console.error('subscribe error', e);
    }
  }, [hasFs, key, spec]);

  const unsubscribe = useCallback(async () => {
    if (!hasFs) return;
    try {
      ActiveKeysRegistry.remove(key);
      setIsSubscribed(false);
    } catch (e) {
      setError(e);
      console.error('unsubscribe error', e);
    }
  }, [hasFs, key]);

  // 初期ロード + 購読イベント購読
  // biome-ignore lint/correctness/useExhaustiveDependencies: useEffectなので
  useEffect(() => {
    if (!hasFs) return;
    const offPatch = window.fs.onPatch(applyPatch);

    setLoading(true);
    refresh().finally(() => setLoading(false));

    if (autoSubscribe) {
      void subscribe();
    }

    let offOutbox: (() => void) | undefined;
    if (includeOutbox) {
      // 初期スナップショット
      void window.fs
        .getOutbox()
        .then((snap) => {
          if (snap.type === 'snapshot') setOutboxItems?.(snap.items);
        })
        .catch((e) => console.error('getOutbox error', e));

      // 更新イベント
      offOutbox = window.fs.onOutboxUpdate((ev: OutboxUpdate) => {
        setOutboxLog?.((prev) => [ev, ...(prev ?? [])].slice(0, 100));
        if (ev.type === 'snapshot') {
          setOutboxItems?.(ev.items);
        } else {
          setOutboxItems?.((prev) => {
            const next = (prev ?? []).slice();
            const i = next.findIndex(
              (x) => x.mutationId === ev.item.mutationId,
            );
            if (i >= 0) next[i] = ev.item;
            else next.unshift(ev.item);
            return next;
          });
        }

        if (
          excludeSelfCommittedFromStamp &&
          ev.type === 'committed' &&
          ev.item &&
          myMutationIdsRef.current.has(ev.item.mutationId)
        ) {
          // 自分のコミット除外: 自身が発行した mutationId の COMMITTED を検知したら path を除外対象に
          const st = String(ev.item.status).toUpperCase();
          if (st === 'COMMITTED') {
            selfChangedPathsRef.current.add(ev.item.path);
            tickSelf(); // スタンプ再計算
            // mutationId は役目を終えたので削除
            myMutationIdsRef.current.delete(ev.item.mutationId);
            // 念のためタイムアウトで解除（万一パッチが来なかった場合の掃除）
            const prevTimer = selfPathTimersRef.current.get(ev.item.path);
            if (prevTimer) clearTimeout(prevTimer);
            const t = window.setTimeout(() => {
              selfChangedPathsRef.current.delete(ev.item.path);
              selfPathTimersRef.current.delete(ev.item.path);
              tickSelf();
            }, 5_000);
            selfPathTimersRef.current.set(ev.item.path, t as unknown as number);
          }
        }
      });
    }

    return () => {
      offPatch();
      if (autoSubscribe) void unsubscribe();
      offOutbox?.();

      // クリーンアップ
      optimisticRef.current.clear();
      myMutationIdsRef.current.clear();
      for (const t of selfPathTimersRef.current.values()) {
        clearTimeout(t);
      }
      selfPathTimersRef.current.clear();
      selfChangedPathsRef.current.clear();
    };
  }, [key, spec]);

  // UI 用: docs と overlay を合成
  // biome-ignore lint/correctness/useExhaustiveDependencies: overlayTick で再評価
  const uiDocs: CachedDoc[] = useMemo(() => {
    const base = docs;
    const overlay = optimisticRef.current;
    if (overlay.size === 0) return base;

    const byPath = new Map<string, CachedDoc>(base.map((d) => [d.path, d]));
    const defaultVersion: Version = { seconds: 0, nanos: 0 };

    for (const [path, ent] of overlay) {
      if (ent.kind === 'delete') {
        byPath.delete(path);
        continue;
      }
      const current = byPath.get(path);
      const mergedData =
        ent.kind === 'create'
          ? { ...ent.patch }
          : { ...(current?.data ?? {}), ...ent.patch };
      const doc: CachedDoc =
        current ??
        ({
          path,
          data: {},
          updateTime: defaultVersion,
        } as CachedDoc);
      byPath.set(path, { ...doc, data: mergedData });
    }
    return Array.from(byPath.values());
  }, [docs, overlayTick]);

  const resolvePath = useCallback(
    (idOrPath: string | undefined) => {
      if (!idOrPath) return `${collectionPath}/${randomId()}`;
      return idOrPath.includes('/')
        ? idOrPath
        : `${collectionPath}/${idOrPath}`;
    },
    [collectionPath],
  );

  const create = useCallback(
    async (data: Partial<T>, id?: string) => {
      if (!hasFs) {
        throw new Error('Firestore API が見つかりません');
      }
      if (group) {
        throw new Error(
          'collectionGroup クエリでは createAtPath(path, data) を使用してください',
        );
      }
      const path = resolvePath(id);
      // 楽観オーバーレイ
      optimisticRef.current.set(path, {
        kind: 'create',
        path,
        patch: data,
        clientGenerated: !id,
        at: Date.now(),
      });
      setOverlayTick((v) => v + 1);

      // mutate 発行（自分の変更を記録）
      const mutationId = randomId();
      myMutationIdsRef.current.add(mutationId);
      selfChangedPathsRef.current.add(path);
      tickSelf();

      try {
        await window.fs.mutate({
          mutationId,
          kind: 'create',
          path,
          data,
        });
        return mutationId;
      } catch (e) {
        optimisticRef.current.delete(path);
        myMutationIdsRef.current.delete(mutationId);
        selfChangedPathsRef.current.delete(path);
        setOverlayTick((v) => v + 1);
        tickSelf();
        throw e;
      }
    },
    [hasFs, group, resolvePath, tickSelf],
  );

  const createAtPath = useCallback(
    async (path: string, data: Partial<T>) => {
      if (!hasFs) {
        throw new Error('Firestore API が見つかりません');
      }
      optimisticRef.current.set(path, {
        kind: 'create',
        path,
        patch: data,
        at: Date.now(),
      });
      setOverlayTick((v) => v + 1);

      const mutationId = randomId();
      myMutationIdsRef.current.add(mutationId);
      selfChangedPathsRef.current.add(path);
      tickSelf();

      try {
        await window.fs.mutate({
          mutationId,
          kind: 'create',
          path,
          data,
        });
        return mutationId;
      } catch (e) {
        optimisticRef.current.delete(path);
        myMutationIdsRef.current.delete(mutationId);
        selfChangedPathsRef.current.delete(path);
        setOverlayTick((v) => v + 1);
        tickSelf();
        throw e;
      }
    },
    [hasFs, tickSelf],
  );

  const update = useCallback(
    async (idOrPath: string, data: Partial<T>) => {
      if (!hasFs) {
        throw new Error(
          'Firestore API が見つかりません（preload未反映の可能性）',
        );
      }
      const path = resolvePath(idOrPath);
      const current = docs.find((d) => d.path === path)?.data as T | undefined;
      optimisticRef.current.set(path, {
        kind: 'update',
        path,
        patch: data,
        prev: current,
        at: Date.now(),
      });
      setOverlayTick((v) => v + 1);

      const mutationId = randomId();
      myMutationIdsRef.current.add(mutationId);
      selfChangedPathsRef.current.add(path);
      tickSelf();

      try {
        await window.fs.mutate({
          mutationId,
          kind: 'update',
          path,
          data,
        });
        return mutationId;
      } catch (e) {
        optimisticRef.current.delete(path);
        myMutationIdsRef.current.delete(mutationId);
        selfChangedPathsRef.current.delete(path);
        setOverlayTick((v) => v + 1);
        tickSelf();
        throw e;
      }
    },
    [hasFs, resolvePath, docs, tickSelf],
  );

  const remove = useCallback(
    async (idOrPath: string) => {
      if (!hasFs) return;
      const path = resolvePath(idOrPath);
      const current = docs.find((d) => d.path === path)?.data as T | undefined;
      optimisticRef.current.set(path, {
        kind: 'delete',
        path,
        prev: current,
        at: Date.now(),
      });
      setOverlayTick((v) => v + 1);

      const mutationId = randomId();
      myMutationIdsRef.current.add(mutationId);
      selfChangedPathsRef.current.add(path);
      tickSelf();

      try {
        await window.fs.mutate({
          mutationId,
          kind: 'delete',
          path,
          data: undefined,
        });
      } catch (e) {
        optimisticRef.current.delete(path);
        myMutationIdsRef.current.delete(mutationId);
        selfChangedPathsRef.current.delete(path);
        setOverlayTick((v) => v + 1);
        tickSelf();
        throw e;
      }
    },
    [hasFs, resolvePath, docs, tickSelf],
  );

  // Outbox によるオーバーレイ確定/ロールバック
  useEffect(() => {
    if (!includeOutbox || !Array.isArray(outboxItems)) return;

    const byPath = new Map<string, { pending: boolean; failed: boolean }>();
    for (const it of outboxItems) {
      const st = String(it.status).toUpperCase();
      const cur = byPath.get(it.path) ?? { pending: false, failed: false };
      if (isPendingStatus(st)) cur.pending = true;
      if (isFailedStatus(st)) cur.failed = true;
      byPath.set(it.path, cur);
    }

    let changed = false;
    for (const [path] of optimisticRef.current) {
      const agg = byPath.get(path);
      if (agg?.failed) {
        optimisticRef.current.delete(path);
        changed = true;
        continue;
      }
      if (!agg?.pending) {
        optimisticRef.current.delete(path);
        changed = true;
      }
    }
    if (changed) setOverlayTick((v) => v + 1);
  }, [includeOutbox, outboxItems]);

  const result: HandlerResult<T> = {
    // UI 用（オーバーレイ合成済み）
    docs: useMemo(
      () =>
        uiDocs.map((d) => ({
          path: d.path,
          data: d.data as T | undefined,
          updateTime: d.updateTime,
        })),
      [uiDocs],
    ),
    // サーバ確定のみ
    committedDocs: committedDocsFiltered,
    committedStamp,

    isSubscribed,
    loading,
    error,
    subscribe,
    unsubscribe,
    refresh,
    create,
    createAtPath,
    update,
    remove,
    outboxItems,
    outboxLog,
  };

  return result;
}
