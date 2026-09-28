import { createHash, randomBytes } from 'node:crypto';
import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path, { extname } from 'node:path';
import {
  ensureAuthClaims,
  firestore,
  functions,
  storage,
} from '@main/services/firebase';
import { StartupError } from '@main/startup/fatalStartup';
import type {
  AssetKey,
  AssetLoadFailureResult,
  AssetLoadReport,
  AssetLoadSuccessResult,
  AssetReadyNotice,
  AssetReplaceResult,
  AssetRequestFailure,
  AssetUploadResult,
} from '@shared/types/assets';
import {
  ASSET_KEY_PATTERN,
  ASSET_RECOVERY_TOKEN_PATTERN,
  ASSET_VERSION_PATTERN,
  AssetChannels,
} from '@shared/types/assets';
import type { AssetData, GradeId, TestSubject } from '@shared/types/contracts';
import {
  BrowserWindow,
  type BrowserWindow as BrowserWindowType,
  session,
} from 'electron';
import { type DocumentData, doc as fsDoc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  deleteObject,
  type FullMetadata,
  getMetadata,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';
import { AssetDB, type AssetRow } from './db';
import { downloadWithVerify } from './downloader';
import {
  type AssetRootInfo,
  buildAssetFilePath,
  ensureGradeDirectory,
  initializeAssetRoot,
  isAssetFileSecurityFailure,
  resolveAssetVersion,
  verifyAssetFile,
  verifyClearTarget,
  verifyDirectoryForRemoval,
} from './localAsset';
import { ReadWriteGate } from './rwGate';

/** メタ取得結果（設計4.7） */
export type AssetMetaResolveResult =
  | { kind: 'found-active'; data: AssetData }
  | { kind: 'found-deleted'; data?: AssetData }
  | { kind: 'not-found' }
  | { kind: 'unavailable'; error: unknown };

export type AssetMetaResolver = (
  key: AssetKey,
) => Promise<AssetMetaResolveResult>;

type DeleteFirestoreAssetDoc = (path: string) => Promise<void>;

type RecordAssetMetric = (
  action:
    | { type: 'local-file-hit' }
    | { type: 'local-file-miss' }
    | { type: 'download'; bytes: number }
    | { type: 'meta-cache-hit' }
    | { type: 'meta-invalidation'; reason: string },
) => void;

/** 他クライアントの変更通知（設計6.4） */
export type AssetChangeNotice = {
  grade: GradeId;
  key: string;
  deleted: boolean;
  updatedAtMs: number | null;
  md5Hash?: string;
  objectPath?: string;
  contentType?: string;
  size?: number;
};

/** protocol handler へ返す判定結果（設計2.3） */
export type AssetProtocolResolution =
  | { kind: 'file'; filePath: string; size: number; contentType: string }
  | { kind: 'not-found' }
  | { kind: 'unavailable' };

export type AssetRequestOutcome = {
  ready: AssetReadyNotice[];
  pending: AssetKey[];
  failed: AssetRequestFailure[];
};

/** キューへ積む処理（設計4.3） */
type AssetJobKind = 'download' | 'confirm-meta';

type AssetQueueEntry = {
  asset: AssetKey;
  generation: number;
  clearGeneration: number;
  kind: AssetJobKind;
  priority: number;
  sequence: number;
  downloadAfterConfirm?: boolean;
};

/** 表示回復状態（設計5.3） */
type DisplayRecoveryPhase =
  | 'idle'
  | 'downloading'
  | 'awaiting-load'
  | 'exhausted';

type DisplayRecoveryState = {
  phase: DisplayRecoveryPhase;
  acceptedFailureCount: number;
  failedSourceToken: string | null;
  activeRecoveryToken?: string;
};

type RequestItemResolution =
  | { kind: 'ready'; notice: AssetReadyNotice }
  | { kind: 'pending' }
  | { kind: 'failed'; failure: AssetRequestFailure };

type RequestWaiter = {
  asset: AssetKey;
  resolve: (resolution: RequestItemResolution) => void;
};

type RunningJob = {
  entry: AssetQueueEntry;
  waiters: RequestWaiter[];
};

type FollowUpJob = {
  generation: number;
  kinds: Set<AssetJobKind>;
  priority: number;
  downloadAfterConfirm: boolean;
  waiters: RequestWaiter[];
};

type DownloadOutcome =
  | { kind: 'succeeded' }
  | { kind: 'invalidated' }
  | { kind: 'deleted' }
  | { kind: 'not-found' }
  | { kind: 'meta-changed' }
  | { kind: 'failed'; retryable: boolean; message: string };

type ConfirmOutcome =
  | { kind: 'active-ready'; notice: AssetReadyNotice }
  | { kind: 'active-needs-download' }
  | { kind: 'deleted' }
  | { kind: 'not-found' }
  | { kind: 'invalidated' }
  | { kind: 'failed'; retryable: boolean; message: string };

type JobOutcome = DownloadOutcome | ConfirmOutcome;

export const AssetJobPriority = {
  confirmMeta: 50,
  displayMiss: 40,
  metaChanged: 35,
  localReadFailed: 30,
  prioritize: 20,
  request: 10,
} as const;

const MAX_QUEUE_RETRIES = 2;
const MAX_DISPLAY_RECOVERIES = 2;

const toTimestampMillis = (value: unknown): number | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as {
    toMillis?: () => number;
    seconds?: unknown;
    nanoseconds?: unknown;
  };

  if (typeof candidate.toMillis === 'function') {
    return candidate.toMillis();
  }

  if (typeof candidate.seconds === 'number') {
    const nanoseconds =
      typeof candidate.nanoseconds === 'number' ? candidate.nanoseconds : 0;
    return candidate.seconds * 1000 + Math.floor(nanoseconds / 1_000_000);
  }

  return null;
};

function generate33CharId(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  const bytes = randomBytes(33);
  let id = '';
  for (let i = 0; i < bytes.length && id.length < 33; i += 1) {
    id += chars[bytes[i] % chars.length];
  }
  return id.slice(0, 33);
}

const metaDataOf = (result: AssetMetaResolveResult): AssetData | undefined =>
  result.kind === 'found-active' || result.kind === 'found-deleted'
    ? result.data
    : undefined;

/**
 * ダウンロード失敗を再試行対象かどうかに分類する（設計4.4）。
 * 恒久的な失敗だけを再試行対象外にし、判別できない失敗は上限付きで再試行する。
 */
export const isRetryableDownloadFailure = (error: unknown): boolean => {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  if (['ENOSPC', 'EACCES', 'EPERM', 'EROFS'].includes(code)) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  if (/object-not-found|\b404\b|not found/i.test(message)) {
    return false;
  }
  if (/\b401\b|\b403\b|permission|unauthorized|forbidden/i.test(message)) {
    return false;
  }
  return true;
};

export type AssetManagerDeps = {
  mainWindow: BrowserWindowType;
  /** 通常のcache-firstメタ取得 */
  resolveMeta: AssetMetaResolver;
  /** SDK cacheを使わないサーバー確認（設計4.6） */
  resolveMetaFromServer: AssetMetaResolver;
  deleteFirestoreAssetDoc?: DeleteFirestoreAssetDoc;
  recordAssetMetric?: RecordAssetMetric;
  options?: {
    concurrency?: number;
    expiresSec?: number;
  };
};

/**
 * アセットルート検証とAssetDB openが成功した場合だけ AssetManager を返す（設計4.2）。
 * 失敗はphase付きStartupErrorとして投げ、共通の起動失敗処理へ渡す。
 */
export async function createAssetManager(params: {
  userDataPath: string;
  dbPath: string;
  deps: AssetManagerDeps;
}): Promise<AssetManager> {
  const root = await initializeAssetRoot(params.userDataPath);

  let db: AssetDB;
  try {
    db = new AssetDB(params.dbPath);
  } catch (e) {
    throw new StartupError('asset-db-open', 'failed to open asset database', {
      cause: e,
    });
  }

  return new AssetManager(root, db, params.deps);
}

export class AssetManager {
  private mainWindow: BrowserWindowType;
  private readonly resolveMeta: AssetMetaResolver;
  private readonly resolveMetaFromServer: AssetMetaResolver;
  private readonly deleteFirestoreAssetDoc?: DeleteFirestoreAssetDoc;
  private readonly recordAssetMetric?: RecordAssetMetric;
  private readonly options: Required<NonNullable<AssetManagerDeps['options']>>;

  private readonly gate = new ReadWriteGate();
  private waiting: AssetQueueEntry[] = [];
  private runningJobs = new Map<string, RunningJob>();
  private followUps = new Map<string, FollowUpJob>();
  private retryCounts = new Map<string, number>();
  private generations = new Map<string, number>();
  private recoveryStates = new Map<string, DisplayRecoveryState>();
  private lastProgAt = new Map<string, number>();
  private nextSequence = 1;
  private runningCount = 0;
  private disposed = false;

  /** clearCache 中に完了した旧処理を無効化するための全体世代（設計7.1） */
  private clearGeneration = 0;
  /** clearCache 中は protocol 判定を待たせる（設計2.3） */
  private clearBarrier: Promise<void> | null = null;
  /** 変更通知を受信順に直列化する（設計6.4） */
  private notificationChain: Promise<void> = Promise.resolve();
  private changeSubscriptions: Array<() => void> = [];

  private signedUrl = httpsCallable<
    { objectPath: string; expiresSec?: number },
    { url: string }
  >(functions, 'getSignedUrl');

  constructor(
    private readonly root: AssetRootInfo,
    private readonly db: AssetDB,
    deps: AssetManagerDeps,
  ) {
    this.mainWindow = deps.mainWindow;
    this.resolveMeta = deps.resolveMeta;
    this.resolveMetaFromServer = deps.resolveMetaFromServer;
    this.deleteFirestoreAssetDoc = deps.deleteFirestoreAssetDoc;
    this.recordAssetMetric = deps.recordAssetMetric;
    this.options = {
      concurrency: deps.options?.concurrency ?? 3,
      expiresSec: deps.options?.expiresSec ?? 900,
    };
  }

  // -------------------------------------------------------------------------
  // 基本ユーティリティ
  // -------------------------------------------------------------------------

  private keyOf(it: AssetKey): string {
    return `${it.grade}/${it.key}`;
  }

  private getGeneration(it: AssetKey): number {
    return this.generations.get(this.keyOf(it)) ?? 0;
  }

  private bumpGeneration(it: AssetKey): number {
    const next = this.getGeneration(it) + 1;
    this.generations.set(this.keyOf(it), next);
    return next;
  }

  private isEntryCurrent(entry: {
    asset: AssetKey;
    generation: number;
    clearGeneration: number;
  }): boolean {
    return (
      !this.disposed &&
      entry.clearGeneration === this.clearGeneration &&
      this.getGeneration(entry.asset) === entry.generation
    );
  }

  private retryKey(entry: AssetQueueEntry): string {
    return `${this.keyOf(entry.asset)}|${entry.generation}|${entry.kind}`;
  }

  private recoveryKey(it: AssetKey, version: string | undefined): string {
    return JSON.stringify([it.grade, it.key, version ?? null]);
  }

  private currentVersion(it: AssetKey): string | undefined {
    return resolveAssetVersion(this.db.get(it.grade, it.key));
  }

  private filePathOf(it: AssetKey): string {
    return buildAssetFilePath(this.root.root, it.grade, it.key);
  }

  /** 現在versionに紐づく有効なrecoveryTokenがあれば返す（設計3.3） */
  private activeTokenFor(it: AssetKey, version: string | undefined) {
    return this.recoveryStates.get(this.recoveryKey(it, version))
      ?.activeRecoveryToken;
  }

  updateMainWindow(mainWindow: BrowserWindowType) {
    this.mainWindow = mainWindow;
  }

  registerChangeSubscription(unsubscribe: () => void) {
    this.changeSubscriptions.push(unsubscribe);
  }

  private buildReadyNotice(
    it: AssetKey,
    row: AssetRow | undefined,
  ): AssetReadyNotice {
    const version = resolveAssetVersion(row);
    return {
      grade: it.grade,
      key: it.key,
      contentType: row?.content_type ?? 'image/png',
      ...(version ? { version } : {}),
      ...(this.activeTokenFor(it, version)
        ? { recoveryToken: this.activeTokenFor(it, version) }
        : {}),
    };
  }

  private sendReady(item: AssetReadyNotice) {
    const windows = BrowserWindow.getAllWindows();
    const targets = windows.includes(this.mainWindow)
      ? windows
      : [this.mainWindow, ...windows];
    const sentContents = new Set<object>();

    for (const targetWindow of targets) {
      if (targetWindow.isDestroyed()) {
        continue;
      }

      const contents = targetWindow.webContents;
      if (contents.isDestroyed()) {
        continue;
      }

      const contentKey = contents as unknown as object;
      if (sentContents.has(contentKey)) {
        continue;
      }

      sentContents.add(contentKey);
      contents.send(AssetChannels.ready, item);
    }
  }

  private sendError(it: AssetKey, message: string) {
    if (
      this.mainWindow.isDestroyed() ||
      this.mainWindow.webContents.isDestroyed()
    ) {
      return;
    }
    this.mainWindow.webContents.send(AssetChannels.error, {
      grade: it.grade,
      key: it.key,
      message,
    });
  }

  // -------------------------------------------------------------------------
  // キュー（設計4.3）
  // -------------------------------------------------------------------------

  private sortWaiting() {
    // priority降順 → sequence昇順
    this.waiting.sort((a, b) =>
      b.priority !== a.priority
        ? b.priority - a.priority
        : (a.sequence ?? 0) - (b.sequence ?? 0),
    );
  }

  /**
   * キューへ登録する。同一画像・同一世代の重複要求は1件へまとめる。
   * 待機中downloadへ確認要求が来た場合はconfirm-metaへ置き換え、
   * downloadAfterConfirm を保持する（設計4.6）。
   */
  private enqueue(params: {
    asset: AssetKey;
    kind: AssetJobKind;
    priority: number;
    downloadAfterConfirm?: boolean;
    waiters?: RequestWaiter[];
  }): void {
    if (this.disposed) {
      for (const waiter of params.waiters ?? []) {
        waiter.resolve(
          this.unavailableResolution(params.asset, 'asset manager disposed'),
        );
      }
      return;
    }

    const { asset, kind, priority } = params;
    const key = this.keyOf(asset);
    const generation = this.getGeneration(asset);

    const running = this.runningJobs.get(key);
    if (running) {
      if (running.entry.generation === generation) {
        // 同一世代なら現在処理へ合流する。
        if (
          running.entry.kind === 'confirm-meta' &&
          kind === 'download' &&
          (params.waiters?.length ?? 0) > 0
        ) {
          running.entry.downloadAfterConfirm = true;
        }
        if (kind === 'download') {
          running.entry.downloadAfterConfirm =
            running.entry.downloadAfterConfirm ||
            Boolean(params.downloadAfterConfirm);
        }
        if (running.entry.kind === kind || kind !== 'confirm-meta') {
          running.waiters.push(...(params.waiters ?? []));
          return;
        }
        // 実行中downloadへ確認が必要になった場合は、後続処理として確認を残す。
      } else {
        // 世代が変わった要求は後続処理として1件だけ保持する。
      }

      this.mergeFollowUp({
        asset,
        generation,
        kind,
        priority,
        downloadAfterConfirm: params.downloadAfterConfirm,
        waiters: params.waiters,
      });
      return;
    }

    const waitingIndex = this.waiting.findIndex(
      (entry) => this.keyOf(entry.asset) === key,
    );

    if (waitingIndex >= 0) {
      const existing = this.waiting[waitingIndex];
      existing.generation = generation;
      existing.clearGeneration = this.clearGeneration;
      existing.priority = Math.max(existing.priority, priority);
      if (kind === 'confirm-meta' && existing.kind === 'download') {
        // 待機中downloadは確認へ置き換え、download要否を保持する。
        existing.kind = 'confirm-meta';
        existing.downloadAfterConfirm = true;
      } else if (kind === 'download' && existing.kind === 'confirm-meta') {
        existing.downloadAfterConfirm = true;
      }
      if (params.downloadAfterConfirm) {
        existing.downloadAfterConfirm = true;
      }
      for (const waiter of params.waiters ?? []) {
        this.attachWaiterToWaiting(existing, waiter);
      }
      this.sortWaiting();
      this.pump();
      return;
    }

    const entry: AssetQueueEntry = {
      asset,
      generation,
      clearGeneration: this.clearGeneration,
      kind,
      priority,
      sequence: this.nextSequence++,
      downloadAfterConfirm: params.downloadAfterConfirm,
    };

    // 完了待ちを先に登録してからキューへ入れる（設計4.3）。
    if (params.waiters?.length) {
      this.pendingWaiters.set(this.waitingWaiterKey(entry), [
        ...params.waiters,
      ]);
    }

    this.waiting.push(entry);
    this.sortWaiting();
    this.pump();
  }

  /** 待機中entryに紐づくrequest完了待ち */
  private pendingWaiters = new Map<string, RequestWaiter[]>();

  private waitingWaiterKey(entry: AssetQueueEntry): string {
    return `${this.keyOf(entry.asset)}|${entry.sequence}`;
  }

  private attachWaiterToWaiting(
    entry: AssetQueueEntry,
    waiter: RequestWaiter,
  ): void {
    const key = this.waitingWaiterKey(entry);
    const list = this.pendingWaiters.get(key) ?? [];
    list.push(waiter);
    this.pendingWaiters.set(key, list);
  }

  private takeWaitingWaiters(entry: AssetQueueEntry): RequestWaiter[] {
    const key = this.waitingWaiterKey(entry);
    const list = this.pendingWaiters.get(key) ?? [];
    this.pendingWaiters.delete(key);
    return list;
  }

  private mergeFollowUp(params: {
    asset: AssetKey;
    generation: number;
    kind: AssetJobKind;
    priority: number;
    downloadAfterConfirm?: boolean;
    waiters?: RequestWaiter[];
  }): void {
    const key = this.keyOf(params.asset);
    const existing = this.followUps.get(key);

    if (!existing || existing.generation !== params.generation) {
      // 最新世代の後続処理だけを保持する。旧世代の待機requestは取消として完了する。
      if (existing) {
        for (const waiter of existing.waiters) {
          waiter.resolve(
            this.unavailableResolution(
              params.asset,
              'superseded by newer generation',
            ),
          );
        }
      }
      this.followUps.set(key, {
        generation: params.generation,
        kinds: new Set([params.kind]),
        priority: params.priority,
        downloadAfterConfirm: Boolean(params.downloadAfterConfirm),
        waiters: [...(params.waiters ?? [])],
      });
      return;
    }

    // kind は縮退させない（確認が必要な要求をdownloadへ落とさない）。
    existing.kinds.add(params.kind);
    existing.priority = Math.max(existing.priority, params.priority);
    existing.downloadAfterConfirm =
      existing.downloadAfterConfirm || Boolean(params.downloadAfterConfirm);
    existing.waiters.push(...(params.waiters ?? []));
  }

  private pump(): void {
    while (
      !this.disposed &&
      this.runningCount < this.options.concurrency &&
      this.waiting.length > 0
    ) {
      const entry = this.waiting.shift();
      if (!entry) break;

      const waiters = this.takeWaitingWaiters(entry);

      if (!this.isEntryCurrent(entry)) {
        for (const waiter of waiters) {
          waiter.resolve(
            this.unavailableResolution(entry.asset, 'canceled before start'),
          );
        }
        continue;
      }

      const key = this.keyOf(entry.asset);
      const running: RunningJob = { entry, waiters };
      this.runningJobs.set(key, running);
      this.runningCount += 1;

      void this.runJob(running).finally(() => {
        this.runningCount -= 1;
        this.pump();
      });
    }
  }

  private async runJob(running: RunningJob): Promise<void> {
    const { entry } = running;
    let outcome: JobOutcome;

    try {
      if (entry.kind === 'confirm-meta') {
        outcome = await this.confirmMeta(entry);
      } else {
        outcome = await this.downloadOne(entry);
      }
    } catch (e) {
      // worker の例外を握りつぶさず構造化failureへ変換する（設計4.3）。
      const message = e instanceof Error ? e.message : String(e);
      console.warn('[assets] unexpected worker failure', entry.asset, message);
      outcome = { kind: 'failed', retryable: false, message };
    }

    this.finishJob(running, outcome);
  }

  /**
   * 全終了経路で待機requestを完了し、実行中管理を解除する（設計4.3）。
   * 後続処理はキュー再試行より先に登録する（設計4.5）。
   */
  private finishJob(running: RunningJob, outcome: JobOutcome): void {
    const { entry, waiters } = running;
    const key = this.keyOf(entry.asset);
    this.runningJobs.delete(key);

    const isCurrentEntry = this.isEntryCurrent(entry);
    const retryAttempts = this.retryCounts.get(this.retryKey(entry)) ?? 0;

    // 再試行する中間失敗では待機requestを完了しない（設計4.3の終了経路に中間失敗は含まれない）。
    // 待機者は再試行jobへ引き継ぎ、成功・最終失敗・削除・不存在・取消のいずれかで初めて完了する。
    const willRetry =
      outcome.kind === 'failed' &&
      isCurrentEntry &&
      outcome.retryable &&
      retryAttempts < MAX_QUEUE_RETRIES;

    if (!willRetry) {
      const resolution = this.resolutionForOutcome(entry, outcome);
      for (const waiter of waiters) {
        waiter.resolve(resolution);
      }
    }

    if (outcome.kind === 'succeeded' || outcome.kind === 'active-ready') {
      this.retryCounts.delete(this.retryKey(entry));
    }

    const isCurrent = this.isEntryCurrent(entry);

    // 後続処理（世代が進んだ要求）を先に登録する。
    const followUp = this.followUps.get(key);
    if (followUp && followUp.generation === this.getGeneration(entry.asset)) {
      this.followUps.delete(key);
      const kinds: AssetJobKind[] = followUp.kinds.has('confirm-meta')
        ? ['confirm-meta']
        : [...followUp.kinds];
      // 待機者は最初に登録するjobへまとめて引き継ぐ
      let waitersToAttach: RequestWaiter[] | undefined = [...followUp.waiters];
      for (const kind of kinds) {
        this.enqueue({
          asset: entry.asset,
          kind,
          priority: followUp.priority,
          downloadAfterConfirm:
            followUp.downloadAfterConfirm || followUp.kinds.has('download'),
          waiters: waitersToAttach,
        });
        waitersToAttach = undefined;
      }
    } else if (
      followUp &&
      followUp.generation !== this.getGeneration(entry.asset)
    ) {
      this.followUps.delete(key);
      for (const waiter of followUp.waiters) {
        waiter.resolve(
          this.unavailableResolution(
            entry.asset,
            'follow-up generation changed',
          ),
        );
      }
    }

    if (outcome.kind === 'meta-changed' && isCurrent) {
      this.enqueue({
        asset: entry.asset,
        kind: 'download',
        priority: AssetJobPriority.metaChanged,
      });
      return;
    }

    if (outcome.kind === 'active-needs-download' && isCurrent) {
      // 確認の優先度50をdownloadへ引き継がず、新しいsequenceの別jobにする（設計4.6）。
      this.enqueue({
        asset: entry.asset,
        kind: 'download',
        priority: AssetJobPriority.displayMiss,
      });
      return;
    }

    if (outcome.kind !== 'failed') {
      return;
    }

    if (!isCurrent) {
      this.retryCounts.delete(this.retryKey(entry));
      return;
    }

    if (!outcome.retryable) {
      this.failFinally(entry, outcome.message);
      return;
    }

    const retryKey = this.retryKey(entry);
    if (retryAttempts >= MAX_QUEUE_RETRIES) {
      this.retryCounts.delete(retryKey);
      this.failFinally(entry, outcome.message);
      return;
    }

    this.retryCounts.set(retryKey, retryAttempts + 1);
    // 元の優先度を維持し、新しいsequenceで同優先度の末尾へ置く。
    // 未完了の待機requestは再試行jobへ引き継ぐ。
    this.enqueue({
      asset: entry.asset,
      kind: entry.kind,
      priority: entry.priority,
      downloadAfterConfirm: entry.downloadAfterConfirm,
      waiters,
    });
  }

  /** 最終失敗（設計4.4）: failed、error通知、警告ログ */
  private failFinally(entry: AssetQueueEntry, message: string) {
    this.db.setStatus(entry.asset.grade, entry.asset.key, 'failed', message);
    console.warn(
      '[assets] job failed finally',
      entry.asset,
      entry.kind,
      message,
    );
    this.sendError(entry.asset, message);

    const version = this.currentVersion(entry.asset);
    const state = this.recoveryStates.get(
      this.recoveryKey(entry.asset, version),
    );
    if (state && state.phase === 'downloading') {
      state.phase = 'exhausted';
    }
  }

  private unavailableResolution(
    asset: AssetKey,
    message: string,
  ): RequestItemResolution {
    return {
      kind: 'failed',
      failure: {
        grade: asset.grade,
        key: asset.key,
        reason: 'asset-state-unavailable',
        message,
      },
    };
  }

  private resolutionForOutcome(
    entry: AssetQueueEntry,
    outcome: JobOutcome,
  ): RequestItemResolution {
    switch (outcome.kind) {
      case 'active-ready':
        return { kind: 'ready', notice: outcome.notice };
      case 'active-needs-download':
      case 'succeeded':
      case 'meta-changed':
        return { kind: 'pending' };
      case 'deleted':
        return {
          kind: 'failed',
          failure: {
            grade: entry.asset.grade,
            key: entry.asset.key,
            reason: 'asset-deleted',
            message: '画像は削除されています',
          },
        };
      case 'not-found':
        return {
          kind: 'failed',
          failure: {
            grade: entry.asset.grade,
            key: entry.asset.key,
            reason: 'asset-not-found',
            message: '画像が見つかりません',
          },
        };
      case 'invalidated':
        return this.unavailableResolution(entry.asset, 'canceled');
      default:
        return this.unavailableResolution(entry.asset, outcome.message);
    }
  }

  // -------------------------------------------------------------------------
  // 公開API
  // -------------------------------------------------------------------------

  /**
   * 表示に必要な画像を要求する（設計2.1 / 4.6）。
   * gate は登録までの1回だけ取得し、確認待ち中は保持しない。
   * IPC応答は全対象の判定後に ready / pending / failed を一括で返す。
   */
  async request(items: AssetKey[]): Promise<AssetRequestOutcome> {
    const registrations = await this.gate.runShared(() =>
      this.registerRequestItems(items),
    );

    const ready: AssetReadyNotice[] = [];
    const pending: AssetKey[] = [];
    const failed: AssetRequestFailure[] = [];

    const resolutions = await Promise.all(
      registrations.map(async (registration) => ({
        asset: registration.asset,
        resolution: await registration.resolution,
      })),
    );

    for (const { asset, resolution } of resolutions) {
      if (resolution.kind === 'ready') {
        ready.push(resolution.notice);
      } else if (resolution.kind === 'pending') {
        pending.push(asset);
      } else {
        // failed項目をpendingへ重複させない（設計9.1）。
        failed.push(resolution.failure);
      }
    }

    return { ready, pending, failed };
  }

  private async registerRequestItems(
    items: AssetKey[],
  ): Promise<
    Array<{ asset: AssetKey; resolution: Promise<RequestItemResolution> }>
  > {
    const registrations: Array<{
      asset: AssetKey;
      resolution: Promise<RequestItemResolution>;
    }> = [];

    for (const asset of items) {
      if (!ASSET_KEY_PATTERN.test(asset.key)) {
        registrations.push({
          asset,
          resolution: Promise.resolve(
            this.unavailableResolution(asset, 'invalid asset key'),
          ),
        });
        continue;
      }

      const row = this.db.get(asset.grade, asset.key);
      const version = resolveAssetVersion(row);
      const recovery = this.recoveryStates.get(
        this.recoveryKey(asset, version),
      );

      // 削除済み・未確認行と、同一versionでexhaustedな画像だけをサーバー確認へ回す（設計4.6）。
      // AssetDBに行が無い画像は未取得であり例外状態ではないため、通常のdownloadへ進める。
      const needsServerConfirm =
        (row !== undefined && row.deleted !== 0) ||
        recovery?.phase === 'exhausted';

      if (needsServerConfirm) {
        registrations.push({
          asset,
          resolution: new Promise<RequestItemResolution>((resolve) => {
            this.enqueue({
              asset,
              kind: 'confirm-meta',
              priority: AssetJobPriority.confirmMeta,
              waiters: [{ asset, resolve }],
            });
          }),
        });
        continue;
      }

      const verified =
        row?.status === 'ready' && row?.local_file_path
          ? await verifyAssetFile({
              root: this.root.root,
              grade: asset.grade,
              key: asset.key,
              filePath: row.local_file_path,
            })
          : { ok: false as const, reason: 'missing' as const };

      if (verified.ok) {
        // 検証済みローカルファイルは即時 ready。画像本体は protocol 経由で配信する。
        this.db.touchAccess(asset.grade, asset.key);
        this.recordAssetMetric?.({ type: 'local-file-hit' });
        registrations.push({
          asset,
          resolution: Promise.resolve({
            kind: 'ready',
            notice: this.buildReadyNotice(asset, row),
          }),
        });
        continue;
      }

      if (verified.reason === 'stat-failed') {
        // 一時的なアクセス拒否等では有効なキャッシュを破棄しない（設計8.2）。
        // 配信もダウンロードも行わず、次の明示requestで再検査する。
        console.warn(
          '[assets] local asset file stat failed',
          asset,
          verified.reason,
        );
        registrations.push({
          asset,
          resolution: Promise.resolve(
            this.unavailableResolution(
              asset,
              'local file state could not be verified',
            ),
          ),
        });
        continue;
      }

      if (row?.local_file_path) {
        // DBがreadyでも検証に失敗した場合はローカルキャッシュ情報を無効化する（設計2.2）。
        await this.invalidateLocalCache(
          asset,
          row,
          `verify-failed:${verified.reason}`,
        );
      }

      if (isAssetFileSecurityFailure(verified.reason)) {
        // symlink やパス不一致は異常状態。その場では取得へ進めない（設計8.2）。
        console.warn(
          '[assets] local asset file rejected by verification',
          asset,
          verified.reason,
        );
        registrations.push({
          asset,
          resolution: Promise.resolve(
            this.unavailableResolution(
              asset,
              `local file verification failed: ${verified.reason}`,
            ),
          ),
        });
        continue;
      }

      this.recordAssetMetric?.({ type: 'local-file-miss' });
      this.enqueue({
        asset,
        kind: 'download',
        priority: AssetJobPriority.request,
      });
      registrations.push({
        asset,
        resolution: Promise.resolve({ kind: 'pending' }),
      });
    }

    return registrations;
  }

  async prioritize(
    items: AssetKey[],
    priority: number = AssetJobPriority.prioritize,
  ): Promise<void> {
    await this.gate.runShared(() => {
      for (const asset of items) {
        const version = this.currentVersion(asset);
        const recovery = this.recoveryStates.get(
          this.recoveryKey(asset, version),
        );
        // exhausted では追加取得しない（設計5.4）。
        if (recovery?.phase === 'exhausted') {
          continue;
        }

        const row = this.db.get(asset.grade, asset.key);
        if (row?.deleted === 1) {
          continue;
        }

        // ローカルに検証可能なファイルがある画像は protocol 経由で表示されるため、
        // prioritize では未取得画像の download だけを前倒しする。
        if (row?.status === 'ready' && row?.local_file_path) {
          continue;
        }

        this.enqueue({
          asset,
          kind: 'download',
          priority,
        });
      }
    });
  }

  async cancel(items: AssetKey[]): Promise<{ canceled: number }> {
    return this.gate.runShared(() => {
      let canceled = 0;
      for (const asset of items) {
        if (this.dropAssetWork(asset, 'canceled')) {
          canceled += 1;
        }

        const row = this.db.get(asset.grade, asset.key);
        if (!row?.local_file_path && row?.status === 'downloading') {
          this.db.setStatus(asset.grade, asset.key, null);
        }
      }
      return { canceled };
    });
  }

  /**
   * 画像単位の待機処理・後続処理・再試行回数・表示回復状態を破棄し、世代を進める。
   * 戻り値は実際に何かを取り消したかどうか。
   */
  private dropAssetWork(asset: AssetKey, reason: string): boolean {
    const key = this.keyOf(asset);
    let touched = false;

    const remaining: AssetQueueEntry[] = [];
    for (const entry of this.waiting) {
      if (this.keyOf(entry.asset) !== key) {
        remaining.push(entry);
        continue;
      }
      touched = true;
      for (const waiter of this.takeWaitingWaiters(entry)) {
        waiter.resolve(this.unavailableResolution(asset, reason));
      }
    }
    this.waiting = remaining;

    const followUp = this.followUps.get(key);
    if (followUp) {
      touched = true;
      this.followUps.delete(key);
      for (const waiter of followUp.waiters) {
        waiter.resolve(this.unavailableResolution(asset, reason));
      }
    }

    if (this.runningJobs.has(key)) {
      touched = true;
    }

    for (const retryKey of [...this.retryCounts.keys()]) {
      if (retryKey.startsWith(`${key}|`)) {
        this.retryCounts.delete(retryKey);
      }
    }

    for (const stateKey of [...this.recoveryStates.keys()]) {
      if (stateKey.startsWith(`["${asset.grade}","${asset.key}"`)) {
        this.recoveryStates.delete(stateKey);
      }
    }

    this.lastProgAt.delete(key);
    // 実行中処理のファイル・DB・ready反映を無効化する。
    this.bumpGeneration(asset);
    return touched;
  }

  // -------------------------------------------------------------------------
  // protocol（設計2.3）
  // -------------------------------------------------------------------------

  /**
   * protocol handler からの1回だけの問い合わせ。
   * ダウンロード完了は待たず、clearCache 中だけ barrier を待つ。
   */
  async resolveProtocolRequest(parsed: {
    grade: GradeId;
    key: string;
    version?: string;
    recoveryToken?: string;
  }): Promise<AssetProtocolResolution> {
    if (this.disposed) {
      return { kind: 'unavailable' };
    }

    if (this.clearBarrier) {
      await this.clearBarrier;
    }

    return this.gate.runShared(async () => {
      const asset: AssetKey = { grade: parsed.grade, key: parsed.key };
      const row = this.db.get(asset.grade, asset.key);

      // 削除済み・未確認行は配信せず、ダウンロードも登録しない（設計2.3）。
      // 行が無い場合は未取得として扱い、404を返しつつ取得を登録する。
      if (row && row.deleted !== 0) {
        return { kind: 'not-found' } as const;
      }

      const currentVersion = resolveAssetVersion(row);
      if (parsed.version !== undefined && parsed.version !== currentVersion) {
        // 旧versionのURLへ現在の内容を返さない（immutable cacheの汚染防止）。
        return { kind: 'not-found' } as const;
      }

      const localFilePath = row?.local_file_path;
      if (row?.status === 'ready' && localFilePath) {
        const verified = await verifyAssetFile({
          root: this.root.root,
          grade: asset.grade,
          key: asset.key,
          filePath: localFilePath,
        });

        if (verified.ok) {
          this.db.touchAccess(asset.grade, asset.key);
          return {
            kind: 'file',
            filePath: localFilePath,
            size: verified.size,
            contentType: row.content_type ?? 'image/png',
          } as const;
        }

        if (verified.reason === 'stat-failed') {
          // 一時的な失敗ではローカル情報を消さず、取得も登録しない（設計8.2）。
          console.warn(
            '[assets] protocol file stat failed',
            asset,
            verified.reason,
          );
          return { kind: 'not-found' } as const;
        }

        console.warn(
          '[assets] protocol file verification failed',
          asset,
          verified.reason,
        );
        await this.invalidateLocalCache(
          asset,
          row,
          `protocol-verify-failed:${verified.reason}`,
        );

        if (isAssetFileSecurityFailure(verified.reason)) {
          // 配信もダウンロード登録も行わない（設計8.2）。
          return { kind: 'not-found' } as const;
        }
      }

      const recovery = this.recoveryStates.get(
        this.recoveryKey(asset, currentVersion),
      );
      if (recovery?.phase !== 'exhausted') {
        this.enqueue({
          asset,
          kind: 'download',
          priority: AssetJobPriority.displayMiss,
        });
      }

      return { kind: 'not-found' } as const;
    });
  }

  // -------------------------------------------------------------------------
  // 表示失敗からの回復（設計5章）
  // -------------------------------------------------------------------------

  async reportLoadFailure(
    report: AssetLoadReport,
  ): Promise<AssetLoadFailureResult> {
    // main は受信値をURL parserと同じ規則で再検証する（設計9.2）。
    if (!this.isValidLoadReport(report)) {
      return { ok: false, error: 'invalid load report' };
    }

    return this.gate.runShared(async () => {
      const asset: AssetKey = { grade: report.grade, key: report.key };
      const row = this.db.get(asset.grade, asset.key);
      const currentVersion = resolveAssetVersion(row);
      const stateKey = this.recoveryKey(asset, currentVersion);
      const state = this.recoveryStates.get(stateKey);

      const isStaleIdentity =
        report.version !== currentVersion ||
        (report.recoveryToken !== undefined &&
          report.recoveryToken !== state?.activeRecoveryToken);

      if (isStaleIdentity) {
        // 状態を変えず、現在ファイルが使えれば現在のreadyを再送する。
        await this.resendReadyIfUsable(asset);
        return { ok: true, status: 'stale-refreshed' } as const;
      }

      if (
        state?.phase === 'downloading' &&
        state.failedSourceToken === (report.recoveryToken ?? null)
      ) {
        return { ok: true, status: 'already-recovering' } as const;
      }

      const accepted = state?.acceptedFailureCount ?? 0;
      if (accepted >= MAX_DISPLAY_RECOVERIES || state?.phase === 'exhausted') {
        const exhausted: DisplayRecoveryState = {
          phase: 'exhausted',
          acceptedFailureCount: accepted,
          failedSourceToken: report.recoveryToken ?? null,
          activeRecoveryToken: state?.activeRecoveryToken,
        };
        this.recoveryStates.set(stateKey, exhausted);
        this.db.setStatus(
          asset.grade,
          asset.key,
          'failed',
          'display-recovery-exhausted',
        );
        console.warn(
          '[assets] display recovery exhausted',
          asset,
          currentVersion,
        );
        this.sendError(asset, '画像の表示に繰り返し失敗しました');
        return { ok: true, status: 'retry-exhausted' } as const;
      }

      const nextToken = randomBytes(16).toString('base64url');
      this.recoveryStates.set(stateKey, {
        phase: 'downloading',
        acceptedFailureCount: accepted + 1,
        failedSourceToken: report.recoveryToken ?? null,
        activeRecoveryToken: nextToken,
      });

      await this.invalidateLocalCacheKeepingRecovery(
        asset,
        row,
        'display-load-failed',
      );
      this.enqueue({
        asset,
        kind: 'download',
        priority: AssetJobPriority.displayMiss,
      });

      return { ok: true, status: 'recovery-started' } as const;
    });
  }

  async reportLoadSuccess(
    report: AssetLoadReport,
  ): Promise<AssetLoadSuccessResult> {
    if (!this.isValidLoadReport(report) || !report.recoveryToken) {
      return { ok: false, error: 'invalid load report' };
    }

    return this.gate.runShared(() => {
      const asset: AssetKey = { grade: report.grade, key: report.key };
      const currentVersion = this.currentVersion(asset);
      if (report.version !== currentVersion) {
        return { ok: true, confirmed: false } as const;
      }

      const stateKey = this.recoveryKey(asset, currentVersion);
      const state = this.recoveryStates.get(stateKey);
      if (
        !state ||
        state.activeRecoveryToken !== report.recoveryToken ||
        (state.phase !== 'awaiting-load' && state.phase !== 'idle')
      ) {
        return { ok: true, confirmed: false } as const;
      }

      // 有効tokenは維持したまま、回復回数と失敗元tokenだけ消す。
      this.recoveryStates.set(stateKey, {
        phase: 'idle',
        acceptedFailureCount: 0,
        failedSourceToken: null,
        activeRecoveryToken: state.activeRecoveryToken,
      });

      return { ok: true, confirmed: true } as const;
    });
  }

  private isValidLoadReport(report: AssetLoadReport): boolean {
    if (report?.grade !== 'firstGrade' && report?.grade !== 'secondGrade') {
      return false;
    }
    if (typeof report.key !== 'string' || !ASSET_KEY_PATTERN.test(report.key)) {
      return false;
    }
    if (
      report.version !== undefined &&
      !ASSET_VERSION_PATTERN.test(report.version)
    ) {
      return false;
    }
    if (
      report.recoveryToken !== undefined &&
      !ASSET_RECOVERY_TOKEN_PATTERN.test(report.recoveryToken)
    ) {
      return false;
    }
    return true;
  }

  private async resendReadyIfUsable(asset: AssetKey): Promise<void> {
    const row = this.db.get(asset.grade, asset.key);
    if (row?.deleted !== 0 || row.status !== 'ready' || !row.local_file_path) {
      return;
    }

    const verified = await verifyAssetFile({
      root: this.root.root,
      grade: asset.grade,
      key: asset.key,
      filePath: row.local_file_path,
    });
    if (!verified.ok) {
      return;
    }

    this.sendReady(this.buildReadyNotice(asset, row));
  }

  // -------------------------------------------------------------------------
  // worker: サーバーメタ確認（設計4.6）
  // -------------------------------------------------------------------------

  private async confirmMeta(entry: AssetQueueEntry): Promise<ConfirmOutcome> {
    const asset = entry.asset;

    // 通信前に世代、version、表示回復状態・token、deleted を記録する。
    const beforeRow = this.db.get(asset.grade, asset.key);
    const beforeVersion = resolveAssetVersion(beforeRow);
    const beforeDeleted = beforeRow?.deleted ?? null;
    const beforeStateKey = this.recoveryKey(asset, beforeVersion);
    const beforeToken =
      this.recoveryStates.get(beforeStateKey)?.activeRecoveryToken;

    const result = await this.resolveMetaFromServer(asset);

    // 結果反映前に状態がすべて一致する場合だけ反映する。
    const afterRow = this.db.get(asset.grade, asset.key);
    const unchanged =
      this.isEntryCurrent(entry) &&
      resolveAssetVersion(afterRow) === beforeVersion &&
      (afterRow?.deleted ?? null) === beforeDeleted &&
      this.recoveryStates.get(beforeStateKey)?.activeRecoveryToken ===
        beforeToken;

    if (!unchanged) {
      return { kind: 'invalidated' };
    }

    if (result.kind === 'unavailable') {
      const message =
        result.error instanceof Error
          ? result.error.message
          : String(result.error);
      return { kind: 'failed', retryable: true, message };
    }

    if (result.kind === 'found-deleted') {
      this.db.markDeleted(
        asset.grade,
        asset.key,
        toTimestampMillis(result.data?.updatedAt) ?? undefined,
      );
      await this.removeLocalFile(afterRow?.local_file_path);
      return { kind: 'deleted' };
    }

    if (result.kind === 'not-found') {
      // Firestore上で不存在が確定した状態。行とメタは残して deleted=1 にする（設計4.7）。
      this.db.markDeleted(asset.grade, asset.key);
      await this.removeLocalFile(afterRow?.local_file_path);
      return { kind: 'not-found' };
    }

    const meta = result.data;
    this.db.upsertMeta({
      grade: asset.grade,
      key: asset.key,
      object_path:
        meta.objectPath ?? `original/${asset.grade}/${asset.key}.png`,
      md5_hash: meta.md5Hash ?? null,
      content_type: meta.contentType ?? 'image/png',
      size: meta.size ?? null,
      updated_at_ms: toTimestampMillis(meta.updatedAt) ?? undefined,
      deleted: 0,
    });

    const confirmedRow = this.db.get(asset.grade, asset.key);
    const confirmedVersion = resolveAssetVersion(confirmedRow);

    // 新versionが確定した場合は旧versionのexhaustedを解除する（設計5.4）。
    if (confirmedVersion !== beforeVersion) {
      this.recoveryStates.delete(beforeStateKey);
    }

    const recovery = this.recoveryStates.get(
      this.recoveryKey(asset, confirmedVersion),
    );

    if (
      confirmedRow?.status === 'ready' &&
      confirmedRow.local_file_path &&
      !entry.downloadAfterConfirm
    ) {
      const verified = await verifyAssetFile({
        root: this.root.root,
        grade: asset.grade,
        key: asset.key,
        filePath: confirmedRow.local_file_path,
      });
      if (verified.ok) {
        this.db.touchAccess(asset.grade, asset.key);
        return {
          kind: 'active-ready',
          notice: this.buildReadyNotice(asset, confirmedRow),
        };
      }
    }

    if (recovery?.phase === 'exhausted') {
      // 同一versionのままexhaustedなら追加取得しない（設計5.4）。
      return {
        kind: 'failed',
        retryable: false,
        message: 'recovery-exhausted',
      };
    }

    return { kind: 'active-needs-download' };
  }

  // -------------------------------------------------------------------------
  // worker: ダウンロード
  // -------------------------------------------------------------------------

  private async downloadOne(entry: AssetQueueEntry): Promise<DownloadOutcome> {
    const it = entry.asset;
    const metaResult = await this.resolveMeta(it);

    if (!this.isEntryCurrent(entry)) {
      return { kind: 'invalidated' };
    }

    if (metaResult.kind === 'found-deleted') {
      this.db.markDeleted(
        it.grade,
        it.key,
        toTimestampMillis(metaResult.data?.updatedAt) ?? undefined,
      );
      return { kind: 'deleted' };
    }

    if (metaResult.kind === 'unavailable') {
      const error = metaResult.error;
      return {
        kind: 'failed',
        retryable: isRetryableDownloadFailure(error),
        message: error instanceof Error ? error.message : String(error),
      };
    }

    const row = this.db.get(it.grade, it.key);
    if (row?.deleted === 1) {
      return { kind: 'deleted' };
    }

    if (metaResult.kind !== 'found-active') {
      // found-active だけが署名URL取得とStorage downloadへ進める（設計4.7）。
      // 古い AssetDB 行で補完すると、削除通知未受信のクライアントが
      // 削除済み画像を再取得し得るため、not-found はここで終了する。
      // deleted の確定は server-only 確認（confirm-meta）の責務なので変更しない。
      return { kind: 'not-found' };
    }

    const meta: AssetData = metaResult.data;
    const objectPath = meta.objectPath ?? `original/${it.grade}/${it.key}.png`;

    if (
      this.hasMetaChanged(row, {
        objectPath,
        md5Hash: meta.md5Hash,
        size: meta.size,
        updatedAt: meta.updatedAt,
      })
    ) {
      await this.invalidateLocalCache(it, row, 'firestore-meta-changed');
      return { kind: 'meta-changed' };
    }

    this.db.upsertMeta({
      grade: it.grade,
      key: it.key,
      object_path: objectPath,
      md5_hash: meta.md5Hash ?? null,
      content_type: meta.contentType ?? 'image/png',
      size: meta.size ?? null,
      updated_at_ms: toTimestampMillis(meta.updatedAt) ?? undefined,
      status: 'downloading',
      deleted: 0,
    });

    // 学年ディレクトリを使う前に、通常ディレクトリであることを確認する（設計8.1）。
    const gradeDir = await ensureGradeDirectory(this.root.root, it.grade);
    if (!gradeDir.ok) {
      return {
        kind: 'failed',
        retryable: false,
        message: `grade directory is not usable: ${gradeDir.reason}`,
      };
    }

    const destPath = this.filePathOf(it);
    const attemptDownload = async () => {
      const { data } = await this.signedUrl({
        objectPath,
        expiresSec: this.options.expiresSec,
      });
      return {
        destPath,
        ...(await downloadWithVerify({
          url: data.url,
          destPath,
          expectedMd5: meta.md5Hash,
          onProgress: this.throttledProgress(entry),
        })),
      };
    };

    let res: { bytes: number; md5Base64: string; destPath: string };
    try {
      res = await attemptDownload();
    } catch (e: unknown) {
      if (!(e instanceof Error)) {
        return {
          kind: 'failed',
          retryable: true,
          message: String(e),
        };
      }
      const msg = String(e?.message ?? e);
      // 期限切れ/権限系は署名URLを1回だけ再発行する（1回のdownload処理内の別カウント）。
      if (/401|403|expired|permission/i.test(msg)) {
        try {
          res = await attemptDownload();
        } catch (retryError) {
          return {
            kind: 'failed',
            retryable: isRetryableDownloadFailure(retryError),
            message:
              retryError instanceof Error
                ? retryError.message
                : String(retryError),
          };
        }
      } else {
        return {
          kind: 'failed',
          retryable: isRetryableDownloadFailure(e),
          message: msg,
        };
      }
    }

    // 最後の非同期I/Oの後に無効化を判定し、確認からDB更新・ready通知までawaitを挟まない。
    if (!this.isEntryCurrent(entry)) {
      // 一時ファイルを最終パスへ移動した後の無効化では、自分が作ったファイルを消す（設計7.3）。
      await this.removeLocalFile(res.destPath);
      return { kind: 'invalidated' };
    }

    const verified = await verifyAssetFile({
      root: this.root.root,
      grade: it.grade,
      key: it.key,
      filePath: res.destPath,
    });
    if (!verified.ok) {
      return {
        kind: 'failed',
        retryable: true,
        message: `downloaded file verification failed: ${verified.reason}`,
      };
    }

    this.db.setLocalPath(it.grade, it.key, res.destPath);
    this.db.setStatus(it.grade, it.key, 'ready');
    this.db.touchAccess(it.grade, it.key);
    this.recordAssetMetric?.({ type: 'download', bytes: res.bytes });

    const readyRow = this.db.get(it.grade, it.key);
    const version = resolveAssetVersion(readyRow);
    const stateKey = this.recoveryKey(it, version);
    const state = this.recoveryStates.get(stateKey);
    if (state?.phase === 'downloading') {
      // ready通知より先に awaiting-load へ変更する（設計5.3）。
      this.recoveryStates.set(stateKey, { ...state, phase: 'awaiting-load' });
    }

    this.sendReady(this.buildReadyNotice(it, readyRow));

    return { kind: 'succeeded' };
  }

  private throttledProgress(entry: AssetQueueEntry) {
    const it = entry.asset;
    return (x: number, t?: number) => {
      if (!this.isEntryCurrent(entry)) {
        return;
      }

      const k = this.keyOf(it);
      const now = Date.now();
      const last = this.lastProgAt.get(k) ?? 0;
      if (now - last >= 100 || x === t) {
        this.lastProgAt.set(k, now);
        if (
          this.mainWindow.isDestroyed() ||
          this.mainWindow.webContents.isDestroyed()
        ) {
          return;
        }
        this.mainWindow.webContents.send(AssetChannels.progress, {
          grade: it.grade,
          key: it.key,
          transferred: x,
          total: t,
        });
      }
    };
  }

  // -------------------------------------------------------------------------
  // 変更通知（設計6.4）
  // -------------------------------------------------------------------------

  handleChangeNotices(notices: AssetChangeNotice[]): Promise<void> {
    // AssetManager内の1本のPromiseチェーンで受信順に処理する。
    this.notificationChain = this.notificationChain.then(async () => {
      for (const notice of notices) {
        try {
          await this.gate.runShared(() => this.applyChangeNotice(notice));
        } catch (e) {
          // 1件の例外はログへ残して次へ進む。
          console.warn('[assets] failed to apply change notice', notice, e);
        }
      }
    });
    return this.notificationChain;
  }

  private async applyChangeNotice(notice: AssetChangeNotice): Promise<void> {
    const asset: AssetKey = { grade: notice.grade, key: notice.key };
    if (!ASSET_KEY_PATTERN.test(asset.key)) {
      return;
    }

    const row = this.db.get(asset.grade, asset.key);

    if (notice.deleted) {
      // 既存行より古い通知は反映しない。
      if (
        typeof row?.updated_at_ms === 'number' &&
        notice.updatedAtMs !== null &&
        notice.updatedAtMs < row.updated_at_ms
      ) {
        return;
      }

      this.dropAssetWork(asset, 'deleted-by-remote');
      await this.removeLocalFile(row?.local_file_path);
      this.db.markDeleted(
        asset.grade,
        asset.key,
        notice.updatedAtMs ?? undefined,
      );
      return;
    }

    const previouslyUsed = Boolean(
      row?.local_file_path || row?.last_accessed_at_ms,
    );

    if (!row) {
      // AssetDBに行が無い画像は未利用なので、通知だけで取得も確認もしない
      // （未利用画像を一括取得しない。設計6.4）。次の renderer request で扱う。
      return;
    }

    if (row.deleted !== 0) {
      // 削除済み・未確認行は active 通知だけで解除せず、サーバー確認後だけ 0 へ戻す。
      this.enqueue({
        asset,
        kind: 'confirm-meta',
        priority: AssetJobPriority.confirmMeta,
        downloadAfterConfirm: previouslyUsed,
      });
      return;
    }

    const noticeVersion = resolveAssetVersion({
      md5_hash: notice.md5Hash ?? null,
      updated_at_ms: notice.updatedAtMs,
    });
    const currentVersion = resolveAssetVersion(row);

    if (!noticeVersion) {
      // 比較可能なversionがない場合、deleted=0では既存内容を上書きしない。
      return;
    }

    if (noticeVersion === currentVersion) {
      return;
    }

    if (
      typeof row.updated_at_ms === 'number' &&
      notice.updatedAtMs !== null &&
      notice.updatedAtMs < row.updated_at_ms
    ) {
      return;
    }

    // 世代を進め、旧ファイルと旧versionの表示回復状態を無効化する。
    this.dropAssetWork(asset, 'meta-updated-by-remote');
    await this.removeLocalFile(row.local_file_path);
    this.db.clearLocalCacheEntry(asset.grade, asset.key);
    this.db.upsertMeta({
      grade: asset.grade,
      key: asset.key,
      object_path: notice.objectPath ?? row.object_path ?? null,
      md5_hash: notice.md5Hash ?? null,
      content_type: notice.contentType ?? row.content_type ?? 'image/png',
      size: notice.size ?? null,
      updated_at_ms: notice.updatedAtMs ?? undefined,
      deleted: 0,
    });

    if (previouslyUsed) {
      this.enqueue({
        asset,
        kind: 'download',
        priority: AssetJobPriority.metaChanged,
      });
    }
  }

  // -------------------------------------------------------------------------
  // clearCache（設計7.2）
  // -------------------------------------------------------------------------

  async clearCache(scope?: {
    grade?: GradeId;
  }): Promise<{ removedFiles: number }> {
    return this.gate.runExclusive(async () => {
      // 状態を一切変更する前に削除対象を検証する。
      // 途中で異常終了して取消だけが残る状態を作らないため、最初に確認する。
      const clearTarget = await verifyClearTarget(this.root.root, scope?.grade);
      if (!clearTarget.ok) {
        console.warn(
          '[assets] refused to clear asset cache',
          scope?.grade ?? '(all)',
          clearTarget.reason,
        );
        throw new Error(
          `clear target verification failed: ${clearTarget.reason}`,
        );
      }

      let releaseBarrier: () => void = () => {};
      this.clearBarrier = new Promise<void>((resolve) => {
        releaseBarrier = resolve;
      });

      try {
        // 画像ごとの取消より先に全体世代を進め、実行中処理の結果を無効化する。
        this.clearGeneration += 1;

        const inScope = (asset: AssetKey) =>
          !scope?.grade || asset.grade === scope.grade;

        // 学年指定のclearでは、対象外の待機・実行中jobを巻き添えで失効させない。
        // 全体世代を進めた直後に、対象外jobの保持値を新しい値へ引き上げる。
        if (scope?.grade) {
          for (const entry of this.waiting) {
            if (!inScope(entry.asset)) {
              entry.clearGeneration = this.clearGeneration;
            }
          }
          for (const running of this.runningJobs.values()) {
            if (!inScope(running.entry.asset)) {
              running.entry.clearGeneration = this.clearGeneration;
            }
          }
        }

        const remaining: AssetQueueEntry[] = [];
        for (const entry of this.waiting) {
          if (!inScope(entry.asset)) {
            remaining.push(entry);
            continue;
          }
          for (const waiter of this.takeWaitingWaiters(entry)) {
            waiter.resolve(
              this.unavailableResolution(entry.asset, 'cache cleared'),
            );
          }
        }
        this.waiting = remaining;

        for (const [key, followUp] of [...this.followUps.entries()]) {
          const [grade] = key.split('/');
          if (scope?.grade && grade !== scope.grade) continue;
          this.followUps.delete(key);
          for (const waiter of followUp.waiters) {
            waiter.resolve(
              this.unavailableResolution(waiter.asset, 'cache cleared'),
            );
          }
        }

        for (const retryKey of [...this.retryCounts.keys()]) {
          if (!scope?.grade || retryKey.startsWith(`${scope.grade}/`)) {
            this.retryCounts.delete(retryKey);
          }
        }

        for (const stateKey of [...this.recoveryStates.keys()]) {
          if (!scope?.grade || stateKey.startsWith(`["${scope.grade}"`)) {
            this.recoveryStates.delete(stateKey);
          }
        }

        for (const [key, running] of [...this.runningJobs.entries()]) {
          if (!inScope(running.entry.asset)) continue;
          this.bumpGeneration(running.entry.asset);
          for (const waiter of running.waiters) {
            waiter.resolve(
              this.unavailableResolution(running.entry.asset, 'cache cleared'),
            );
          }
          running.waiters = [];
          this.lastProgAt.delete(key);
        }

        // 検証済みパスだけを削除し、ファイル側の処理が終わってからDBを消す。
        const removedFiles = clearTarget.exists
          ? await this.removeLocalFiles(clearTarget.path)
          : 0;
        this.db.clearAllLocal(scope?.grade);

        await session.defaultSession.clearCache();

        return { removedFiles };
      } finally {
        releaseBarrier();
        this.clearBarrier = null;
      }
    });
  }

  /**
   * 削除対象を再帰削除する（設計7.2 / 8.2）。
   * 走査するディレクトリは readdir の直前に毎回検証し、
   * 事前検証から削除までの間に差し替えられた場合は削除を中止する。
   */
  private async removeLocalFiles(targetPath: string): Promise<number> {
    let removedFiles = 0;

    const removeDirSafe = async (dir: string) => {
      // readdir の直前に再検証する。検証と操作の間隔を最小にする。
      const verification = await verifyDirectoryForRemoval(dir, this.root.root);
      if (!verification.ok) {
        throw new Error(
          `clear target verification failed during removal: ${verification.reason} (${dir})`,
        );
      }
      if (!verification.exists) {
        return;
      }

      // 検証失敗は上位へ伝える必要があるため、握り潰す範囲は readdir 自体に限る。
      let entries: Dirent[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        // 走査できない場合は何もしない（競合で消えた等）
        return;
      }

      for (const e of entries) {
        const full = path.join(dir, e.name);
        // symlink / junction は辿らず、リンク自体だけを削除する（リンク先は残す）。
        if (e.isSymbolicLink()) {
          try {
            await fs.unlink(full);
            removedFiles += 1;
          } catch {
            try {
              await fs.rmdir(full);
              removedFiles += 1;
            } catch {
              // 削除できないリンクは無視する
            }
          }
          continue;
        }
        if (e.isDirectory()) {
          await removeDirSafe(full);
        } else {
          try {
            await fs.unlink(full);
            removedFiles += 1;
          } catch {
            // 競合や存在しない場合は無視（inflight など）
          }
        }
      }

      try {
        await fs.rmdir(dir);
      } catch {
        // 空でない/他プロセスが掴んでいる などは無視
      }
    };

    await removeDirSafe(targetPath);
    return removedFiles;
  }

  // -------------------------------------------------------------------------
  // upload / replace / delete
  // -------------------------------------------------------------------------

  async replaceAsset(params: {
    filePath: string;
    grade: GradeId;
    key: string;
    timeoutMs?: number;
  }): Promise<AssetReplaceResult> {
    return this.gate.runShared(() => this.replaceAssetInner(params));
  }

  private async replaceAssetInner(params: {
    filePath: string;
    grade: GradeId;
    key: string;
    timeoutMs?: number;
  }): Promise<AssetReplaceResult> {
    const { filePath, grade, key, timeoutMs = 15_000 } = params;

    try {
      await ensureAuthClaims({ requireWrite: true });

      if (!filePath) {
        throw new Error('filePath が指定されていません');
      }

      const ext = extname(filePath).toLowerCase();
      if (ext !== '.png') {
        throw new Error('.png 以外は置き換えできません');
      }

      const buf = await fs.readFile(filePath);
      if (buf.length === 0) {
        throw new Error('ファイルが空です');
      }

      const previousMetaResult = await this.resolveMeta({ grade, key });
      const previousMeta = metaDataOf(previousMetaResult);
      const previousRow = this.db.get(grade, key);
      const objectPath =
        previousMeta?.objectPath ??
        previousRow?.object_path ??
        `original/${grade}/${key}.png`;

      await this.invalidateLocalCache(
        { grade, key },
        previousRow,
        'replace-requested',
      );

      this.db.upsertMeta({
        grade,
        key,
        object_path: objectPath,
        md5_hash: previousMeta?.md5Hash ?? previousRow?.md5_hash ?? null,
        content_type: 'image/png',
        size: buf.length,
        updated_at_ms:
          toTimestampMillis(previousMeta?.updatedAt) ??
          previousRow?.updated_at_ms ??
          undefined,
        status: 'downloading',
        deleted: 0,
      });

      const objectRef = storageRef(storage, objectPath);
      const md5Base64 = createHash('md5').update(buf).digest('base64');

      await uploadBytes(objectRef, buf, {
        contentType: 'image/png',
        customMetadata: {
          clientUploadedAt: String(Date.now()),
        },
      });

      const docRef = fsDoc(firestore, 'storageList', grade, 'images', key);
      const baseline = {
        objectPath:
          previousMeta?.objectPath ?? previousRow?.object_path ?? objectPath,
        md5Hash: previousMeta?.md5Hash ?? previousRow?.md5_hash ?? null,
        size: previousMeta?.size ?? previousRow?.size ?? null,
        updatedAtMs:
          toTimestampMillis(previousMeta?.updatedAt) ??
          previousRow?.updated_at_ms ??
          null,
      };

      const start = Date.now();
      let snapData: DocumentData | null = null;

      while (Date.now() - start < timeoutMs) {
        const snap = await getDoc(docRef);
        if (snap.exists() && this.isReplaceReflected(snap.data(), baseline)) {
          snapData = snap.data();
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (!snapData) {
        throw new Error('Firestore の画像メタ更新がタイムアウトしました');
      }

      let storageMeta: FullMetadata = {} as FullMetadata;
      try {
        storageMeta = await getMetadata(objectRef);
      } catch {
        // 補強失敗は許容
      }

      const assetData = {
        grade,
        key,
        objectPath:
          (snapData as { objectPath?: string }).objectPath ?? objectPath,
        md5Hash:
          (snapData as { md5Hash?: string }).md5Hash ??
          md5Base64 ??
          storageMeta.md5Hash,
        contentType:
          (snapData as { contentType?: string }).contentType ??
          storageMeta.contentType ??
          'image/png',
        size:
          typeof (snapData as { size?: unknown }).size === 'number'
            ? ((snapData as { size: number }).size ?? buf.length)
            : storageMeta.size
              ? Number(storageMeta.size)
              : buf.length,
        subject: (snapData as { subject?: TestSubject }).subject,
        bigCategoryTag: (snapData as { bigCategoryTag?: string })
          .bigCategoryTag,
        smallCategoryTag: (snapData as { smallCategoryTag?: string })
          .smallCategoryTag,
        tag: (snapData as { tag?: string[] }).tag,
        title: (snapData as { title?: string }).title,
        usedIds: (snapData as { usedIds?: string[] }).usedIds,
        updatedAt: (snapData as { updatedAt?: AssetData['updatedAt'] })
          .updatedAt,
        width: (snapData as { width?: number }).width,
        height: (snapData as { height?: number }).height,
      } satisfies AssetData;

      // 新メタ確定直前にもう一度世代を進め、処理中に始まった旧downloadを無効化する（設計7.3）。
      this.dropAssetWork({ grade, key }, 'replaced');

      this.db.upsertMeta({
        grade,
        key,
        object_path: assetData.objectPath ?? objectPath,
        md5_hash: assetData.md5Hash ?? null,
        content_type: assetData.contentType ?? null,
        size: assetData.size ?? null,
        updated_at_ms: toTimestampMillis(assetData.updatedAt) ?? Date.now(),
        deleted: 0,
      });
      this.db.setStatus(grade, key, null);

      this.enqueue({
        asset: { grade, key },
        kind: 'download',
        priority: AssetJobPriority.displayMiss,
      });

      return {
        ok: true,
        grade,
        key,
        objectPath: assetData.objectPath ?? objectPath,
        filePath,
        data: assetData,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.db.setStatus(grade, key, 'failed', msg);
      return { ok: false, error: msg };
    }
  }

  private generateUniqueIdForGrade(grade: GradeId): string {
    for (;;) {
      const id = generate33CharId();
      const existing = this.db.get(grade, id);
      if (!existing) return id;
    }
  }

  async uploadLocalFile(params: {
    filePath: string;
    grade: GradeId;
    timeoutMs?: number;
  }): Promise<AssetUploadResult> {
    const { filePath, grade, timeoutMs = 15_000 } = params;
    try {
      if (!filePath) throw new Error('filePath が指定されていません');
      const ext = extname(filePath).toLowerCase();
      if (ext !== '.png') {
        throw new Error('.png 以外はアップロードできません');
      }

      const buf = await fs.readFile(filePath);
      return await this.gate.runShared(() =>
        this.uploadFromBuffer({
          fileName: filePath,
          buffer: buf,
          grade,
          timeoutMs,
          contentType: 'image/png',
        }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  }

  async uploadBinaryFile(params: {
    fileName: string;
    bytes: Uint8Array;
    grade: GradeId;
    contentType?: string;
    timeoutMs?: number;
  }): Promise<AssetUploadResult> {
    const { fileName, bytes, grade, contentType, timeoutMs = 15_000 } = params;

    try {
      return await this.gate.runShared(() =>
        this.uploadFromBuffer({
          fileName,
          buffer: Buffer.from(bytes),
          grade,
          timeoutMs,
          contentType,
        }),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  }

  private async uploadFromBuffer(params: {
    fileName: string;
    buffer: Buffer;
    grade: GradeId;
    contentType?: string;
    timeoutMs: number;
  }): Promise<AssetUploadResult> {
    const {
      fileName,
      buffer,
      grade,
      contentType = 'image/png',
      timeoutMs,
    } = params;

    await ensureAuthClaims({ requireWrite: true });

    if (!fileName) {
      throw new Error('fileName が指定されていません');
    }

    const ext = extname(fileName).toLowerCase();
    if (ext !== '.png') {
      throw new Error('.png 以外はアップロードできません');
    }

    if (contentType !== 'image/png') {
      throw new Error('image/png 以外はアップロードできません');
    }

    if (buffer.length === 0) {
      throw new Error('ファイルが空です');
    }

    const id = this.generateUniqueIdForGrade(grade);
    const key = id;
    const objectPath = `original/${grade}/${id}.png`;
    const objectRef = storageRef(storage, objectPath);
    const md5Base64 = createHash('md5').update(buffer).digest('base64');

    await uploadBytes(objectRef, buffer, {
      contentType: 'image/png',
      customMetadata: {
        clientUploadedAt: String(Date.now()),
        originalFileName: fileName,
      },
    });

    const start = Date.now();
    const docRef = fsDoc(firestore, 'storageList', grade, 'images', key);
    let snapData: DocumentData | null = null;
    while (Date.now() - start < timeoutMs) {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        snapData = snap.data();
        break;
      }
      await new Promise((res) => setTimeout(res, 500));
    }
    if (!snapData) {
      throw new Error('Firestore 登録がタイムアウトしました');
    }

    let meta: FullMetadata = {} as FullMetadata;
    try {
      meta = await getMetadata(objectRef);
    } catch {
      // 取得失敗は許容
    }

    const assetData = {
      grade,
      key,
      objectPath,
      md5Hash: snapData.md5Hash || md5Base64 || meta.md5Hash,
      contentType: snapData.contentType || meta.contentType || 'image/png',
      size:
        typeof snapData.size === 'number'
          ? snapData.size
          : meta.size
            ? Number(meta.size)
            : buffer.length,
      subject: snapData.subject,
      tag: snapData.tag,
      title: snapData.title,
      usedIds: snapData.usedIds,
      updatedAt: snapData.updatedAt,
    };

    this.db.upsertMeta({
      grade,
      key,
      object_path: objectPath,
      md5_hash: assetData.md5Hash ?? null,
      content_type: assetData.contentType ?? null,
      size: assetData.size ?? null,
      status: 'ready',
      updated_at_ms: Date.now(),
      deleted: 0,
    });

    return {
      ok: true,
      grade,
      key,
      filePath: fileName,
      objectPath,
      data: assetData,
    };
  }

  /**
   * 画像を論理削除する（設計6.3）。
   * 確定点は Firestore本文documentとシャード変更インデックスを
   * 同一transactionで deleted: true へ更新できた時点。
   */
  async deleteAsset(params: { grade: GradeId; key: string }): Promise<void> {
    return this.gate.runShared(async () => {
      const { grade, key } = params;

      await ensureAuthClaims({ requireWrite: true });

      const assetKey: AssetKey = { grade, key };
      const row = this.db.get(grade, key);

      const docPath = `storageList/${grade}/images/${key}`;
      if (!this.deleteFirestoreAssetDoc) {
        throw new Error('deleteFirestoreAssetDoc is not configured');
      }
      await this.deleteFirestoreAssetDoc(docPath);

      // 確定直後に世代を進め、待機・後続・再試行・表示回復状態を破棄する。
      this.dropAssetWork(assetKey, 'deleted');
      await this.removeLocalFile(row?.local_file_path);
      this.db.markDeleted(grade, key);

      const objectPath = row?.object_path || `original/${grade}/${key}.png`;
      const objectRef = storageRef(storage, objectPath);

      try {
        await deleteObject(objectRef);
      } catch (e: unknown) {
        const code =
          typeof e === 'object' &&
          e !== null &&
          'code' in e &&
          typeof e.code === 'string'
            ? e.code
            : undefined;

        if (code !== 'storage/object-not-found') {
          // Firestore と AssetDB の論理削除は巻き戻さず、残存objectを警告ログへ残す。
          console.warn(
            `[assets] Storage object deletion failed after logical delete (grade=${grade}, key=${key}, path=${objectPath})`,
            e,
          );
          throw e;
        }

        console.warn(
          `[assets] Storage object not found during delete (grade=${grade}, key=${key}, path=${objectPath})`,
        );
      }
    });
  }

  // -------------------------------------------------------------------------
  // 内部helper
  // -------------------------------------------------------------------------

  private async removeLocalFile(localFilePath?: string | null): Promise<void> {
    if (!localFilePath) {
      return;
    }

    try {
      await fs.unlink(localFilePath);
    } catch (e: unknown) {
      const code =
        typeof e === 'object' &&
        e !== null &&
        'code' in e &&
        typeof e.code === 'string'
          ? e.code
          : undefined;

      if (code !== 'ENOENT') {
        console.warn('[assets] local file removal failed', localFilePath, e);
      }
    }
  }

  private hasMetaChanged(
    row: AssetRow | undefined,
    nextMeta: {
      objectPath?: string;
      md5Hash?: string;
      size?: number;
      updatedAt?: unknown;
    },
  ): boolean {
    if (!row?.local_file_path) {
      return false;
    }

    if (
      typeof nextMeta.objectPath === 'string' &&
      nextMeta.objectPath !== row.object_path
    ) {
      return true;
    }

    if (
      typeof nextMeta.md5Hash === 'string' &&
      nextMeta.md5Hash !== row.md5_hash
    ) {
      return true;
    }

    if (
      typeof nextMeta.size === 'number' &&
      typeof row.size === 'number' &&
      nextMeta.size !== row.size
    ) {
      return true;
    }

    const nextUpdatedAtMs = toTimestampMillis(nextMeta.updatedAt);
    return (
      nextUpdatedAtMs !== null &&
      typeof row.updated_at_ms === 'number' &&
      nextUpdatedAtMs > row.updated_at_ms
    );
  }

  private async invalidateLocalCache(
    it: AssetKey,
    row: AssetRow | undefined,
    reason: string,
  ): Promise<number> {
    const generation = this.bumpGeneration(it);
    await this.removeLocalFile(row?.local_file_path);
    this.db.clearLocalCacheEntry(it.grade, it.key);
    this.recordAssetMetric?.({
      type: 'meta-invalidation',
      reason,
    });
    return generation;
  }

  /**
   * 表示回復のための無効化。世代は進めるが、回復状態は保持する
   * （回復回数と有効tokenを維持する必要があるため）。
   */
  private async invalidateLocalCacheKeepingRecovery(
    it: AssetKey,
    row: AssetRow | undefined,
    reason: string,
  ): Promise<void> {
    await this.invalidateLocalCache(it, row, reason);
  }

  private isReplaceReflected(
    nextData: DocumentData,
    baseline: {
      objectPath?: string | null;
      md5Hash?: string | null;
      size?: number | null;
      updatedAtMs: number | null;
    },
  ): boolean {
    if ((nextData as { deleted?: unknown }).deleted === true) {
      return false;
    }

    const nextObjectPath = (nextData as { objectPath?: unknown }).objectPath;
    const nextMd5Hash = (nextData as { md5Hash?: unknown }).md5Hash;
    const nextSize = (nextData as { size?: unknown }).size;
    const nextUpdatedAtMs = toTimestampMillis(
      (nextData as { updatedAt?: unknown }).updatedAt,
    );

    if (
      typeof nextObjectPath === 'string' &&
      nextObjectPath !== baseline.objectPath
    ) {
      return true;
    }

    if (typeof nextMd5Hash === 'string' && nextMd5Hash !== baseline.md5Hash) {
      return true;
    }

    if (typeof nextSize === 'number' && nextSize !== baseline.size) {
      return true;
    }

    if (
      nextUpdatedAtMs !== null &&
      (baseline.updatedAtMs === null || nextUpdatedAtMs > baseline.updatedAtMs)
    ) {
      return true;
    }

    return false;
  }

  /** 初期化rollback / 明示dispose で購読解除とDB closeを行う（設計6.4） */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    for (const unsubscribe of this.changeSubscriptions) {
      try {
        unsubscribe();
      } catch (e) {
        console.warn('[assets] failed to unsubscribe change notice', e);
      }
    }
    this.changeSubscriptions = [];

    for (const entry of this.waiting) {
      for (const waiter of this.takeWaitingWaiters(entry)) {
        waiter.resolve(this.unavailableResolution(entry.asset, 'disposed'));
      }
    }
    this.waiting = [];

    for (const followUp of this.followUps.values()) {
      for (const waiter of followUp.waiters) {
        waiter.resolve(this.unavailableResolution(waiter.asset, 'disposed'));
      }
    }
    this.followUps.clear();

    for (const running of this.runningJobs.values()) {
      for (const waiter of running.waiters) {
        waiter.resolve(this.unavailableResolution(waiter.asset, 'disposed'));
      }
      running.waiters = [];
    }

    this.retryCounts.clear();
    this.recoveryStates.clear();

    try {
      this.db.close();
    } catch (e) {
      console.warn('[assets] failed to close asset db', e);
    }
  }
}
