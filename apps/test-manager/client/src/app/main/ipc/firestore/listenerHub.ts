import { EventEmitter } from 'node:events';
import type {
  // CachedDoc,
  FirestoreQuerySpec,
  PatchEvent,
  QueryKey,
} from '@shared/types/contracts';
import type { FirestoreClient } from './clients';

type Listener = { stop: () => void; key: QueryKey; spec: FirestoreQuerySpec };

// 型付き EventEmitter（'patch' イベントのみ公開）
// Node の EventEmitter ジェネリックはイベント名 -> 引数タプルのマップを期待するため、
// 各イベントは引数のタプル型で定義します。
type ListenerHubEvents = {
  patch: [patch: PatchEvent];
};

/**
 * Firestore のクエリ購読を管理し、変更イベントをrender側に発行するハブ
 */
export class ListenerHub extends EventEmitter<ListenerHubEvents> {
  // events: 'patch' -> (patch: PatchEvent) => void
  // NOTE: EventEmitter#listeners と衝突しない名前に変更
  private subscriptions = new Map<QueryKey, Listener>();

  constructor(private client: FirestoreClient) {
    super();
  }

  add(key: QueryKey, spec: FirestoreQuerySpec) {
    if (this.subscriptions.has(key)) return;
    const stop = this.client.listenQuery(spec, (changes) => {
      for (const ch of changes) {
        const ev: PatchEvent = {
          key,
          type: ch.type,
          doc: ch.doc,
        };
        this.emit('patch', ev);
      }
    });
    this.subscriptions.set(key, { stop, key, spec });
  }

  remove(key: QueryKey) {
    const l = this.subscriptions.get(key);
    if (!l) return;
    l.stop();
    this.subscriptions.delete(key);
  }

  dispose() {
    for (const l of this.subscriptions.values()) l.stop();
    this.subscriptions.clear();
    this.removeAllListeners();
  }
}