import type { OutboxItem } from '@shared/types/contracts';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type WaitOutboxSettledResult = {
  ok: boolean;
  committed: number;
  failed: number;
  timeout: boolean;
  failedMutationIds: string[];
};

export async function waitOutboxSettled(
  mutationIds: string[],
  stallTimeoutMs = 60_000,
  setMessage: (message?: string) => void = () => {},
): Promise<WaitOutboxSettledResult> {
  if (mutationIds.length === 0) {
    return {
      ok: true,
      committed: 0,
      failed: 0,
      timeout: false,
      failedMutationIds: [],
    };
  }

  const total = mutationIds.length;
  const start = Date.now();
  let lastProgressAt = start;

  let lastCommitted = 0;
  let lastFailed = 0;

  while (true) {
    const now = Date.now();

    try {
      const snap = await window.fs.getOutbox();
      if (snap.type === 'snapshot') {
        const byId = new Map<string, OutboxItem>(
          snap.items.map((it) => [it.mutationId, it]),
        );

        const statuses = mutationIds.map(
          (id) => byId.get(id)?.status ?? 'pending',
        );
        const committed = statuses.filter((s) => s === 'committed').length;
        const failed = statuses.filter((s) => s === 'failed').length;

        const failedMutationIds = mutationIds.filter(
          (id) => byId.get(id)?.status === 'failed',
        );

        const settled = committed + failed;

        // コミット間ごとのタイムアウト（進捗があったらリセット）
        if (committed !== lastCommitted || failed !== lastFailed) {
          lastProgressAt = now;
          lastCommitted = committed;
          lastFailed = failed;
        }

        if (settled === total) {
          setMessage(undefined);
          return {
            ok: true,
            committed,
            failed,
            timeout: false,
            failedMutationIds,
          };
        }

        const stalledForMs = now - lastProgressAt;
        setMessage(
          `コミット待ち… (${committed} / ${total} 成功, ${failed} 失敗) ` +
            `進捗停止 ${Math.floor(stalledForMs / 1000)}秒`,
        );

        if (stalledForMs >= stallTimeoutMs) {
          return {
            ok: false,
            committed,
            failed,
            timeout: true,
            failedMutationIds,
          };
        }
      } else {
        const stalledForMs = now - lastProgressAt;
        setMessage(
          `コミット待ち… (Outbox取得中) 進捗停止 ${Math.floor(stalledForMs / 1000)}秒`,
        );
        if (stalledForMs >= stallTimeoutMs) {
          return {
            ok: false,
            committed: lastCommitted,
            failed: lastFailed,
            timeout: true,
            failedMutationIds: [],
          };
        }
      }
    } catch (_e) {
      const stalledForMs = now - lastProgressAt;
      setMessage(
        `コミット待ち… (Outbox取得失敗) 進捗停止 ${Math.floor(stalledForMs / 1000)}秒`,
      );
      if (stalledForMs >= stallTimeoutMs) {
        return {
          ok: false,
          committed: lastCommitted,
          failed: lastFailed,
          timeout: true,
          failedMutationIds: [],
        };
      }
    }

    await sleep(400);
  }
}
