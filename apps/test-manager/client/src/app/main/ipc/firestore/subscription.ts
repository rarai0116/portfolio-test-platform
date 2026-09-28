import type { FirestoreQuerySpec, QueryKey } from '@shared/types/contracts';

type WindowState = { keys: Set<QueryKey>; lastPing: number };
export type Diff = {
  toSubscribe: Array<{ key: QueryKey; spec: FirestoreQuerySpec }>;
  toUnsubscribe: QueryKey[];
};

export class SubscriptionRegistry {
  private windows = new Map<number, WindowState>();
  private specs = new Map<QueryKey, FirestoreQuerySpec>();
  private refCount = new Map<QueryKey, number>();
  private ttlMs = 60_000;

  setActiveKeys(
    windowId: number,
    keys: QueryKey[],
    specs: Record<QueryKey, FirestoreQuerySpec>,
  ): Diff {
    const now = Date.now();
    const st = this.windows.get(windowId) ?? {
      keys: new Set<QueryKey>(),
      lastPing: now,
    };
    const next = new Set(keys);
    // specs 登録
    for (const [k, s] of Object.entries(specs)) this.specs.set(k, s);

    const toSubscribe: Diff['toSubscribe'] = [];
    const toUnsubscribe: Diff['toUnsubscribe'] = [];

    // 追加
    for (const k of next) {
      if (!st.keys.has(k)) {
        const spec = this.specs.get(k);
        if (!spec) {
          console.warn(`SubscriptionRegistry: spec not found for key ${k}`);
          continue;
        }
        toSubscribe.push({ key: k, spec });
        this.refCount.set(k, (this.refCount.get(k) ?? 0) + 1);
      }
    }
    // 削除
    for (const k of st.keys) {
      if (!next.has(k)) {
        toUnsubscribe.push(k);
        const n = (this.refCount.get(k) ?? 1) - 1;
        if (n <= 0) this.refCount.delete(k);
        else this.refCount.set(k, n);
      }
    }

    st.keys = next;
    st.lastPing = now;
    this.windows.set(windowId, st);
    return { toSubscribe, toUnsubscribe };
  }

  // ウィンドウが生存していることを通知する
  ping(windowId: number) {
    const st = this.windows.get(windowId);
    if (st) st.lastPing = Date.now();
  }
  // 指定キーを購読している windowId を返す
  getWindowsForKey(key: QueryKey): number[] {
    const res: number[] = [];
    for (const [winId, st] of this.windows) {
      if (st.keys.has(key)) res.push(winId);
    }
    return res;
  }

  // 一定時間アクティブでないウィンドウをクリーンアップする
  cleanupZombies(): number[] {
    const now = Date.now();
    const removed: number[] = [];
    for (const [win, st] of this.windows) {
      if (now - st.lastPing > this.ttlMs) {
        for (const k of st.keys) {
          const n = (this.refCount.get(k) ?? 1) - 1;
          if (n <= 0) this.refCount.delete(k);
          else this.refCount.set(k, n);
        }
        this.windows.delete(win);
        removed.push(win);
      }
    }
    return removed;
  }

  getRefCount(key: QueryKey): number {
    return this.refCount.get(key) ?? 0;
  }

  dropWindow(windowId: number): QueryKey[] {
    const st = this.windows.get(windowId);
    if (!st) return [];
    const keys = [...st.keys];
    for (const k of keys) {
      const n = (this.refCount.get(k) ?? 1) - 1;
      if (n <= 0) this.refCount.delete(k);
      else this.refCount.set(k, n);
    }
    this.windows.delete(windowId);
    return keys;
  }
}