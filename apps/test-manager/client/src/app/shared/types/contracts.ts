import type { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

export type GradeId = 'firstGrade' | 'secondGrade';
export type GradeKey = '1級' | '2級';
export type TestSubject = '学科Ⅰ' | '学科Ⅱ' | '学科Ⅲ' | '学科Ⅳ' | '学科Ⅴ';

export type Version = { seconds: number; nanos: number };
export const isNewer = (a: Version | undefined, b: Version) =>
  !a || a.seconds < b.seconds || (a.seconds === b.seconds && a.nanos < b.nanos);

export type QueryKey = string;

export type OrderDirection = 'asc' | 'desc';
export type WhereOp =
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'in'
  | 'not-in'
  | 'array-contains'
  | 'array-contains-any';

export type FirestoreQuerySpec = {
  // 例:
  // - 単一親のサブコレクション: 'firstGrade/images'
  // - コレクショングループ: 'images'（group: true のときはコレクションIDのみ）
  collectionPath: string;
  group?: boolean;
  where?: Array<[field: string, op: WhereOp, value: unknown]>;
  orderBy?: Array<[field: string, dir?: OrderDirection]>;
  limit?: number;
};

const WhereSchema = z
  .array(z.tuple([z.string(), z.custom<WhereOp>(), z.unknown()]))
  .optional();
const OrderBySchema = z
  .array(z.tuple([z.string(), z.enum(['asc', 'desc']).optional()]))
  .optional();
const LimitSchema = z.number().int().positive().optional();

export const FirestoreQuerySpecSchema: z.ZodType<FirestoreQuerySpec> = z
  .object({
    mode: z.literal('collection').or(z.literal('collectionGroup')).optional(), // 内部用
    collectionPath: z.string().min(1),
    group: z.boolean().optional(),
    where: WhereSchema,
    orderBy: OrderBySchema,
    limit: LimitSchema,
  })
  // group=true のときは collectionPath にスラッシュを含めない（=コレクションID）
  .refine((s) => !s.group || !s.collectionPath.includes('/'), {
    message:
      'group=true のとき collectionPath には単一のコレクションIDを指定してください（"/" は使えません）',
    path: ['collectionPath'],
  });

export type CachedDoc = {
  key: string;
  path: string;
  data?: unknown;
  updateTime: Version; // Firestore snapshot's updateTime
};

export type PatchEvent = {
  key: QueryKey;
  type: 'added' | 'modified' | 'reset' | 'removed';
  doc: CachedDoc;
};

export type SubscribePayload = {
  windowId: number;
  key: QueryKey;
  spec: FirestoreQuerySpec;
};
export type UnsubscribePayload = { windowId: number; key: QueryKey };
export type SetActiveKeysPayload = {
  windowId: number;
  keys: QueryKey[];
  specs: Record<QueryKey, FirestoreQuerySpec>;
};
export type PingPayload = { windowId: number };

export type GetOncePayload = { key: QueryKey; spec: FirestoreQuerySpec };
export type GetOnceResult = { key: QueryKey; docs: CachedDoc[] };

export type GetDocPayload = { path: string };
export type GetDocResult = { doc: CachedDoc | null };

export type BatchGetDocsPayload = { paths: string[] };
export type BatchGetDocsResult = {
  docs: Record<string, CachedDoc | null>;
};

export type SyncCacheIndexEntriesPayload = {
  collectionPath: string;
  docIds: string[];
};

export type SyncCacheIndexEntriesResult = {
  collectionPath: string;
  requestedDocCount: number;
  syncedDocCount: number;
  touchedShardCount: number;
};

export type FirestoreCacheMetrics = {
  remote: {
    fullSyncCount: number;
    deltaFetchDocCount: number;
    indexSnapshotCount: number;
    returnedDocCount: number;
  };
  local: {
    queryCount: number;
    getDocCount: number;
    returnedDocCount: number;
  };
  cache: {
    hitCount: number;
    missCount: number;
  };
  sync: {
    rebuildCount: number;
    lastReason?: string;
  };
  asset: {
    localFileHitCount: number;
    localFileMissCount: number;
    base64EmitCount: number;
    downloadCount: number;
    downloadBytes: number;
    metaCacheHitCount: number;
    metaInvalidationCount: number;
    lastInvalidationReason?: string;
  };
};

export type GetFirestoreCacheMetricsResult = {
  metrics: FirestoreCacheMetrics;
};

export type ResetFirestoreCacheMetricsResult = { ok: true };

export type FirestoreStoredDocRow = {
  path: string;
  collection_path: string;
  doc_id: string;
  data: unknown;
  updated_seconds: number;
  updated_nanos: number;
  deleted: number;
  cached_at_ms: number;
};

export type FirestoreStoredDocUpsertInput = Omit<
  FirestoreStoredDocRow,
  'cached_at_ms'
> & {
  cached_at_ms?: number;
};

export type firestoreUpsertStoredDoc = {
  type: 'firestoreUpsertStoredDoc';
  row: FirestoreStoredDocUpsertInput;
};

export type firestoreDeleteStoredDoc = {
  type: 'firestoreDeleteStoredDoc';
  path: string;
};

export type firestoreGetStoredDocByPath = {
  type: 'firestoreGetStoredDocByPath';
  path: string;
};

export type firestoreListStoredDocsByCollection = {
  type: 'firestoreListStoredDocsByCollection';
  collectionPath: string;
};

export type MutatePayload =
  | {
      mutationId: string;
      kind: 'create' | 'set' | 'update';
      path: string;
      data: unknown;
    }
  | { mutationId: string; kind: 'delete'; path: string; data: undefined };
export type MutateAccepted = { mutationId: string; status: 'accepted' };
export type MutateCommitted = {
  mutationId: string;
  status: 'committed';
  path: string;
  updateTime: Version;
};
export type MutateFailed = {
  mutationId: string;
  status: 'failed';
  error: string;
};

export type OutboxItem = {
  mutationId: string;
  path: string;
  kind: 'create' | 'set' | 'update' | 'delete';
  status: 'pending' | 'committed' | 'failed';
  retries: number;
  createdAtMs: number;
  lastError?: string;
};

export type OutboxUpdate =
  | { type: 'enqueued' | 'committed' | 'failed' | 'retry'; item: OutboxItem }
  | { type: 'snapshot'; items: OutboxItem[] };

export type OutboxRow = {
  mutation_id: string;
  path: string;
  kind: 'create' | 'set' | 'update' | 'delete';
  data?: unknown;
  status: 'pending' | 'committed' | 'failed';
  retries: number;
  created_at_ms: number;
  next_attempt_at_ms: number;
  last_error?: string | null;
  reserved_at_ms?: number | null;
};
// リクエスト/レスポンスに付与する相関ID封筒
export type WorkerRequestEnvelope = WorkerRequest & {
  requestId: string;
  doc?: Doc;
};

export type WorkerResponse = (
  | { ok: true; data: unknown }
  | { ok: false; error: string }
) & { requestId: string };

// リクエスト種別ごとの返却データ型
export type WorkerResponseData<M extends WorkerRequest> =
  M['type'] extends 'init'
    ? boolean
    : M['type'] extends 'writeOutbox'
      ? boolean
      : M['type'] extends 'updateOutbox'
        ? boolean
        : M['type'] extends 'deleteOutboxByIds'
          ? boolean
          : M['type'] extends 'rescheduleOutbox'
            ? boolean
            : M['type'] extends 'releaseOutboxReservation'
              ? boolean
              : M['type'] extends 'readOutboxPending'
                ? OutboxRow[]
                : M['type'] extends 'reserveOutboxPending'
                  ? OutboxRow[]
                  : M['type'] extends 'getOutboxSnapshot'
                    ? OutboxRow[]
                    : M['type'] extends 'getOutboxById'
                      ? OutboxRow | null
                      : M['type'] extends 'markOutboxCommittedByPath'
                        ? OutboxRow[]
                        : M['type'] extends 'firestoreUpsertStoredDoc'
                          ? boolean
                          : M['type'] extends 'firestoreDeleteStoredDoc'
                            ? boolean
                            : M['type'] extends 'firestoreGetStoredDocByPath'
                              ? FirestoreStoredDocRow | null
                              : M['type'] extends 'firestoreListStoredDocsByCollection'
                                ? FirestoreStoredDocRow[]
                                : M['type'] extends 'firestoreUpsertSyncState'
                                  ? boolean
                                  : M['type'] extends 'firestoreGetSyncStateByCollection'
                                    ? FirestoreSyncStateRow | null
                                    : M['type'] extends 'firestoreUpsertIndexItems'
                                      ? boolean
                                      : M['type'] extends 'firestoreReplaceIndexItemsByShard'
                                        ? boolean
                                        : M['type'] extends 'firestoreListIndexItemsByShard'
                                          ? FirestoreIndexItemRow[]
                                          : M['type'] extends 'firestoreDeleteIndexItemsByShard'
                                            ? boolean
                                            : M['type'] extends 'firestoreApplyLocalSyncTransaction'
                                              ? boolean
                                              : never;

export const Channels = {
  setActiveKeys: 'fs:setActiveKeys',
  ping: 'fs:ping',
  getOnce: 'fs:getOnce',
  getDoc: 'fs:getDoc',
  batchGetDocs: 'fs:batchGetDocs',
  syncCacheIndexEntries: 'fs:syncCacheIndexEntries',
  getFirestoreCacheMetrics: 'fs:getFirestoreCacheMetrics',
  resetFirestoreCacheMetrics: 'fs:resetFirestoreCacheMetrics',
  mutate: 'fs:mutate',
  patch: 'fs:patch', // main -> renderer
  mutationAccepted: 'fs:mutationAccepted',
  mutationCommitted: 'fs:mutationCommitted',
  mutationFailed: 'fs:mutationFailed',
  outboxUpdate: 'fs:outboxUpdate',
  getOutbox: 'fs:getOutbox',
} as const;

export type Doc = {
  path: string;
  key: string;
  data: unknown;
  update_seconds: number;
  update_nanos: number;
};
// メッセージ契約
export type WorkerInit = { type: 'init'; dbPath: string };
export type PutDoc = {
  type: 'putDoc';
  doc: Doc;
};
export type RemoveDoc = { type: 'removeDoc'; path: string };
export type GetDoc = { type: 'getDoc'; path: string };
export type WriteOutbox = {
  type: 'writeOutbox';
  entry: {
    mutationId: string;
    path: string;
    kind: 'create' | 'set' | 'update' | 'delete';
    data?: unknown;
  };
};
export type UpdateOutbox = {
  type: 'updateOutbox';
  mutationId: string;
  status: 'committed' | 'failed';
  lastError?: string;
};
export type DeleteOutboxByIds = {
  type: 'deleteOutboxByIds';
  mutationIds: string[];
};
export type ReadOutboxPending = { type: 'readOutboxPending'; limit: number };

export type ReserveOutboxPending = {
  type: 'reserveOutboxPending';
  limit: number;
  visibilityTimeoutMs: number;
};
export type RescheduleOutbox = {
  type: 'rescheduleOutbox';
  mutationId: string;
  retries: number;
  nextAttemptAtMs: number;
  lastError?: string;
};
export type ReleaseOutboxReservation = {
  type: 'releaseOutboxReservation';
  mutationId: string;
};
export type MarkOutboxCommittedByPath = {
  type: 'markOutboxCommittedByPath';
  path: string;
};
export type GetOutboxSnapshot = { type: 'getOutboxSnapshot' };
export type GetOutboxById = { type: 'getOutboxById'; mutationId: string };

export type ensureSchema = { type: 'ensureSchema' };

export type FirestoreSyncStateRow = {
  collection_path: string;
  cache_ready: number;
  last_full_sync_ms: number | null;
  last_delta_sync_ms: number | null;
  last_seen_updated_seconds: number | null;
  last_seen_updated_nanos: number | null;
  last_seen_doc_id: string | null;
  auto_rebuild_last_reason: string | null;
  auto_rebuild_same_reason_failures: number;
  auto_rebuild_total_failures: number;
  auto_rebuild_last_attempt_ms: number | null;
  auto_rebuild_blocked: number;
  auto_rebuild_blocked_reason: string | null;
  last_rebuild_succeeded_ms: number | null;
  schema_version: number;
};

export type FirestoreIndexItemRow = {
  shard_path: string;
  collection_path: string;
  doc_id: string;
  updated_seconds: number;
  updated_nanos: number;
  deleted: number;
};

export type FirestoreStoredDocMutation =
  | {
      kind: 'upsert';
      row: FirestoreStoredDocUpsertInput;
    }
  | {
      kind: 'delete';
      path: string;
    };

export type FirestoreIndexShardReplacement = {
  shardPath: string;
  rows: FirestoreIndexItemRow[];
};

export type firestoreApplyLocalSyncTransaction = {
  type: 'firestoreApplyLocalSyncTransaction';
  docMutations: FirestoreStoredDocMutation[];
  indexShardReplacements: FirestoreIndexShardReplacement[];
  syncState: FirestoreSyncStateRow;
};

export type firestoreUpsertSyncState = {
  type: 'firestoreUpsertSyncState';
  row: FirestoreSyncStateRow;
};

export type firestoreGetSyncStateByCollection = {
  type: 'firestoreGetSyncStateByCollection';
  collectionPath: string;
};

export type firestoreUpsertIndexItems = {
  type: 'firestoreUpsertIndexItems';
  rows: FirestoreIndexItemRow[];
};

export type firestoreReplaceIndexItemsByShard = {
  type: 'firestoreReplaceIndexItemsByShard';
  shardPath: string;
  rows: FirestoreIndexItemRow[];
};

export type firestoreListIndexItemsByShard = {
  type: 'firestoreListIndexItemsByShard';
  shardPath: string;
};

export type firestoreDeleteIndexItemsByShard = {
  type: 'firestoreDeleteIndexItemsByShard';
  shardPath: string;
};

export type WorkerRequest =
  | WorkerInit
  | GetOutboxById
  | PutDoc
  | RemoveDoc
  | GetDoc
  | WriteOutbox
  | UpdateOutbox
  | DeleteOutboxByIds
  | ReadOutboxPending
  | ReserveOutboxPending
  | RescheduleOutbox
  | ReleaseOutboxReservation
  | MarkOutboxCommittedByPath
  | GetOutboxSnapshot
  | ensureSchema
  | firestoreUpsertStoredDoc
  | firestoreDeleteStoredDoc
  | firestoreGetStoredDocByPath
  | firestoreListStoredDocsByCollection
  | firestoreUpsertSyncState
  | firestoreGetSyncStateByCollection
  | firestoreUpsertIndexItems
  | firestoreReplaceIndexItemsByShard
  | firestoreListIndexItemsByShard
  | firestoreDeleteIndexItemsByShard
  | firestoreApplyLocalSyncTransaction;

export type Ok<T = unknown> = { ok: true; data: T };
export type Err = { ok: false; error: string };

export type AssetData = {
  grade: GradeId;
  key: string;
  // 論理削除フラグ。既存documentでは欠落し得るため、欠落時はactiveとして扱う。
  deleted?: boolean;
  objectPath?: string;
  md5Hash?: string;
  contentType?: string; // 例: image/png
  size?: number;
  subject?: TestSubject;
  bigCategoryTag?: string;
  smallCategoryTag?: string;
  tag?: string[];
  title?: string;
  usedIds?: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  width?: number;
  height?: number;
};

export type TestDataStatus = 'エラー' | '準備中' | '準備完了' | '停止中';

export const questionEditorType = {
  normal: 'normal',
  table: 'table',
  noChoice: 'noChoice',
} as const;

export type questionEditorType =
  (typeof questionEditorType)[keyof typeof questionEditorType];

export const answerEditorType = {
  normal: 'normal',
  noHonbun: 'noHonbun',
  partialNoChoice: 'partialNoChoice',
  noChoice: 'noChoice',
} as const;

export type answerEditorType =
  (typeof answerEditorType)[keyof typeof answerEditorType];

export type EditorKeyName =
  | 'text'
  | 'ch1'
  | 'ch2'
  | 'ch3'
  | 'ch4'
  | 'ch5'
  | 'answerText'
  | 'answerText1'
  | 'answerText2'
  | 'answerText3'
  | 'answerText4'
  | 'answerText5';

export const META_KEYS: Array<keyof TestData> = [
  'subject',
  'answerNumber',
  'nengo',
  'year',
  'testNo',
  'publicationYear',
  'publicationNo',
  'difficult',
  'grade',
  'bigCategoryTag',
  'smallCategoryTag',
  'themeTag',
  'otherTags',
];

export type AutoCheckResult = {
  status: 'success' | 'warning' | 'error';
  failedKeys: string[]; // editor/meta/editorTypeの欠落キーをまとめて返す
  // 付加情報（利用者が詳細把握できるように）
  missingEditorKeys: EditorKeyName[];
  missingMetaKeys: Array<keyof TestData>;
  missingEditorType: Array<'questionEditorType' | 'answerEditorType'>;
  ignoredKeys: EditorKeyName[];
  duplicatePastExamIds: string[];
};

export type TestData = {
  [key: string]: string | number | boolean | Timestamp | string[] | undefined;
  active: boolean;
  //  answer?: string; // 不要
  answerNumber: string;
  answerText: string;
  answerText1: string;
  answerText2: string;
  answerText3: string;
  answerText4: string;
  answerText5: string;
  answerOld?: string;
  bigCategoryTag: string;
  ch1: string;
  ch2: string;
  ch3: string;
  ch4: string;
  ch5: string;
  questionOld?: string;
  difficult: string;
  grade: number;
  isConvertibleQaa: boolean;
  isShuffleable?: boolean; // 選択肢シャッフル可否（未設定は false 扱い）
  isNegativeAnswer: boolean;
  nengo: string;
  no: number;
  //  parentAnswerHonbun?: string; // 不要
  //  parentHonbun?: string; // 不要
  parentNo: number;
  parentbNo?: string; //   publicationYearとpublicationNoに分解後不要
  smallCategoryTag: string;
  status: TestDataStatus;
  subject: TestSubject;
  testNo: string;
  text: string;
  themeTag: string;
  year: string;
  //  isWeakPoint?: boolean; // 不要
  //  isAnswered?: boolean; // 不要
  id?: string;
  //  parentText?: string; // 不要:親の選択肢問時の問題本文
  //  parentAnswerText?: string; // 不要:親の選択肢問時の解説本文
  //  parentChoice?: number; // 不要:親の選択肢問時の選択肢番号
  otherTags?: string[]; // その他タグ
  publicationYear?: string; // 発行年
  publicationNo?: string; // 発行本での通し番号
  isOriginal?: boolean; // オリジナル問題フラグ
  questionEditorType?: questionEditorType; // エディタタイプ
  answerEditorType?: answerEditorType; // エディタタイプ
  autoCheck?: boolean; // 自動チェック通過フラグ
  calibrationCheck?: boolean; // 校正チェック通過フラグ
  questionMetaFileName?: string; // 問題メタファイル名
  answerMetaFileName?: string; // 解説メタファイル名
  updatedAt?: Timestamp; // 最終更新日時
  uuid?: string; // 問題データの不変識別子（UUIDv4）。backfill完了前は未設定の場合がある
};

/*
export type NewTestData = {
  [key: string]: string | number | boolean | string[] | Timestamp | undefined;
  id: string; // ID(現在は通し番号)
  autoCheck: boolean; // 自動チェック通過フラグ
  hunterCheck: boolean; // 人力チェック通過フラグ

  answerNumber: string;
  answerText: string;
  answerCh1: string;
  answerCh2: string;
  answerCh3: string;
  answerCh4: string;
  answerCh5: string;
  text: string;
  ch1: string;
  ch2: string;
  ch3: string;
  ch4: string;
  ch5: string;
  difficult: string;
  grade: number;
  isConvertibleQaa: boolean;
  isNegativeAnswer: boolean;
  nengo: string;
  subject: string;
  bigCategoryTag: string;
  smallCategoryTag: string;
  themeTag: string;
  publicationYear: string;
  publicationNo: string; // 発行本での通し番号
  testNo: string; // 実際の試験での通し番号
  otherTags?: string[]; // その他タグ
  isOriginal?: boolean; // オリジナル問題フラグ
  updatedAt?: Timestamp; // 更新日時
};
*/
