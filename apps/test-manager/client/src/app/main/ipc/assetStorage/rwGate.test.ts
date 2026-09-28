import { describe, expect, it } from 'vitest';
import { ReadWriteGate } from './rwGate';

const deferred = () => {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

// gate の取得は非同期のため、開始状態を確認する前に microtask を流す。
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('ReadWriteGate', () => {
  it('共有操作は同時に進行できる', async () => {
    const gate = new ReadWriteGate();
    const first = deferred();
    const second = deferred();
    const order: string[] = [];

    const a = gate.runShared(async () => {
      order.push('a-start');
      await first.promise;
      order.push('a-end');
    });
    const b = gate.runShared(async () => {
      order.push('b-start');
      await second.promise;
      order.push('b-end');
    });

    await flush();
    expect(order).toEqual(['a-start', 'b-start']);
    first.resolve();
    second.resolve();
    await Promise.all([a, b]);
    expect(order).toEqual(['a-start', 'b-start', 'a-end', 'b-end']);
  });

  it('排他操作は先行する共有操作の完了を待つ', async () => {
    const gate = new ReadWriteGate();
    const shared = deferred();
    const order: string[] = [];

    const sharedRun = gate.runShared(async () => {
      order.push('shared-start');
      await shared.promise;
      order.push('shared-end');
    });

    const exclusiveRun = gate.runExclusive(() => {
      order.push('exclusive');
    });

    await flush();
    expect(order).toEqual(['shared-start']);
    shared.resolve();
    await Promise.all([sharedRun, exclusiveRun]);
    expect(order).toEqual(['shared-start', 'shared-end', 'exclusive']);
  });

  it('排他待ちがある間は後続の共有操作を通さない（書き込み側優先）', async () => {
    const gate = new ReadWriteGate();
    const shared = deferred();
    const order: string[] = [];

    const firstShared = gate.runShared(async () => {
      order.push('shared1');
      await shared.promise;
    });
    const exclusiveRun = gate.runExclusive(() => {
      order.push('exclusive');
    });
    const secondShared = gate.runShared(() => {
      order.push('shared2');
    });

    shared.resolve();
    await Promise.all([firstShared, exclusiveRun, secondShared]);
    expect(order).toEqual(['shared1', 'exclusive', 'shared2']);
  });

  it('排他操作が例外を投げても解放され、後続が進める', async () => {
    const gate = new ReadWriteGate();

    await expect(
      gate.runExclusive(() => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    await expect(gate.runShared(() => 'ok')).resolves.toBe('ok');
  });
});
