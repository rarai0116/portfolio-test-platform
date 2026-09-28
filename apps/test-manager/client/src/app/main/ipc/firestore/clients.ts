import { ensureAuthClaims } from '@main/services/firebase';
import type {
  CachedDoc,
  FirestoreQuerySpec,
  Version,
} from '@shared/types/contracts';
import {
  collection,
  collectionGroup,
  type DocumentData,
  doc,
  documentId,
  type Firestore,
  getDoc as getDocFn,
  getDocFromServer as getDocFromServerFn,
  getDocs,
  limit as limitFn,
  onSnapshot,
  orderBy as orderByFn,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  updateDoc,
  where as whereFn,
} from 'firebase/firestore';

export {
  auth,
  ensureAuthClaims,
  firestore,
  functions,
  storage,
} from '@main/services/firebase';

let firestoreNetworkSeq = 0;

const isFirestoreNetworkLoggingEnabled = process.env.NODE_ENV !== 'production';

function logFirestoreNetwork(kind: string, detail: Record<string, unknown>) {
  if (!isFirestoreNetworkLoggingEnabled) {
    return;
  }
  firestoreNetworkSeq += 1;
  console.log(`[FirestoreNetwork][${firestoreNetworkSeq}] ${kind}`, detail);
}

// deletedフラグを持つデータは論理削除とみなすヘルパー
const isLogicalDeleted = (data: unknown): boolean => {
  return (
    typeof data === 'object' &&
    data !== null &&
    !Array.isArray(data) &&
    (data as { deleted?: unknown }).deleted === true
  );
};

/**
 * 削除済みdocumentを含む取得結果（設計4.7）。
 * 「存在する有効／存在する削除済み／存在しない」を区別する。
 * 通信・認証失敗は例外として投げ、上位で unavailable に変換する。
 */
export type FirestoreDocLookup =
  | { kind: 'active'; doc: CachedDoc }
  | { kind: 'deleted'; doc: CachedDoc }
  | { kind: 'not-found' };

/**
 * Firestore クライアントのインターフェース
 */
export interface FirestoreClient {
  listenQuery(
    spec: FirestoreQuerySpec,
    onChange: (
      events: Array<{ type: 'added' | 'modified' | 'removed'; doc: CachedDoc }>,
    ) => void,
  ): () => void;
  getOnce(spec: FirestoreQuerySpec): Promise<CachedDoc[]>;
  getDoc(path: string): Promise<CachedDoc | null>;
  applyWrite(payload: {
    kind: 'create' | 'set' | 'update' | 'delete';
    path: string;
    data?: unknown;
  }): Promise<void>;
  /** read権限を持つ認証状態が確立するまで待つ（設計6.4） */
  ensureReadAccess(): Promise<void>;
  /**
   * SDK cache を使わずサーバーの現在値を取得する（設計4.7）。
   * 画像AssetManager専用の内部APIで、公開IPCの返却形式や削除済み除外は変更しない。
   */
  getDocFromServerIncludingDeleted(path: string): Promise<FirestoreDocLookup>;
}

/**
 * Firebase Web SDK を使った実装
 */
export class FirebaseFirestoreClient implements FirestoreClient {
  private readClaimsReady: Promise<void> | null = null;
  private writeClaimsReady: Promise<void> | null = null;

  constructor(private readonly fs: Firestore) {}

  private ensureReadReady() {
    if (!this.readClaimsReady) {
      this.readClaimsReady = ensureAuthClaims({
        requireRead: true,
        timeoutMs: 15_000,
      }).finally(() => {
        this.readClaimsReady = null;
      });
    }
    return this.readClaimsReady;
  }

  private ensureWriteReady() {
    if (!this.writeClaimsReady) {
      this.writeClaimsReady = ensureAuthClaims({
        requireWrite: true,
        timeoutMs: 15_000,
      }).finally(() => {
        this.writeClaimsReady = null;
      });
    }
    return this.writeClaimsReady;
  }

  listenQuery(
    spec: FirestoreQuerySpec,
    onChange: (
      events: Array<{ type: 'added' | 'modified' | 'removed'; doc: CachedDoc }>,
    ) => void,
  ): () => void {
    void this.ensureReadReady().catch((e) => {
      console.error('listenQuery: auth/claims not ready:', e);
    });

    const q = buildQuery(this.fs, spec);
    const stop = onSnapshot(
      q,
      (snap) => {
        if (!snap.metadata.fromCache) {
          logFirestoreNetwork('listenQuery', {
            collectionPath: spec.collectionPath,
            group: spec.group ?? false,
            size: snap.size,
            changes: snap.docChanges().length,
          });
        }
        const changes = snap
          .docChanges()
          .filter((ch) => !ch.doc.metadata.hasPendingWrites)
          .map((ch) => {
            const data = ch.doc.data();
            const docPath = ch.doc.ref.path;
            const updateTime = readVersionFromData(data);
            const cd: CachedDoc = {
              key: ch.doc.id,
              path: docPath,
              data,
              updateTime,
            };

            if (isLogicalDeleted(data)) {
              return {
                type: 'removed' as const,
                doc: cd,
              };
            }

            return {
              type: ch.type as 'added' | 'modified' | 'removed',
              doc: cd,
            };
          });
        if (changes.length) onChange(changes);
      },
      (err: unknown) => {
        console.warn('Firestore listen error', err);
      },
    );
    return () => stop();
  }

  async getOnce(spec: FirestoreQuerySpec): Promise<CachedDoc[]> {
    await this.ensureReadReady();

    const MAX_PAGE = 1000;
    const wantTotal = !spec.limit ? Number.POSITIVE_INFINITY : spec.limit;

    // 基本制約を構築（where / orderBy）
    const baseConstraints: QueryConstraint[] = [];
    for (const [f, op, v] of spec.where ?? []) {
      baseConstraints.push(whereFn(f, op, v));
    }
    const userOrderBys = spec.orderBy ?? [];
    for (const [f, dir] of userOrderBys) {
      baseConstraints.push(orderByFn(f, dir ?? 'asc'));
    }
    const hasOrderBy = userOrderBys.length > 0;

    if (!hasOrderBy) {
      // startAfter を使うため、orderBy がなければ documentId で安定化
      baseConstraints.push(orderByFn(documentId()));
    }

    // collection / collectionGroup の選択
    const base = spec.group
      ? collectionGroup(this.fs, spec.collectionPath)
      : collection(this.fs, spec.collectionPath);

    // ページングループ
    const docsOut: CachedDoc[] = [];
    let lastCursor: QueryDocumentSnapshot | undefined;
    while (docsOut.length < wantTotal) {
      const remaining = wantTotal - docsOut.length;
      const pageSize = Math.min(MAX_PAGE, remaining);

      const pageConstraints = [...baseConstraints, limitFn(pageSize)];
      if (lastCursor) {
        pageConstraints.push(startAfter(lastCursor));
      }

      const q = query(base, ...pageConstraints);
      const snap = await getDocs(q).catch((e) => {
        console.error('Firestore getDocs error', q, e);
        throw e;
      });
      if (!snap.metadata.fromCache) {
        logFirestoreNetwork('getDocs', {
          collectionPath: spec.collectionPath,
          group: spec.group ?? false,
          pageSize,
          returned: snap.docs.length,
        });
      }
      for (const d of snap.docs) {
        const data = d.data();
        if (isLogicalDeleted(data)) {
          continue;
        }

        const docPath = d.ref.path;
        const updateTime = readVersionFromData(data);
        docsOut.push({ key: d.id, path: docPath, data, updateTime });
      }

      if (snap.docs.length < pageSize) {
        // これ以上なし
        break;
      }
      lastCursor = snap.docs[snap.docs.length - 1];
    }

    return docsOut;
  }

  async getDoc(path: string): Promise<CachedDoc | null> {
    await this.ensureReadReady();

    const ref = doc(this.fs, path);
    const snap = await getDocFn(ref);

    if (!snap.exists()) {
      return null;
    }

    if (!snap.metadata.fromCache) {
      logFirestoreNetwork('getDoc', { path });
    } else {
      console.log('[firestore-cache-hit] getDoc', { path });
    }

    const data = snap.data();
    if (isLogicalDeleted(data)) {
      return null;
    }
    return {
      key: snap.id,
      path: snap.ref.path,
      data,
      updateTime: readVersionFromData(data),
    };
  }

  async ensureReadAccess(): Promise<void> {
    await this.ensureReadReady();
  }

  async getDocFromServerIncludingDeleted(
    path: string,
  ): Promise<FirestoreDocLookup> {
    await this.ensureReadReady();

    const ref = doc(this.fs, path);
    // SDK cache を使わずサーバーの現在値だけを見る。
    const snap = await getDocFromServerFn(ref);

    logFirestoreNetwork('getDocFromServerIncludingDeleted', { path });

    if (!snap.exists()) {
      return { kind: 'not-found' };
    }

    const data = snap.data();
    const cached: CachedDoc = {
      key: snap.id,
      path: snap.ref.path,
      data,
      updateTime: readVersionFromData(data),
    };

    return isLogicalDeleted(data)
      ? { kind: 'deleted', doc: cached }
      : { kind: 'active', doc: cached };
  }

  async applyWrite(payload: {
    kind: 'create' | 'set' | 'update' | 'delete';
    path: string;
    data?: unknown;
  }): Promise<void> {
    await this.ensureWriteReady();

    const ref = doc(this.fs, payload.path);
    if (payload.kind === 'delete') {
      await runTransaction(this.fs, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) {
          return;
        }

        tx.set(
          ref,
          {
            ...(snap.data() as DocumentData),
            deleted: true,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      });
      return;
    }

    let obj: DocumentData | undefined;
    if (payload.data !== undefined) {
      if (typeof payload.data === 'string') {
        try {
          obj = JSON.parse(payload.data);
        } catch {
          throw new Error('Invalid JSON data');
        }
      } else {
        obj = payload.data as DocumentData;
      }
    }
    if (payload.kind === 'create') {
      let alreadyExists = false;

      await runTransaction(this.fs, async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists()) {
          alreadyExists = true;
          return;
        }

        tx.set(ref, {
          ...(obj ?? {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      if (alreadyExists) {
        throw new Error(`Document already exists: ${payload.path}`);
      }

      return;
    }

    if (payload.kind === 'update') {
      // update は updatedAt のみ必ず更新。createdAt は触らない
      await updateDoc(ref, {
        ...(obj ?? {}),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    // set は初回作成時のみ createdAt を付与。既存なら付与しない
    await runTransaction(this.fs, async (tx) => {
      const snap = await tx.get(ref);
      const base = { ...(obj ?? {}), updatedAt: serverTimestamp() };

      if (snap.exists()) {
        tx.set(ref, base, { merge: true }); // 既存は createdAt を変更しない
      } else {
        tx.set(ref, { ...base, createdAt: serverTimestamp() }, { merge: true });
      }
    });
  }
}

// Firestore Timestamp 互換のオブジェクトから Version へ
export const toVersion = (ts: {
  seconds: number;
  nanoseconds: number;
}): Version => ({
  seconds: ts.seconds,
  nanos: ts.nanoseconds,
});

/** FirestoreDocument から Version を取得 */
function readVersionFromData(data: DocumentData): Version {
  const d = data;
  const ts = d?.updatedAt ?? null;
  if (
    ts &&
    typeof ts.seconds === 'number' &&
    typeof ts.nanoseconds === 'number'
  ) {
    return { seconds: ts.seconds, nanos: ts.nanoseconds };
  }
  // フォールバック（未知の順序扱い）
  return { seconds: 0, nanos: 0 };
}

// FirestoreQuerySpec から Query を構築
function buildQuery(fs: Firestore, spec: FirestoreQuerySpec) {
  const constraints: QueryConstraint[] = [];
  for (const [f, op, v] of spec.where ?? []) {
    constraints.push(whereFn(f, op, v));
  }
  for (const [f, dir] of spec.orderBy ?? []) {
    constraints.push(orderByFn(f, dir ?? 'asc'));
  }
  if (spec.limit) constraints.push(limitFn(spec.limit));

  if (spec.group) {
    // コレクショングループ: collectionPath は 'images' のような単一ID想定
    const base = collectionGroup(fs, spec.collectionPath);
    return query(base, ...constraints);
  }
  // 通常: 単一親（サブ）コレクションのフルパス
  const base = collection(fs, spec.collectionPath);
  return query(base, ...constraints);
}
