import Database from 'better-sqlite3';

/**
 * 論理削除状態（設計6.1）
 * - 0: active確認済み。通常処理可
 * - 1: 削除済み。配信・download・ready禁止
 * - null: 旧schemaから移行した未確認行。サーバー確認まで配信・download・ready禁止
 */
export type AssetDeletedState = 0 | 1 | null;

export type AssetRow = {
  grade: 'firstGrade' | 'secondGrade';
  key: string;
  object_path?: string | null;
  md5_hash?: string | null;
  content_type?: string | null;
  size?: number | null;
  local_file_path?: string | null;
  updated_at_ms?: number | null; // Firestore側の更新時刻相当（任意）
  last_accessed_at_ms?: number | null;
  status?: 'ready' | 'downloading' | 'failed' | null;
  retries?: number | null;
  last_error?: string | null;
  deleted?: AssetDeletedState;
};

export class AssetDB {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    try {
      this.init();
    } catch (e) {
      // migration失敗時は旧schemaのまま起動させない（設計6.2）。
      try {
        this.db.close();
      } catch {
        // close失敗は元のエラーを優先する
      }
      throw e;
    }
  }

  private init() {
    this.db
      .prepare(
        `
        CREATE TABLE IF NOT EXISTS assets (
          grade TEXT NOT NULL,
          key TEXT NOT NULL,
          object_path TEXT,
          md5_hash TEXT,
          content_type TEXT,
          size INTEGER,
          local_file_path TEXT,
          updated_at_ms INTEGER,
          last_accessed_at_ms INTEGER,
          status TEXT CHECK(status IN ('ready','downloading','failed')),
          retries INTEGER DEFAULT 0,
          last_error TEXT,
          deleted INTEGER,
          PRIMARY KEY (grade, key)
        );
        `,
      )
      .run();

    this.db
      .prepare(
        `CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);`,
      )
      .run();

    this.migrateDeletedColumn();
  }

  /**
   * 旧schema（deleted列なし）のDBへ deleted 列を追加する（設計6.2）。
   * 既存行は未確認を表す NULL のまま残し、メタ情報とローカルファイル情報は保持する。
   * 通常のstatement利用前に呼ぶ必要がある。再実行しても安全。
   */
  private migrateDeletedColumn() {
    const columns = this.db
      .prepare(`PRAGMA table_info(assets)`)
      .all() as Array<{
      name: string;
    }>;

    if (columns.some((column) => column.name === 'deleted')) {
      return;
    }

    this.db.transaction(() => {
      this.db.prepare(`ALTER TABLE assets ADD COLUMN deleted INTEGER`).run();
    })();
  }

  close() {
    this.db.close();
  }

  /**
   * メタ情報を反映する。`deleted` を省略した場合は既存値を維持するため、
   * activeメタを書き込む経路は必ず `deleted: 0` を明示する（設計6.2）。
   */
  upsertMeta(row: Partial<AssetRow> & { grade: string; key: string }) {
    this.db
      .prepare(
        `
        INSERT INTO assets (grade, key, object_path, md5_hash, content_type, size, updated_at_ms, status, deleted)
        VALUES (@grade, @key, @object_path, @md5_hash, @content_type, @size, @updated_at_ms, @status, @deleted)
        ON CONFLICT(grade, key) DO UPDATE SET
          object_path = COALESCE(excluded.object_path, assets.object_path),
          md5_hash = COALESCE(excluded.md5_hash, assets.md5_hash),
          content_type = COALESCE(excluded.content_type, assets.content_type),
          size = COALESCE(excluded.size, assets.size),
          updated_at_ms = COALESCE(excluded.updated_at_ms, assets.updated_at_ms),
          status = COALESCE(excluded.status, assets.status),
          deleted = COALESCE(excluded.deleted, assets.deleted)
        `,
      )
      .run({
        grade: row.grade,
        key: row.key,
        object_path: row.object_path ?? null,
        md5_hash: row.md5_hash ?? null,
        content_type: row.content_type ?? null,
        size: row.size ?? null,
        updated_at_ms: row.updated_at_ms ?? null,
        status: row.status ?? null,
        deleted: row.deleted ?? null,
      });
  }

  /**
   * 論理削除を記録する（設計6.3）。行がない場合も grade / key / deleted=1 の行を作る。
   * 既存行では object path や MD5 等のメタ情報を保持し、
   * local_file_path / status / last_error だけを NULL へ戻す。
   * 権威ある通知時刻がある場合は updated_at_ms も更新する。
   */
  markDeleted(grade: string, key: string, updatedAtMs?: number) {
    this.db
      .prepare(
        `
        INSERT INTO assets (grade, key, updated_at_ms, deleted)
        VALUES (@grade, @key, @updated_at_ms, 1)
        ON CONFLICT(grade, key) DO UPDATE SET
          deleted = 1,
          local_file_path = NULL,
          status = NULL,
          last_error = NULL,
          updated_at_ms = COALESCE(excluded.updated_at_ms, assets.updated_at_ms)
        `,
      )
      .run({ grade, key, updated_at_ms: updatedAtMs ?? null });
  }

  /**
   * サーバー確認でactiveが確定した行を deleted=0 へ戻す（設計6.4）。
   * ローカルキャッシュ情報は変更しない。
   */
  markActive(grade: string, key: string, updatedAtMs?: number) {
    this.db
      .prepare(
        `
        INSERT INTO assets (grade, key, updated_at_ms, deleted)
        VALUES (@grade, @key, @updated_at_ms, 0)
        ON CONFLICT(grade, key) DO UPDATE SET
          deleted = 0,
          updated_at_ms = COALESCE(excluded.updated_at_ms, assets.updated_at_ms)
        `,
      )
      .run({ grade, key, updated_at_ms: updatedAtMs ?? null });
  }

  setStatus(
    grade: string,
    key: string,
    status: AssetRow['status'],
    lastError?: string,
  ) {
    this.db
      .prepare(
        `UPDATE assets SET status = @status, last_error = @last_error WHERE grade=@grade AND key=@key`,
      )
      .run({ grade, key, status, last_error: lastError ?? null });
  }

  setLocalPath(grade: string, key: string, localPath: string) {
    this.db
      .prepare(
        `UPDATE assets SET local_file_path = @p WHERE grade=@g AND key=@k`,
      )
      .run({ p: localPath, g: grade, k: key });
  }

  touchAccess(grade: string, key: string, whenMs = Date.now()) {
    this.db
      .prepare(
        `UPDATE assets SET last_accessed_at_ms = @t WHERE grade=@g AND key=@k`,
      )
      .run({ t: whenMs, g: grade, k: key });
  }

  get(grade: string, key: string): AssetRow | undefined {
    return this.db
      .prepare(`SELECT * FROM assets WHERE grade=@g AND key=@k`)
      .get({ g: grade, k: key }) as AssetRow | undefined;
  }

  delete(grade: string, key: string): number {
    const stmt = this.db.prepare(
      'DELETE FROM assets WHERE grade = ? AND key = ?',
    );
    const res = stmt.run(grade, key);
    return typeof res.changes === 'number' ? res.changes : 0;
  }

  /**
   * local_file_path をNULLにし、statusをNULLに初期化（grade指定があればその範囲）
   * `deleted` は変更しない（clearCacheはローカルキャッシュだけを消す。設計7.2）
   * 戻り値: 影響行数（目安）
   */
  clearAllLocal(grade?: string): number {
    if (grade) {
      const stmt = this.db.prepare(
        `UPDATE assets
           SET local_file_path = NULL,
               status = NULL
         WHERE grade = ?`,
      );
      const info = stmt.run(grade);
      return Number(info.changes ?? 0);
    } else {
      const stmt = this.db.prepare(
        `UPDATE assets
           SET local_file_path = NULL,
               status = NULL`,
      );
      const info = stmt.run();
      return Number(info.changes ?? 0);
    }
  }
  clearLocalCacheEntry(grade: string, key: string): number {
    const stmt = this.db.prepare(`
    UPDATE assets
       SET local_file_path = NULL,
           status = NULL,
           last_error = NULL
     WHERE grade = @grade
       AND key = @key
  `);

    const info = stmt.run({ grade, key });
    return Number(info.changes ?? 0);
  }
}
