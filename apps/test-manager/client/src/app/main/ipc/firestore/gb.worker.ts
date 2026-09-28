import { parentPort } from 'node:worker_threads';
import type {
  FirestoreIndexItemRow,
  FirestoreIndexShardReplacement,
  FirestoreStoredDocMutation,
  FirestoreStoredDocRow,
  FirestoreSyncStateRow,
  WorkerRequestEnvelope,
} from '@shared/types/contracts';
import Database from 'better-sqlite3';

let db: Database.Database | null = null;

const respond = (
  requestId: string,
  res: { ok: true; data: unknown } | { ok: false; error: string },
) => parentPort?.postMessage({ requestId, ...res });

// スキーママイグレーション
const migrateOutbox = (db: Database.Database) => {
  if (!db) return;
  const cols = db.prepare(`PRAGMA table_info('outbox')`).all() as Array<{
    name: string;
  }>;
  const names = new Set(cols.map((c) => c.name));
  const run = (sql: string) => db.prepare(sql).run();

  if (!names.has('next_attempt_at_ms')) {
    run(
      `ALTER TABLE outbox ADD COLUMN next_attempt_at_ms INTEGER NOT NULL DEFAULT 0`,
    );
  }
  if (!names.has('last_error')) {
    run(`ALTER TABLE outbox ADD COLUMN last_error TEXT`);
  }
  if (!names.has('reserved_at_ms')) {
    run(`ALTER TABLE outbox ADD COLUMN reserved_at_ms INTEGER`);
  }

  // インデックス（存在チェックは簡略化。CREATE IF NOT EXISTS で安全に作成）
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_outbox_status_next_attempt ON outbox(status, next_attempt_at_ms);
    CREATE INDEX IF NOT EXISTS idx_outbox_reserved ON outbox(reserved_at_ms);
  `);
};

// 初期化時にテーブル作成（既存 outbox と同じ DB を使用）
function ensureSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS firestore_docs (
      path TEXT PRIMARY KEY,
      collection_path TEXT NOT NULL,
      doc_id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_seconds INTEGER NOT NULL,
      updated_nanos INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      cached_at_ms INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_firestore_docs_collection_path
      ON firestore_docs(collection_path);
    CREATE INDEX IF NOT EXISTS idx_firestore_docs_collection_doc_id
      ON firestore_docs(collection_path, doc_id);
    
    CREATE TABLE IF NOT EXISTS firestore_sync_state (
      collection_path TEXT PRIMARY KEY,
      cache_ready INTEGER NOT NULL,
      last_full_sync_ms INTEGER,
      last_delta_sync_ms INTEGER,
      last_seen_updated_seconds INTEGER,
      last_seen_updated_nanos INTEGER,
      last_seen_doc_id TEXT,
      auto_rebuild_last_reason TEXT,
      auto_rebuild_same_reason_failures INTEGER NOT NULL DEFAULT 0,
      auto_rebuild_total_failures INTEGER NOT NULL DEFAULT 0,
      auto_rebuild_last_attempt_ms INTEGER,
      auto_rebuild_blocked INTEGER NOT NULL DEFAULT 0,
      auto_rebuild_blocked_reason TEXT,
      last_rebuild_succeeded_ms INTEGER,
      schema_version INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS firestore_index_items (
      shard_path TEXT NOT NULL,
      collection_path TEXT NOT NULL,
      doc_id TEXT NOT NULL,
      updated_seconds INTEGER NOT NULL,
      updated_nanos INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (shard_path, doc_id)
    );

    CREATE INDEX IF NOT EXISTS idx_firestore_index_items_collection_path
      ON firestore_index_items(collection_path);
      CREATE INDEX IF NOT EXISTS idx_firestore_index_items_shard_path
    ON firestore_index_items(shard_path);
  `);
}

type FirestoreStoredDocDbRow = Omit<FirestoreStoredDocRow, 'data'> & {
  data: string;
};

function toFirestoreStoredDocRow(
  row: FirestoreStoredDocDbRow,
): FirestoreStoredDocRow {
  return {
    ...row,
    data: JSON.parse(row.data),
  };
}

function handleFirestoreUpsertStoredDoc(
  db: Database.Database,
  row?:
    | (Omit<FirestoreStoredDocRow, 'cached_at_ms'> & {
        cached_at_ms?: number;
      })
    | undefined,
) {
  if (!row) return false;

  const stmt = db.prepare(`
    INSERT INTO firestore_docs(
      path,
      collection_path,
      doc_id,
      data,
      updated_seconds,
      updated_nanos,
      deleted,
      cached_at_ms
    )
    VALUES (
      @path,
      @collection_path,
      @doc_id,
      @data,
      @updated_seconds,
      @updated_nanos,
      @deleted,
      @cached_at_ms
    )
    ON CONFLICT(path) DO UPDATE SET
      collection_path = excluded.collection_path,
      doc_id = excluded.doc_id,
      data = excluded.data,
      updated_seconds = excluded.updated_seconds,
      updated_nanos = excluded.updated_nanos,
      deleted = excluded.deleted,
      cached_at_ms = excluded.cached_at_ms
  `);

  stmt.run({
    path: row.path,
    collection_path: row.collection_path,
    doc_id: row.doc_id,
    data: JSON.stringify(row.data ?? null),
    updated_seconds: row.updated_seconds,
    updated_nanos: row.updated_nanos,
    deleted: row.deleted,
    cached_at_ms: row.cached_at_ms ?? Date.now(),
  });

  return true;
}

function handleFirestoreDeleteStoredDoc(db: Database.Database, path?: string) {
  if (!path) return false;
  db.prepare(`DELETE FROM firestore_docs WHERE path = ?`).run(path);
  return true;
}

function handleFirestoreGetStoredDocByPath(
  db: Database.Database,
  path?: string,
) {
  if (!path) return null;

  const row = db
    .prepare(
      `SELECT
         path,
         collection_path,
         doc_id,
         data,
         updated_seconds,
         updated_nanos,
         deleted,
         cached_at_ms
       FROM firestore_docs
       WHERE path = ?`,
    )
    .get(path) as FirestoreStoredDocDbRow | undefined;

  return row ? toFirestoreStoredDocRow(row) : null;
}

function handleFirestoreListStoredDocsByCollection(
  db: Database.Database,
  collectionPath?: string,
) {
  if (!collectionPath) return [];

  const rows = db
    .prepare(
      `SELECT
         path,
         collection_path,
         doc_id,
         data,
         updated_seconds,
         updated_nanos,
         deleted,
         cached_at_ms
       FROM firestore_docs
       WHERE collection_path = ?
       ORDER BY path ASC`,
    )
    .all(collectionPath) as FirestoreStoredDocDbRow[];

  return rows.map(toFirestoreStoredDocRow);
}

function handleFirestoreUpsertSyncState(
  db: Database.Database,
  row?: FirestoreSyncStateRow,
) {
  if (!row) return false;

  db.prepare(
    `INSERT INTO firestore_sync_state(
           collection_path,
           cache_ready,
           last_full_sync_ms,
           last_delta_sync_ms,
           last_seen_updated_seconds,
           last_seen_updated_nanos,
           last_seen_doc_id,
           auto_rebuild_last_reason,
           auto_rebuild_same_reason_failures,
           auto_rebuild_total_failures,
           auto_rebuild_last_attempt_ms,
           auto_rebuild_blocked,
           auto_rebuild_blocked_reason,
           last_rebuild_succeeded_ms,
           schema_version
         )
         VALUES (
           @collection_path,
           @cache_ready,
           @last_full_sync_ms,
           @last_delta_sync_ms,
           @last_seen_updated_seconds,
           @last_seen_updated_nanos,
           @last_seen_doc_id,
           @auto_rebuild_last_reason,
           @auto_rebuild_same_reason_failures,
           @auto_rebuild_total_failures,
           @auto_rebuild_last_attempt_ms,
           @auto_rebuild_blocked,
           @auto_rebuild_blocked_reason,
           @last_rebuild_succeeded_ms,
           @schema_version
         )
         ON CONFLICT(collection_path) DO UPDATE SET
           cache_ready = excluded.cache_ready,
           last_full_sync_ms = excluded.last_full_sync_ms,
           last_delta_sync_ms = excluded.last_delta_sync_ms,
           last_seen_updated_seconds = excluded.last_seen_updated_seconds,
           last_seen_updated_nanos = excluded.last_seen_updated_nanos,
           last_seen_doc_id = excluded.last_seen_doc_id,
           auto_rebuild_last_reason = excluded.auto_rebuild_last_reason,
           auto_rebuild_same_reason_failures = excluded.auto_rebuild_same_reason_failures,
           auto_rebuild_total_failures = excluded.auto_rebuild_total_failures,
           auto_rebuild_last_attempt_ms = excluded.auto_rebuild_last_attempt_ms,
           auto_rebuild_blocked = excluded.auto_rebuild_blocked,
           auto_rebuild_blocked_reason = excluded.auto_rebuild_blocked_reason,
           last_rebuild_succeeded_ms = excluded.last_rebuild_succeeded_ms,
           schema_version = excluded.schema_version`,
  ).run(row);

  return true;
}

function handleFirestoreGetSyncStateByCollection(
  db: Database.Database,
  collectionPath?: string,
) {
  if (!collectionPath) return null;

  const row = db
    .prepare(
      `SELECT
             collection_path,
             cache_ready,
             last_full_sync_ms,
             last_delta_sync_ms,
             last_seen_updated_seconds,
             last_seen_updated_nanos,
             last_seen_doc_id,
             auto_rebuild_last_reason,
             auto_rebuild_same_reason_failures,
             auto_rebuild_total_failures,
             auto_rebuild_last_attempt_ms,
             auto_rebuild_blocked,
             auto_rebuild_blocked_reason,
             last_rebuild_succeeded_ms,
             schema_version
           FROM firestore_sync_state
           WHERE collection_path = ?`,
    )
    .get(collectionPath) as FirestoreSyncStateRow | undefined;

  return row ?? null;
}

function handleFirestoreUpsertIndexItems(
  db: Database.Database,
  rows?: FirestoreIndexItemRow[],
) {
  if (!rows || rows.length === 0) return true;

  const stmt = db.prepare(
    `INSERT INTO firestore_index_items(
           shard_path,
           collection_path,
           doc_id,
           updated_seconds,
           updated_nanos,
           deleted
         )
         VALUES (
           @shard_path,
           @collection_path,
           @doc_id,
           @updated_seconds,
           @updated_nanos,
           @deleted
         )
         ON CONFLICT(shard_path, doc_id) DO UPDATE SET
           collection_path = excluded.collection_path,
           updated_seconds = excluded.updated_seconds,
           updated_nanos = excluded.updated_nanos,
           deleted = excluded.deleted`,
  );

  const tx = db.transaction((inputRows: FirestoreIndexItemRow[]) => {
    for (const row of inputRows) {
      stmt.run(row);
    }
  });

  tx(rows);
  return true;
}

function handleFirestoreReplaceIndexItemsByShard(
  db: Database.Database,
  shardPath?: string,
  rows?: FirestoreIndexItemRow[],
) {
  if (!shardPath) return false;

  const insertStmt = db.prepare(
    `INSERT INTO firestore_index_items(
           shard_path,
           collection_path,
           doc_id,
           updated_seconds,
           updated_nanos,
           deleted
         )
         VALUES (
           @shard_path,
           @collection_path,
           @doc_id,
           @updated_seconds,
           @updated_nanos,
           @deleted
         )`,
  );

  const tx = db.transaction(
    (targetShardPath: string, inputRows: FirestoreIndexItemRow[]) => {
      db.prepare(`DELETE FROM firestore_index_items WHERE shard_path = ?`).run(
        targetShardPath,
      );

      for (const row of inputRows) {
        insertStmt.run(row);
      }
    },
  );

  tx(shardPath, rows ?? []);
  return true;
}

function handleFirestoreListIndexItemsByShard(
  db: Database.Database,
  shardPath?: string,
) {
  if (!shardPath) return [];

  const rows = db
    .prepare(
      `SELECT
             shard_path,
             collection_path,
             doc_id,
             updated_seconds,
             updated_nanos,
             deleted
           FROM firestore_index_items
           WHERE shard_path = ?
           ORDER BY doc_id ASC`,
    )
    .all(shardPath) as FirestoreIndexItemRow[];

  return rows;
}

function handleFirestoreDeleteIndexItemsByShard(
  db: Database.Database,
  shardPath?: string,
) {
  if (!shardPath) return false;
  db.prepare(`DELETE FROM firestore_index_items WHERE shard_path = ?`).run(
    shardPath,
  );
  return true;
}

function handleFirestoreApplyLocalSyncTransaction(
  db: Database.Database,
  payload?: {
    docMutations: FirestoreStoredDocMutation[];
    indexShardReplacements: FirestoreIndexShardReplacement[];
    syncState: FirestoreSyncStateRow;
  },
) {
  if (!payload) return false;

  const insertIndexItemStmt = db.prepare(
    `INSERT INTO firestore_index_items(
       shard_path,
       collection_path,
       doc_id,
       updated_seconds,
       updated_nanos,
       deleted
     )
     VALUES (
       @shard_path,
       @collection_path,
       @doc_id,
       @updated_seconds,
       @updated_nanos,
       @deleted
     )`,
  );

  const tx = db.transaction(
    (input: {
      docMutations: FirestoreStoredDocMutation[];
      indexShardReplacements: FirestoreIndexShardReplacement[];
      syncState: FirestoreSyncStateRow;
    }) => {
      for (const mutation of input.docMutations) {
        if (mutation.kind === 'delete') {
          handleFirestoreDeleteStoredDoc(db, mutation.path);
          continue;
        }

        handleFirestoreUpsertStoredDoc(db, mutation.row);
      }

      for (const replacement of input.indexShardReplacements) {
        db.prepare(
          `DELETE FROM firestore_index_items WHERE shard_path = ?`,
        ).run(replacement.shardPath);

        for (const row of replacement.rows) {
          insertIndexItemStmt.run({
            ...row,
            shard_path: replacement.shardPath,
          });
        }
      }

      handleFirestoreUpsertSyncState(db, input.syncState);
    },
  );

  tx(payload);
  return true;
}

const setup = (path: string) => {
  db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  db.exec(`
    CREATE TABLE IF NOT EXISTS docs (
      path TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      update_seconds INTEGER NOT NULL,
      update_nanos INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS outbox (
      mutation_id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      kind TEXT NOT NULL,
      data TEXT,
      status TEXT NOT NULL,
      retries INTEGER NOT NULL,
      created_at_ms INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_docs_update ON docs(update_seconds, update_nanos);
    CREATE INDEX IF NOT EXISTS idx_outbox_created ON outbox(created_at_ms);
  `);

  migrateOutbox(db);
};

parentPort?.on('message', (req: WorkerRequestEnvelope) => {
  const rid = req.requestId;
  try {
    if (req.type === 'init') {
      setup(req.dbPath);
      return respond(rid, { ok: true, data: true });
    }
    if (!db) throw new Error('DB not initialized');

    switch (req.type) {
      case 'putDoc': {
        const stmt = db.prepare(
          `INSERT INTO docs(path, data, update_seconds, update_nanos, updated_at_ms)
           VALUES (@path, @data, @sec, @nanos, @now)
           ON CONFLICT(path) DO UPDATE SET data=excluded.data, update_seconds=excluded.update_seconds, update_nanos=excluded.update_nanos, updated_at_ms=excluded.updated_at_ms`,
        );
        stmt.run({
          path: req.doc.path,
          data: JSON.stringify(req.doc.data ?? null),
          sec: req.doc.update_seconds,
          nanos: req.doc.update_nanos,
          now: Date.now(),
        });
        return respond(rid, { ok: true, data: true });
      }
      case 'removeDoc': {
        db.prepare(`DELETE FROM docs WHERE path = ?`).run(req.path);
        return respond(rid, { ok: true, data: true });
      }
      case 'getDoc': {
        const row = db
          .prepare(`SELECT * FROM docs WHERE path = ?`)
          .get(req.path);
        return respond(rid, { ok: true, data: row ?? null });
      }
      case 'writeOutbox': {
        const stmt = db.prepare(
          `INSERT INTO outbox(mutation_id, path, kind, data, status, retries, created_at_ms, next_attempt_at_ms, last_error, reserved_at_ms)
           VALUES (@id, @path, @kind, @data, 'pending', 0, @now, @now, NULL, NULL)`,
        );
        stmt.run({
          id: req.entry.mutationId,
          path: req.entry.path,
          kind: req.entry.kind,
          data: req.entry.data ? JSON.stringify(req.entry.data) : null,
          now: Date.now(),
        });
        return respond(rid, { ok: true, data: true });
      }
      case 'updateOutbox': {
        db.prepare(
          `UPDATE outbox
       SET status = @status,
           last_error = @err,
           reserved_at_ms = NULL
     WHERE mutation_id = @id`,
        ).run({
          id: req.mutationId,
          status: req.status,
          err: req.status === 'failed' ? (req.lastError ?? null) : null, // 変更
        });

        return respond(rid, { ok: true, data: true });
      }
      case 'deleteOutboxByIds': {
        const ids = req.mutationIds;

        if (!Array.isArray(ids) || ids.length === 0) {
          return respond(rid, { ok: true, data: true });
        }

        const placeholders = ids.map(() => '?').join(', ');
        db.prepare(
          `DELETE FROM outbox
           WHERE mutation_id IN (${placeholders})
             AND status IN ('committed', 'failed')`,
        ).run(...ids);

        return respond(rid, { ok: true, data: true });
      }
      case 'readOutboxPending': {
        const now = Date.now();
        const rows = db
          .prepare(
            `SELECT * FROM outbox
             WHERE status = 'pending' AND (next_attempt_at_ms IS NULL OR next_attempt_at_ms <= @now) AND reserved_at_ms IS NULL
             ORDER BY created_at_ms ASC LIMIT @limit`,
          )
          .all({ now, limit: req.limit });
        return respond(rid, { ok: true, data: rows });
      }
      case 'reserveOutboxPending': {
        const now = Date.now();
        const vt = req.visibilityTimeoutMs;
        const expireThreshold = now - vt;

        const trx = db.transaction(() => {
          if (!db) return [];
          // 期限切れ予約を解除
          db.prepare(
            `UPDATE outbox SET reserved_at_ms = NULL
             WHERE status='pending' AND reserved_at_ms IS NOT NULL AND reserved_at_ms < @expire`,
          ).run({ expire: expireThreshold });

          // 対象 rowid を選ぶ
          const rows = db
            .prepare(
              `SELECT rowid FROM outbox
               WHERE status='pending'
                 AND (next_attempt_at_ms IS NULL OR next_attempt_at_ms <= @now)
                 AND reserved_at_ms IS NULL
               ORDER BY created_at_ms ASC
               LIMIT @limit`,
            )
            .all({ now, limit: req.limit }) as Array<{ rowid: number }>;

          if (rows.length === 0) return [];

          // 予約マーク（rowid IN (...) で原子的に予約）
          const placeholders = rows.map(() => '?').join(', ');
          db.prepare(
            `UPDATE outbox SET reserved_at_ms = @now WHERE rowid IN (${placeholders})`,
          ).run(...rows.map((r) => r.rowid), { now });

          // 予約済みのエントリを返す
          const selected = db
            .prepare(
              `SELECT * FROM outbox WHERE rowid IN (${placeholders}) ORDER BY created_at_ms ASC`,
            )
            .all(...rows.map((r) => r.rowid));
          return selected;
        });

        const selected = trx() as unknown[];
        // console.log('reserveOutboxPending reserved:', selected);
        return respond(rid, { ok: true, data: [...selected] });
      }

      // 再スケジュール
      case 'rescheduleOutbox': {
        db.prepare(
          `UPDATE outbox
             SET retries = @retries,
                 next_attempt_at_ms = @next,
                 last_error = @err,
                 reserved_at_ms = NULL
           WHERE mutation_id = @id`,
        ).run({
          id: req.mutationId,
          retries: req.retries,
          next: req.nextAttemptAtMs,
          err: req.lastError ?? null,
        });
        return respond(rid, { ok: true, data: true });
      }

      // 予約解除
      case 'releaseOutboxReservation': {
        db.prepare(
          `UPDATE outbox SET reserved_at_ms = NULL WHERE mutation_id = ?`,
        ).run(req.mutationId);
        return respond(rid, { ok: true, data: true });
      }

      // スナップショット取得
      case 'getOutboxSnapshot': {
        const rows = db
          .prepare(
            `SELECT mutation_id, path, kind, status, retries, created_at_ms, next_attempt_at_ms, last_error, reserved_at_ms
             FROM outbox ORDER BY created_at_ms ASC`,
          )
          .all();
        return respond(rid, { ok: true, data: [...rows] });
      }
      // 単一エントリ取得
      case 'getOutboxById': {
        const row = db
          .prepare(
            `SELECT mutation_id, path, kind, data, status, retries, created_at_ms, next_attempt_at_ms, last_error, reserved_at_ms
       FROM outbox WHERE mutation_id = ? LIMIT 1`,
          )
          .get(req.mutationId);

        return respond(rid, { ok: true, data: row ?? null });
      }

      // 変更: パス単位コミット時に「更新された行」を返す
      case 'markOutboxCommittedByPath': {
        // トランザクションで対象IDの確定と更新を一括
        const trx = db.transaction((path: string) => {
          if (!db) return [];
          // 1) これからコミットする pending の mutation_id を控える
          const targets = db
            .prepare(
              `SELECT mutation_id FROM outbox
               WHERE status='pending' AND path = ?`,
            )
            .all(path) as Array<{ mutation_id: string }>;

          if (targets.length === 0) return [];

          // 2) 更新
          db.prepare(
            `UPDATE outbox
               SET status='committed', reserved_at_ms = NULL
             WHERE status='pending' AND path = ?`,
          ).run(path);

          // 3) 最新行を取得して返す
          const placeholders = targets.map(() => '?').join(', ');
          const rows = db
            .prepare(
              `SELECT mutation_id, path, kind, data, status, retries,
                      created_at_ms, next_attempt_at_ms, last_error, reserved_at_ms
               FROM outbox
               WHERE mutation_id IN (${placeholders})
               ORDER BY created_at_ms ASC`,
            )
            .all(...targets.map((t) => t.mutation_id));
          return rows;
        });

        const rows = trx(req.path);
        // console.log('markOutboxCommittedByPath updated rows:', rows);
        return respond(rid, { ok: true, data: [...rows] });
      }
      case 'ensureSchema':
        return respond(rid, { ok: true, data: ensureSchema(db) });
      case 'firestoreUpsertStoredDoc':
        return respond(rid, {
          ok: true,
          data: handleFirestoreUpsertStoredDoc(db, req.row),
        });
      case 'firestoreDeleteStoredDoc':
        return respond(rid, {
          ok: true,
          data: handleFirestoreDeleteStoredDoc(db, req.path),
        });
      case 'firestoreGetStoredDocByPath':
        return respond(rid, {
          ok: true,
          data: handleFirestoreGetStoredDocByPath(db, req.path),
        });
      case 'firestoreListStoredDocsByCollection':
        return respond(rid, {
          ok: true,
          data: handleFirestoreListStoredDocsByCollection(
            db,
            req.collectionPath,
          ),
        });
      case 'firestoreUpsertSyncState':
        return respond(rid, {
          ok: true,
          data: handleFirestoreUpsertSyncState(db, req.row),
        });
      case 'firestoreGetSyncStateByCollection':
        return respond(rid, {
          ok: true,
          data: handleFirestoreGetSyncStateByCollection(db, req.collectionPath),
        });
      case 'firestoreUpsertIndexItems':
        return respond(rid, {
          ok: true,
          data: handleFirestoreUpsertIndexItems(db, req.rows),
        });
      case 'firestoreReplaceIndexItemsByShard':
        return respond(rid, {
          ok: true,
          data: handleFirestoreReplaceIndexItemsByShard(
            db,
            req.shardPath,
            req.rows,
          ),
        });
      case 'firestoreListIndexItemsByShard':
        return respond(rid, {
          ok: true,
          data: handleFirestoreListIndexItemsByShard(db, req.shardPath),
        });
      case 'firestoreDeleteIndexItemsByShard':
        return respond(rid, {
          ok: true,
          data: handleFirestoreDeleteIndexItemsByShard(db, req.shardPath),
        });
      case 'firestoreApplyLocalSyncTransaction':
        return respond(rid, {
          ok: true,
          data: handleFirestoreApplyLocalSyncTransaction(db, {
            docMutations: req.docMutations,
            indexShardReplacements: req.indexShardReplacements,
            syncState: req.syncState,
          }),
        });
      default:
        return respond(rid, { ok: false, error: 'Unknown message' });
    }
  } catch (e: unknown) {
    respond(rid, {
      ok: false,
      error: String(e instanceof Error ? e.message : e),
    });
  }
});
