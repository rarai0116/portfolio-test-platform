/** biome-ignore-all lint/suspicious/noExplicitAny: FakeClientはモックされたFirestoreClientsのため */
import type {
  CachedDoc,
  FirestoreQuerySpec,
  PatchEvent,
} from '@shared/types/contracts';
import { describe, expect, it } from 'vitest';
import type { FirestoreClient, FirestoreDocLookup } from './clients';
import { ListenerHub } from './listenerHub';

class FakeClient implements FirestoreClient {
  getDoc(_path: string): Promise<CachedDoc | null> {
    throw new Error('Method not implemented.');
  }

  async ensureReadAccess(): Promise<void> {}

  getDocFromServerIncludingDeleted(_path: string): Promise<FirestoreDocLookup> {
    throw new Error('Method not implemented.');
  }
  private cb: ((ev: any[]) => void) | null = null;

  listenQuery(_spec: FirestoreQuerySpec, onChange: (ev: any[]) => void) {
    this.cb = onChange;
    return () => {
      this.cb = null;
    };
  }

  async getOnce(): Promise<any[]> {
    return [];
  }

  async applyWrite(): Promise<void> {}

  emitChange(ev: any[]) {
    this.cb?.(ev);
  }
}

describe('ListenerHub', () => {
  it('add emits patch events and remove stops', () => {
    const fake = new FakeClient();
    const hub = new ListenerHub(fake);
    const spec: FirestoreQuerySpec = { collectionPath: 'test' };
    const received: PatchEvent[] = [];

    hub.on('patch', (p) => received.push(p));
    hub.add('k1', spec);

    // 変更を注入
    fake.emitChange([
      {
        type: 'added',
        doc: {
          path: 'test/x1',
          data: { a: 1 },
          updateTime: { seconds: 1, nanos: 0 },
        },
      },
    ]);

    expect(received.length).toBe(1);
    expect(received[0].doc.path).toBe('test/x1');

    // remove 後は受け取らない
    hub.remove('k1');
    fake.emitChange([
      {
        type: 'modified',
        doc: {
          path: 'test/x1',
          data: { a: 2 },
          updateTime: { seconds: 2, nanos: 0 },
        },
      },
    ]);
    expect(received.length).toBe(1);
  });
});
