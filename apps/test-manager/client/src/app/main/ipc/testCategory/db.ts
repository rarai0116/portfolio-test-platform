import type { TestSubject } from '@shared/types/contracts';
import Database from 'better-sqlite3';

export type GradeId = 'firstGrade' | 'secondGrade';

export type SnapshotRow = {
  path: string;
  grade: GradeId;
  no: number;
  subject: string | null;
  big: string | null;
  small: string | null;
  other_tags_json: string | null;
  auto_check: 0 | 1;
  calibration_check: 0 | 1;
  status: string | null;
  updated_at_ms: number;
};

export class TestCategoryDB {
  private db: Database.Database;

  // prepared statements
  private stmtGetSnapshotByPath: Database.Statement<
    [string],
    SnapshotRow | undefined
  >;
  private stmtUpsertSnapshot: Database.Statement<
    [
      string,
      GradeId,
      number,
      string | null,
      string | null,
      string | null,
      string | null,
      0 | 1,
      0 | 1,
      string | null,
      number,
    ],
    unknown
  >;
  private stmtDeleteSnapshot: Database.Statement<[string], unknown>;

  private stmtInsertNo: Database.Statement<
    [GradeId, string | null, string, string, number],
    unknown
  >;
  private stmtDeleteNo: Database.Statement<
    [GradeId, string | null, string, string, number],
    unknown
  >;
  private stmtInsertOtherTagNo: Database.Statement<
    [GradeId, string, number],
    unknown
  >;
  private stmtDeleteOtherTagNo: Database.Statement<
    [GradeId, string, number],
    unknown
  >;

  private stmtSelectNosGrade: Database.Statement<[GradeId], { no: number }>;
  private stmtSelectNosGradeBig: Database.Statement<
    [GradeId, string],
    { no: number }
  >;
  private stmtSelectNosGradeBigSmall: Database.Statement<
    [GradeId, string, string],
    { no: number }
  >;

  private stmtSelectBigKeys: Database.Statement<
    [GradeId, string],
    { big: string }
  >;
  private stmtSelectSmallKeys: Database.Statement<
    [GradeId, TestSubject, string],
    { small: string }
  >;
  private stmtSelectOtherTagNos: Database.Statement<
    [GradeId, string],
    { no: number }
  >;
  private stmtSelectOtherTagKeys: Database.Statement<
    [GradeId],
    { tag: string }
  >;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');

    const isNewDb = this.isNewDatabase();
    this.initSchema();
    this.runMigrations(isNewDb);

    this.stmtGetSnapshotByPath = this.db.prepare(
      `SELECT path, grade, no, subject, big, small, other_tags_json, auto_check, calibration_check, status, updated_at_ms
       FROM test_category_snapshot
       WHERE path = ?`,
    );

    this.stmtUpsertSnapshot = this.db.prepare(
      `INSERT INTO test_category_snapshot(
          path, grade, no, subject, big, small, other_tags_json, auto_check, calibration_check, status, updated_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(path) DO UPDATE SET
          grade=excluded.grade,
          no=excluded.no,
          subject=excluded.subject,
          big=excluded.big,
          small=excluded.small,
          other_tags_json=excluded.other_tags_json,
          auto_check=excluded.auto_check,
          calibration_check=excluded.calibration_check,
          status=excluded.status,
          updated_at_ms=excluded.updated_at_ms`,
    );

    this.stmtDeleteSnapshot = this.db.prepare(
      `DELETE FROM test_category_snapshot WHERE path = ?`,
    );

    this.stmtInsertNo = this.db.prepare(
      `INSERT OR IGNORE INTO test_category_nos(grade, subject, big, small, no)
       VALUES (?, ?, ?, ?, ?)`,
    );
    this.stmtDeleteNo = this.db.prepare(
      `DELETE FROM test_category_nos
       WHERE grade=? AND subject=? AND big=? AND small=? AND no=?`,
    );
    this.stmtInsertOtherTagNo = this.db.prepare(
      `INSERT OR IGNORE INTO test_other_tag_nos(grade, tag, no)
       VALUES (?, ?, ?)`,
    );
    this.stmtDeleteOtherTagNo = this.db.prepare(
      `DELETE FROM test_other_tag_nos
       WHERE grade=? AND tag=? AND no=?`,
    );

    this.stmtSelectNosGrade = this.db.prepare(
      `SELECT DISTINCT no FROM test_category_nos WHERE grade=? ORDER BY no ASC`,
    );
    this.stmtSelectNosGradeBig = this.db.prepare(
      `SELECT DISTINCT no FROM test_category_nos WHERE grade=? AND big=? ORDER BY no ASC`,
    );
    this.stmtSelectNosGradeBigSmall = this.db.prepare(
      `SELECT DISTINCT no FROM test_category_nos WHERE grade=? AND big=? AND small=? ORDER BY no ASC`,
    );

    this.stmtSelectBigKeys = this.db.prepare(
      `SELECT DISTINCT big FROM test_category_nos WHERE grade=? AND subject=? ORDER BY big ASC`,
    );
    this.stmtSelectSmallKeys = this.db.prepare(
      `SELECT DISTINCT small FROM test_category_nos
       WHERE grade=? AND subject=? AND big=?
       ORDER BY small ASC`,
    );
    this.stmtSelectOtherTagNos = this.db.prepare(
      `SELECT DISTINCT no FROM test_other_tag_nos
       WHERE grade=? AND tag=?
       ORDER BY no ASC`,
    );
    this.stmtSelectOtherTagKeys = this.db.prepare(
      `SELECT DISTINCT tag FROM test_other_tag_nos
       WHERE grade=?
       ORDER BY tag ASC`,
    );
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS test_category_nos (
        grade TEXT NOT NULL,
        subject TEXT,
        big   TEXT NOT NULL,
        small TEXT NOT NULL,
        no    INTEGER NOT NULL,
        PRIMARY KEY (grade, subject, big, small, no)
      );

      CREATE INDEX IF NOT EXISTS idx_test_category_nos_grade
        ON test_category_nos(grade);
      
      CREATE INDEX IF NOT EXISTS idx_test_category_nos_grade_big_small
        ON test_category_nos(grade, big, small);
      CREATE INDEX IF NOT EXISTS idx_test_category_nos_grade_no
        ON test_category_nos(grade, no);

      CREATE TABLE IF NOT EXISTS test_other_tag_nos (
        grade TEXT NOT NULL,
        tag TEXT NOT NULL,
        no INTEGER NOT NULL,
        PRIMARY KEY (grade, tag, no)
      );

      CREATE INDEX IF NOT EXISTS idx_test_other_tag_nos_grade
        ON test_other_tag_nos(grade);

      CREATE INDEX IF NOT EXISTS idx_test_other_tag_nos_grade_tag
        ON test_other_tag_nos(grade, tag);

      CREATE INDEX IF NOT EXISTS idx_test_other_tag_nos_grade_no
        ON test_other_tag_nos(grade, no);

      CREATE TABLE IF NOT EXISTS test_category_snapshot (
        path TEXT PRIMARY KEY,
        grade TEXT NOT NULL,
        no INTEGER NOT NULL,
        subject TEXT,
        big TEXT,
        small TEXT,
        other_tags_json TEXT,
        auto_check INTEGER NOT NULL,
        calibration_check INTEGER NOT NULL,
        status TEXT,
        updated_at_ms INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_test_category_snapshot_grade_no
        ON test_category_snapshot(grade, no);
    `);
  }

  // マイグレーション定義（追加するたびにここに1行足すだけ）
  private static readonly MIGRATIONS: {
    version: number;
    sql: string;
    onlyOnExisting?: boolean;
  }[] = [
    { version: 1, sql: `DROP TABLE IF EXISTS test_category_nos` },
    {
      version: 2,
      sql: `CREATE TABLE IF NOT EXISTS test_category_nos (
      grade TEXT NOT NULL,
      subject TEXT,
      big   TEXT NOT NULL,
      small TEXT NOT NULL,
      no    INTEGER NOT NULL,
      PRIMARY KEY (grade, subject, big, small, no)
    )`,
    },
    {
      version: 3,
      sql: `ALTER TABLE test_category_snapshot ADD COLUMN subject TEXT`,
      onlyOnExisting: true, // ← 追加: 新規DBはinitSchemaで作成済みなのでスキップ
    },
    {
      version: 4,
      sql: `CREATE INDEX IF NOT EXISTS idx_test_category_nos_grade_subject ON test_category_nos(grade, subject)`,
    },
    {
      version: 5,
      sql: `CREATE INDEX IF NOT EXISTS idx_test_category_nos_grade_subject_big ON test_category_nos(grade, subject, big)`,
    },
    // ↓ 追加: 旧PK(subject抜き)のテーブルを正しいPKで作り直す
    {
      version: 6,
      sql: `DROP TABLE IF EXISTS test_category_nos`,
    },
    {
      version: 7,
      sql: `CREATE TABLE IF NOT EXISTS test_category_nos (
      grade TEXT NOT NULL,
      subject TEXT,
      big   TEXT NOT NULL,
      small TEXT NOT NULL,
      no    INTEGER NOT NULL,
      PRIMARY KEY (grade, subject, big, small, no)
    )`,
    },
    {
      version: 8,
      sql: `ALTER TABLE test_category_snapshot ADD COLUMN other_tags_json TEXT`,
      onlyOnExisting: true,
    },
    {
      version: 9,
      sql: `CREATE TABLE IF NOT EXISTS test_other_tag_nos (
      grade TEXT NOT NULL,
      tag TEXT NOT NULL,
      no INTEGER NOT NULL,
      PRIMARY KEY (grade, tag, no)
    )`,
    },
    {
      version: 10,
      sql: `CREATE INDEX IF NOT EXISTS idx_test_other_tag_nos_grade ON test_other_tag_nos(grade)`,
    },
    {
      version: 11,
      sql: `CREATE INDEX IF NOT EXISTS idx_test_other_tag_nos_grade_tag ON test_other_tag_nos(grade, tag)`,
    },
    {
      version: 12,
      sql: `CREATE INDEX IF NOT EXISTS idx_test_other_tag_nos_grade_no ON test_other_tag_nos(grade, no)`,
    },
  ];

  private isNewDatabase(): boolean {
    const row = this.db
      .prepare(
        `SELECT 1 FROM sqlite_master WHERE type='table' AND name='test_category_nos'`,
      )
      .get();
    return !row;
  }

  private runMigrations(isNewDb: boolean) {
    const currentVersion = (
      this.db.pragma('user_version') as { user_version: number }[]
    )[0].user_version;

    const latest = TestCategoryDB.MIGRATIONS.at(-1)?.version ?? 0;

    // onlyOnExisting かつ新規DBならスキップ
    const pending = TestCategoryDB.MIGRATIONS.filter(
      (m) => m.version > currentVersion && !(isNewDb && m.onlyOnExisting),
    );

    if (pending.length === 0) {
      // 新規DBでバージョン未設定なら最新にスタンプ
      if (currentVersion < latest) {
        this.db.pragma(`user_version = ${latest}`);
      }
      return;
    }

    this.db.transaction(() => {
      for (const m of pending) {
        this.db.exec(m.sql);
      }
      this.db.pragma(`user_version = ${latest}`);
    })();
  }

  transaction<T>(fn: () => T): T {
    const tx = this.db.transaction(fn);
    return tx();
  }

  getSnapshotByPath(path: string): SnapshotRow | undefined {
    return this.stmtGetSnapshotByPath.get(path);
  }

  upsertSnapshot(row: SnapshotRow): void {
    this.stmtUpsertSnapshot.run(
      row.path,
      row.grade,
      row.no,
      row.subject,
      row.big,
      row.small,
      row.other_tags_json,
      row.auto_check,
      row.calibration_check,
      row.status,
      row.updated_at_ms,
    );
  }

  deleteSnapshot(path: string): void {
    this.stmtDeleteSnapshot.run(path);
  }

  insertNo(
    grade: GradeId,
    subject: string | null,
    big: string,
    small: string,
    no: number,
  ): void {
    this.stmtInsertNo.run(grade, subject, big, small, no);
  }

  deleteNo(
    grade: GradeId,
    subject: string | null,
    big: string,
    small: string,
    no: number,
  ): void {
    this.stmtDeleteNo.run(grade, subject, big, small, no);
  }

  insertOtherTagNo(grade: GradeId, tag: string, no: number): void {
    this.stmtInsertOtherTagNo.run(grade, tag, no);
  }

  deleteOtherTagNo(grade: GradeId, tag: string, no: number): void {
    this.stmtDeleteOtherTagNo.run(grade, tag, no);
  }

  selectNos(args: { grade: GradeId; big?: string; small?: string }): number[] {
    const { grade, big, small } = args;
    if (small && !big) {
      throw new Error(
        'smallCategoryTag は bigCategoryTag と併せて指定してください',
      );
    }

    if (!big) return this.stmtSelectNosGrade.all(grade).map((r) => r.no);
    if (!small)
      return this.stmtSelectNosGradeBig.all(grade, big).map((r) => r.no);
    return this.stmtSelectNosGradeBigSmall
      .all(grade, big, small)
      .map((r) => r.no);
  }

  selectBigKeys(grade: GradeId, subject?: TestSubject): string[] {
    if (!subject) {
      return [];
    }
    const result = this.stmtSelectBigKeys.all(grade, subject);
    return result.map((r) => r.big);
  }
  selectSmallKeys(grade: GradeId, subject: TestSubject, big: string): string[] {
    return this.stmtSelectSmallKeys
      .all(grade, subject, big)
      .map((r) => r.small);
  }

  selectOtherTagNos(args: { grade: GradeId; tag: string }): number[] {
    return this.stmtSelectOtherTagNos
      .all(args.grade, args.tag)
      .map((r) => r.no);
  }

  selectOtherTagKeys(grade: GradeId): string[] {
    return this.stmtSelectOtherTagKeys.all(grade).map((r) => r.tag);
  }
}
