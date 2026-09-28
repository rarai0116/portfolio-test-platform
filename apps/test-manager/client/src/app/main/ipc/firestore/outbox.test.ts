import { describe, expect, it, vi } from 'vitest';
import type { FirestoreMutationExecutor } from './mutationExecutor';
import type { OutboxEntry } from './outbox';
import { type Outbox, OutboxRunner } from './outbox';

const mkEntry = (over?: Partial<OutboxEntry>): OutboxEntry => ({
  mutationId: 'm1',
  path: 'test/doc1',
  kind: 'set',
  data: { a: 1 },
  status: 'pending',
  retries: 0,
  createdAtMs: Date.now(),
  nextAttemptAtMs: Date.now(),
  ...over,
});

describe('OutboxRunner', () => {
  it('success path calls executor.execute and marks committed', async () => {
    const outbox = {
      reservePending: vi.fn().mockResolvedValue([mkEntry()]),
      releaseReservation: vi.fn().mockResolvedValue(undefined),
      reschedule: vi.fn(),
      markCommitted: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };

    const executor: FirestoreMutationExecutor = {
      execute: vi.fn().mockResolvedValue(undefined),
    };

    const runner = new OutboxRunner(outbox as unknown as Outbox, executor, {
      intervalMs: 10,
    });

    // biome-ignore lint/complexity/useLiteralKeys: private method access for testing
    await runner['tick']();

    expect(executor.execute).toHaveBeenCalledTimes(1);
    expect(outbox.markCommitted).toHaveBeenCalledTimes(1);
    expect(outbox.reschedule).not.toHaveBeenCalled();
    expect(outbox.markFailed).not.toHaveBeenCalled();
  });

  it('retry path calls outbox.reschedule when executor.execute fails transiently', async () => {
    const outbox = {
      reservePending: vi.fn().mockResolvedValue([mkEntry({ retries: 1 })]),
      releaseReservation: vi.fn().mockResolvedValue(undefined),
      reschedule: vi.fn().mockResolvedValue(undefined),
      markCommitted: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };

    const err = Object.assign(new Error('deadline-exceeded'), {
      code: 'deadline-exceeded',
    });

    const executor: FirestoreMutationExecutor = {
      execute: vi.fn().mockRejectedValue(err),
    };

    const runner = new OutboxRunner(outbox as unknown as Outbox, executor, {
      intervalMs: 10,
      baseBackoffMs: 100,
      capBackoffMs: 1000,
    });

    // biome-ignore lint/complexity/useLiteralKeys: private method access for testing
    await runner['tick']();

    expect(outbox.reschedule).toHaveBeenCalledTimes(1);
    expect(outbox.markFailed).not.toHaveBeenCalled();

    const args = outbox.reschedule.mock.calls[0];
    expect(args[0]).toBe('m1');
  });
});
