/**
 * 送信キューの管理と永続化を行うインターフェース
 */

import { EventEmitter } from 'node:events';
import { appendFile, mkdir, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url'; // 追加
import { Worker } from 'node:worker_threads';
import type {
  DeleteOutboxByIds,
  GetOutboxById,
  GetOutboxSnapshot,
  MarkOutboxCommittedByPath,
  OutboxRow,
  ReadOutboxPending,
  ReleaseOutboxReservation,
  RescheduleOutbox,
  ReserveOutboxPending,
  UpdateOutbox,
  WorkerInit,
  WorkerRequest,
  WorkerResponse,
  WorkerResponseData,
  WriteOutbox,
} from '@shared/types/contracts';
import { app } from 'electron';
import type { FirebaseError } from 'firebase/app';
import type { FirestoreMutationExecutor } from './mutationExecutor';

/**
 * Outbox の削除（掃除）ルールまとめ
 *
 * 背景:
 * - renderer 側は Outbox の snapshot（getOutbox）をポーリングして、mutationId の status が
 *   committed/failed になった件数を数える（進捗表示・待機処理）。
 * - committed/failed を即削除すると snapshot で観測できず、「成功 0/X件」が増えない。
 *
 * 現行ルール:
 * - committed/failed は「即削除しない」(markCommitted / markFailed 内の削除はコメントアウト)
 * - 代わりに OutboxManager 内の定期クリーンアップで削除する
 *   - TTL: committed/failed のうち createdAtMs が一定時間（OUTBOX_SETTLED_TTL_MS）を超えたものを削除
 *   - 上限: 全行数が OUTBOX_MAX_ROWS を超えた場合、committed/failed の古い順に超過分を削除
 * - pending はキューの本体なので削除対象にしない（deleteOutboxCommittedOrFailed は committed/failed のみ削除）
 *
 * 付記:
 * - outbox ログは当面 data を含めない（肥大化/機密混入を避けるため）
 */
const OUTBOX_SETTLED_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3日
const OUTBOX_MAX_ROWS = 100_000;
const OUTBOX_CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10分ごと（必要なら調整）

export type OutboxEntry = {
  mutationId: string;
  path: string;
  kind: 'create' | 'set' | 'update' | 'delete';
  data?: unknown;
  status: 'pending' | 'committed' | 'failed';
  retries: number;
  createdAtMs: number;
  nextAttemptAtMs: number;
  lastError?: string;
  reservedAtMs?: number;
};

export interface Outbox {
  enqueue(
    e: Omit<
      OutboxEntry,
      | 'status'
      | 'retries'
      | 'createdAtMs'
      | 'nextAttemptAtMs'
      | 'lastError'
      | 'reservedAtMs'
    >,
  ): Promise<void>;
  markCommitted(mutationId: string): Promise<void>;
  markFailed(mutationId: string, error?: string): Promise<void>;
  reschedule(
    mutationId: string,
    updates: { retries: number; nextAttemptAtMs: number; lastError?: string },
  ): Promise<void>;
  reservePending(
    batch: number,
    visibilityTimeoutMs: number,
  ): Promise<OutboxEntry[]>;
  releaseReservation(mutationId: string): Promise<void>;
  takePending(batch: number): Promise<OutboxEntry[]>;
  on(
    event: 'changed',
    listener: (
      entry: OutboxEntry,
      kind: 'enqueued' | 'committed' | 'failed' | 'retry',
    ) => void,
  ): this;
  off(
    event: 'changed',
    listener: (
      entry: OutboxEntry,
      kind: 'enqueued' | 'committed' | 'failed' | 'retry',
    ) => void,
  ): this;
  snapshot(): Promise<OutboxEntry[]>;
  markCommittedByPath(path: string): Promise<void>;
}

export class OutboxManager implements Outbox {
  private worker: Worker;
  private ready: Promise<void>;
  private emitter = new EventEmitter();
  private readonly logDir = path.join(
    app.getPath('userData'),
    'logs',
    'outbox',
  );

  private readonly debugOutboxLog = process.env.DEBUG_OUTBOX_LOG === '1';

  // クリーンアップ用フィールド
  private cleanupTimer: NodeJS.Timeout | null = null;
  private cleanupRunning = false;

  // デバッグ出力ヘルパー
  private debugLog(message: string, extra?: unknown) {
    if (!this.debugOutboxLog) return;
    if (extra === undefined) {
      console.log('[outbox-log]', message);
    } else {
      console.log('[outbox-log]', message, extra);
    }
  }

  private logDirReady: Promise<void> | null = null;
  private logQueue: Promise<void> = Promise.resolve();

  private ensureLogDir(): Promise<void> {
    if (!this.logDirReady) {
      this.debugLog('ensureLogDir start', { logDir: this.logDir });

      this.logDirReady = mkdir(this.logDir, { recursive: true }).then(() => {
        this.debugLog('ensureLogDir ok', { logDir: this.logDir });
      });
    }
    return this.logDirReady;
  }

  private getDailyLogPath(atMs: number): string {
    const d = new Date(atMs);
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return path.join(this.logDir, `outbox-${yyyy}-${mm}-${dd}.log`);
  }

  private appendOutboxLog(
    kind: 'enqueued' | 'committed' | 'failed' | 'retry',
    entry: OutboxEntry,
  ): Promise<void> {
    const atMs = Date.now();

    // dataは一旦含めない
    // const line = `${JSON.stringify({ atMs, event: kind, entry })}\n`;
    const { data: _data, ...entryWithoutData } = entry;
    const line = `${JSON.stringify({
      atMs,
      event: kind,
      entry: entryWithoutData,
    })}\n`;

    const task = this.logQueue
      .catch(() => {})
      .then(async () => {
        await this.ensureLogDir();

        const filePath = this.getDailyLogPath(atMs);
        this.debugLog('append start', {
          event: kind,
          mutationId: entry.mutationId,
          path: entry.path,
          filePath,
        });

        await appendFile(filePath, line, 'utf8');

        this.debugLog('append ok', {
          event: kind,
          mutationId: entry.mutationId,
          filePath,
          bytes: Buffer.byteLength(line, 'utf8'),
        });
      })
      .catch((e) => {
        this.debugLog('append ng', {
          event: kind,
          mutationId: entry.mutationId,
          err: e instanceof Error ? e.message : String(e),
        });
        throw e;
      });

    this.logQueue = task;
    return task;
  }

  private async deleteOutboxCommittedOrFailed(
    mutationIds: string[],
  ): Promise<void> {
    if (mutationIds.length === 0) return;
    await this.call({
      type: 'deleteOutboxByIds',
      mutationIds,
    } as DeleteOutboxByIds);
  }

  private async cleanupOutboxTable(): Promise<void> {
    if (this.cleanupRunning) return;
    this.cleanupRunning = true;

    try {
      const all = await this.snapshot();
      if (all.length === 0) return;

      const now = Date.now();
      const ttlCutoff = now - OUTBOX_SETTLED_TTL_MS;

      const settled = all.filter((e) => e.status !== 'pending');

      // 1) TTL超過分（committed/failed）
      const ttlIds = settled
        .filter((e) => e.createdAtMs < ttlCutoff)
        .map((e) => e.mutationId);

      // 2) 最大行数超過分（committed/failedの古い順）
      const excess = all.length - OUTBOX_MAX_ROWS;
      const capIds =
        excess > 0
          ? settled
              .toSorted((a, b) => a.createdAtMs - b.createdAtMs)
              .slice(0, excess)
              .map((e) => e.mutationId)
          : [];

      const ids = Array.from(new Set([...ttlIds, ...capIds]));
      if (ids.length === 0) return;

      await this.deleteOutboxCommittedOrFailed(ids);
      this.debugLog('cleanupOutboxTable ok', {
        total: all.length,
        settled: settled.length,
        deleted: ids.length,
        ttlDeleted: ttlIds.length,
        capDeleted: capIds.length,
      });
    } catch (e) {
      console.warn('outbox table cleanup failed', e);
    } finally {
      this.cleanupRunning = false;
    }
  }

  private startCleanupLoop() {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      void this.cleanupOutboxTable();
    }, OUTBOX_CLEANUP_INTERVAL_MS);

    // 起動直後にも一回掃除（重くしたくなければ削除OK）
    void this.cleanupOutboxTable();
  }

  private async cleanupOldOutboxLogs(): Promise<void> {
    const cutoffMs = Date.now() - 365 * 24 * 60 * 60 * 1000;

    let names: string[];
    try {
      names = await readdir(this.logDir);
    } catch (e: unknown) {
      const code = (e as { code?: string } | null)?.code;
      if (code === 'ENOENT') return;
      throw e;
    }

    const re = /^outbox-(\d{4})-(\d{2})-(\d{2})\.log$/;

    for (const name of names) {
      const m = re.exec(name);
      if (!m) continue;

      const yyyy = Number(m[1]);
      const mm = Number(m[2]);
      const dd = Number(m[3]);

      const fileDayMs = new Date(yyyy, mm - 1, dd).getTime();
      if (Number.isNaN(fileDayMs)) continue;

      if (fileDayMs < cutoffMs) {
        await unlink(path.join(this.logDir, name)).catch(() => {});
      }
    }
  }

  // コンストラクタでワーカー起動し、DB 初期化
  constructor() {
    this.debugLog('boot', {
      appName: app.getName(),
      isPackaged: app.isPackaged,
      userData: app.getPath('userData'),
      logDir: this.logDir,
      todayLogPath: this.getDailyLogPath(Date.now()),
    });

    const workerPath = fileURLToPath(
      new URL('./gb.worker.js', import.meta.url),
    );
    this.worker = new Worker(workerPath);

    const dbPath = path.join(app.getPath('userData'), 'app.db');
    void this.call({ type: 'init', dbPath } as WorkerInit).catch((e) => {
      console.error('Failed to initialize Outbox worker', e);
    });

    this.ready = this.call({ type: 'init', dbPath } as WorkerInit)
      .then(() => {})
      .catch((e) => {
        console.error('Failed to initialize Outbox worker', {
          dbPath,
          error: e,
        });
        throw e;
      });

    void this.cleanupOldOutboxLogs().catch((e) => {
      console.warn('outbox log cleanup failed', e);
    });
    void this.ready.then(() => {
      this.startCleanupLoop();
    });
  }

  on(
    event: 'changed',
    listener: (
      entry: OutboxEntry,
      kind: 'enqueued' | 'committed' | 'failed' | 'retry',
    ) => void,
  ): this {
    if (event === 'changed') {
      this.emitter.on('changed', listener);
    }
    return this;
  }

  // 変更: Outbox の 'changed' イベント購読解除を実装
  off(
    event: 'changed',
    listener: (
      entry: OutboxEntry,
      kind: 'enqueued' | 'committed' | 'failed' | 'retry',
    ) => void,
  ): this {
    if (event === 'changed') {
      this.emitter.off('changed', listener);
    }
    return this;
  }

  // メッセージ呼び出しヘルパー
  private call<M extends WorkerRequest>(
    msg: M,
  ): Promise<WorkerResponseData<M>> {
    const run = () =>
      new Promise<WorkerResponseData<M>>((resolve, reject) => {
        // 簡易な requestId 生成（重複しにくい文字列）
        const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const payload = { ...msg, requestId } as unknown as M & {
          requestId: string;
        };

        const onMessage = (res: WorkerResponse) => {
          if (res.requestId !== requestId) {
            return;
          }

          this.worker.off('message', onMessage);
          this.worker.off('error', onError);
          if (res.ok) {
            resolve(res.data as WorkerResponseData<M>);
          } else {
            reject(new Error(res.error));
          }
        };
        const onError = (err: unknown) => {
          this.worker.off('message', onMessage);
          this.worker.off('error', onError);
          reject(err instanceof Error ? err : new Error(String(err)));
        };
        this.worker.on('message', onMessage);
        this.worker.on('error', onError);
        this.worker.postMessage(payload);
      });
    if (msg.type === 'init') return run();
    return this.ready.then(run);
  }

  // 内部用のイベント発火ヘルパー
  private emitChanged(
    entry: OutboxEntry,
    kind: 'enqueued' | 'committed' | 'failed' | 'retry',
  ) {
    this.emitter.emit('changed', entry, kind);
  }
  // DB 行 -> OutboxEntry 変換（スキーマ差異を吸収）
  // 変更: unknown な row に対して直接プロパティアクセスすると型エラーになるため、
  //       安全に Record<string, any> にキャストしてからアクセスします。
  private mapRowToEntry(row: OutboxRow): OutboxEntry {
    if (!row || typeof row !== 'object') {
      throw new Error('Invalid outbox row');
    }
    const r = row;
    if (r.mutation_id === undefined) {
      throw new Error('Invalid outbox row');
    }
    const mutationId = r.mutation_id;
    if (typeof mutationId !== 'string') {
      throw new Error('Invalid outbox row: missing mutationId');
    }
    const path = r.path;
    if (typeof path !== 'string') {
      throw new Error('Invalid outbox row: missing path');
    }
    const kind = r.kind;
    if (
      kind !== 'create' &&
      kind !== 'set' &&
      kind !== 'update' &&
      kind !== 'delete'
    ) {
      throw new Error('Invalid outbox row: invalid kind');
    }
    const status = r.status;
    if (status !== 'pending' && status !== 'committed' && status !== 'failed') {
      throw new Error('Invalid outbox row: invalid status');
    }
    let data: unknown = r.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        // 破損時はそのまま（後段で toErrorMessage 等で扱えるようにする）
      }
    }
    return {
      mutationId: mutationId,
      path: path,
      kind: kind,
      data: data,
      status: status,
      retries: r.retries ?? 0,
      createdAtMs: r.created_at_ms ?? Date.now(),
      nextAttemptAtMs: r.next_attempt_at_ms ?? r.created_at_ms ?? Date.now(),
      lastError: r.last_error ?? undefined,
      reservedAtMs: r.reserved_at_ms ?? undefined,
    };
  }

  // 単一エントリ取得（ワーカー経由）
  private async getOutboxById(mutationId: string): Promise<OutboxEntry | null> {
    const row = await this.call({
      type: 'getOutboxById',
      mutationId,
    } as GetOutboxById);
    return row ? this.mapRowToEntry(row) : null;
  }

  // 既存のヘルパーをワーカー版に切り替え
  private async getEntryById(mutationId: string): Promise<OutboxEntry | null> {
    return this.getOutboxById(mutationId);
  }

  async enqueue(
    e: Omit<
      OutboxEntry,
      | 'status'
      | 'retries'
      | 'createdAtMs'
      | 'nextAttemptAtMs'
      | 'lastError'
      | 'reservedAtMs'
    >,
  ): Promise<void> {
    await this.call({ type: 'writeOutbox', entry: e } as WriteOutbox);

    const entry: OutboxEntry = {
      ...e,
      status: 'pending',
      retries: 0,
      createdAtMs: Date.now(),
      nextAttemptAtMs: Date.now(),
    };

    await this.appendOutboxLog('enqueued', entry).catch((err) => {
      console.warn('outbox log append failed (enqueued)', err);
    });

    this.emitChanged(entry, 'enqueued');
  }

  async markCommitted(mutationId: string): Promise<void> {
    await this.call({
      type: 'updateOutbox',
      mutationId,
      status: 'committed',
    } as UpdateOutbox);
    const entry = await this.getEntryById(mutationId);
    if (!entry) return;

    try {
      await this.appendOutboxLog('committed', entry);
      // await this.deleteOutboxCommittedOrFailed([mutationId]);
    } catch (e) {
      console.warn('outbox commit log/delete failed', e);
    }

    this.emitChanged(entry, 'committed');
  }

  async markCommittedByPath(path: string): Promise<void> {
    const rows = await this.call({
      type: 'markOutboxCommittedByPath',
      path,
    } as MarkOutboxCommittedByPath);
    // 正規化して 'committed' を通知
    const entries = rows.map((row) => this.mapRowToEntry(row));
    if (entries.length === 0) return;

    try {
      for (const entry of entries) {
        await this.appendOutboxLog('committed', entry);
      }
      // await this.deleteOutboxCommittedOrFailed(entries.map((e) => e.mutationId),);
    } catch (e) {
      console.warn('outbox committedByPath log/delete failed', e);
    }

    for (const entry of entries) {
      this.emitChanged(entry, 'committed');
    }
  }

  async markFailed(mutationId: string, error?: string): Promise<void> {
    await this.call({
      type: 'updateOutbox',
      mutationId,
      status: 'failed',
      lastError: error,
    } as UpdateOutbox);
    const entry = await this.getEntryById(mutationId);
    if (!entry) return;

    try {
      await this.appendOutboxLog('failed', entry);
      // await this.deleteOutboxCommittedOrFailed([mutationId]);
    } catch (e) {
      console.warn('outbox failed log/delete failed', e);
    }

    this.emitChanged(entry, 'failed');
  }

  async reschedule(
    mutationId: string,
    updates: { retries: number; nextAttemptAtMs: number; lastError?: string },
  ): Promise<void> {
    await this.call({
      type: 'rescheduleOutbox',
      mutationId,
      retries: updates.retries,
      nextAttemptAtMs: updates.nextAttemptAtMs,
      lastError: updates.lastError,
    } as RescheduleOutbox);

    const entry = await this.getEntryById(mutationId);
    if (!entry) return;

    await this.appendOutboxLog('retry', entry).catch((err) => {
      console.warn('outbox log append failed (retry)', err);
    });

    this.emitChanged(entry, 'retry');
  }

  async reservePending(
    batch: number,
    visibilityTimeoutMs: number,
  ): Promise<OutboxEntry[]> {
    const rows = await this.call({
      type: 'reserveOutboxPending',
      limit: batch,
      visibilityTimeoutMs,
    } as ReserveOutboxPending);

    if (!Array.isArray(rows)) {
      console.warn('reservePending: non-array response detected', rows);
      return [];
    }
    return rows.map((r) => this.mapRowToEntry(r));
  }

  async releaseReservation(mutationId: string): Promise<void> {
    await this.call({
      type: 'releaseOutboxReservation',
      mutationId,
    } as ReleaseOutboxReservation);
  }

  async takePending(batch: number): Promise<OutboxEntry[]> {
    const rows = await this.call({
      type: 'readOutboxPending',
      limit: batch,
    } as ReadOutboxPending);
    if (!Array.isArray(rows)) {
      console.warn('takePending: non-array response detected', rows);
      return [];
    }
    return rows.map((r) => this.mapRowToEntry(r));
  }

  async snapshot(): Promise<OutboxEntry[]> {
    const rows = await this.call({
      type: 'getOutboxSnapshot',
    } as GetOutboxSnapshot);
    if (!Array.isArray(rows)) {
      console.warn('snapshot: non-array response detected', rows);
      return [];
    }
    return rows.map((r) => this.mapRowToEntry(r));
  }

  dispose() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.worker.terminate().catch(() => {});
  }
}

// 送信キューの処理を行うランナー
export class OutboxRunner {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly outbox: Outbox,
    private readonly executor: FirestoreMutationExecutor,
    private readonly opts: {
      intervalMs?: number;
      batch?: number;
      baseBackoffMs?: number;
      capBackoffMs?: number;
      visibilityTimeoutMs?: number;
    } = {},
  ) {}

  start() {
    if (this.timer) return;
    const interval = this.opts.intervalMs ?? 1000;
    this.timer = setInterval(() => void this.tick(), interval);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const batch = this.opts.batch ?? 8;
      const vt = this.opts.visibilityTimeoutMs ?? 30_000; // 既定30秒
      // 予約を取得
      const items = await this.outbox.reservePending(batch, vt);
      for (const it of items) {
        await this.apply(it);
      }
    } catch (e) {
      console.error('OutboxRunner tick error', e);
    } finally {
      this.running = false;
    }
  }

  private async apply(it: OutboxEntry) {
    try {
      await this.executor.execute({
        kind: it.kind,
        path: it.path,
        data: it.data,
      });
      await this.outbox.markCommitted(it.mutationId);
    } catch (e: unknown) {
      const kind = classifyFirestoreError(e);
      if (kind === 'retry') {
        const base = this.opts.baseBackoffMs ?? 1000;
        const cap = this.opts.capBackoffMs ?? 30_000;
        const delay = computeBackoffMs(it.retries, base, cap);
        await this.outbox.reschedule(it.mutationId, {
          retries: it.retries + 1,
          nextAttemptAtMs: Date.now() + delay,
          lastError: toErrorMessage(e),
        });
      } else {
        await this.outbox.markFailed(it.mutationId, toErrorMessage(e));
      }
    }
  }
}

// --- 以下は Runner 内部で使うヘルパー ---

// ユーザー定義型ガード（ダックタイピング）
function isFirebaseError(err: unknown): err is FirebaseError {
  if (typeof err !== 'object' || err === null) return false;
  const anyErr = err;
  return Object.hasOwn(anyErr, 'code') && Object.hasOwn(anyErr, 'message');
}

function getFirebaseCode(err: unknown): string | undefined {
  if (isFirebaseError(err)) return err.code;
  if (typeof err !== 'object' || !err) return undefined;

  const err2 = err as { code?: undefined; message?: undefined };
  if (err2.code && typeof err2.code === 'string') return err2.code;
  if (err2.message && typeof err2.message === 'string') return err2.message;
  return undefined;
}

function toErrorMessage(err: unknown): string {
  if (isFirebaseError(err)) return err.message;
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function looksLikeNetworkError(err: unknown): boolean {
  const msg = toErrorMessage(err).toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('timeout') ||
    msg.includes('temporarily') ||
    msg.includes('econnrefused') ||
    msg.includes('unavailable')
  );
}

function classifyFirestoreError(err: unknown): 'retry' | 'fail' {
  const code = getFirebaseCode(err);
  switch (code) {
    // 再試行すべきエラー
    case 'aborted':
    case 'deadline-exceeded':
    case 'internal':
    case 'resource-exhausted':
    case 'unavailable':
    case 'unknown':
    case 'auth/quota-exceeded':
      return 'retry';
    // ここからは恒久エラー（UIガイダンスなどへ）
    case 'permission-denied':
    case 'unauthenticated':
    case 'invalid-argument':
    case 'failed-precondition':
    case 'not-found':
    case 'already-exists':
    case 'out-of-range':
    case 'unimplemented':
    case 'data-loss':
      return 'fail';
    default:
      // code が取れない場合はメッセージでネットワーク由来を推定
      return looksLikeNetworkError(err) ? 'retry' : 'fail';
  }
}

// フルジッタ付き指数バックオフ
function computeBackoffMs(retries: number, baseMs = 1000, capMs = 30_000) {
  const exp = Math.min(capMs, baseMs * 2 ** retries); // 1s,2s,4s,...
  const jitter = Math.random() * exp; // [0, exp)
  return Math.min(capMs, jitter);
}
