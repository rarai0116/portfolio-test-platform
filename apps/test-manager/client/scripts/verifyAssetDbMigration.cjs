// AssetDB の deleted 列 migration（設計6.1〜6.3 / 13.4）を実SQLiteで検証する。手動実行専用。
// ビルド・CI には含めない。
//
// なぜ Electron で実行するのか:
//   better-sqlite3 は postinstall（electron-builder install-app-deps）で Electron の ABI 向けに
//   ビルドされるため、plain Node で動く vitest からは実DBを開けない。
//   そのため migration の実挙動確認はこのスクリプトで行い、vitest 側では扱わない。
//
// 実装は src/app/main/ipc/assetStorage/db.ts を TypeScript API で transpile して読み込む。
// db.ts は内部importを持たないため、単体で commonjs へ変換できる。
const { app } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ts = require('typescript');

const CLIENT_ROOT = path.join(__dirname, '..');
const DB_SOURCE = path.join(
  CLIENT_ROOT,
  'src/app/main/ipc/assetStorage/db.ts',
);

const LEGACY_CREATE_TABLE = `
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
    PRIMARY KEY (grade, key)
  );
`;

function loadAssetDbClass() {
  const source = fs.readFileSync(DB_SOURCE, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  // better-sqlite3 を解決できるよう、生成物は apps/client 配下（Git除外の _tmp）へ置く。
  const generatedDir = path.join(CLIENT_ROOT, '_tmp', 'asset-db-migration');
  fs.mkdirSync(generatedDir, { recursive: true });
  const modulePath = path.join(generatedDir, 'db.generated.cjs');
  fs.writeFileSync(modulePath, transpiled);
  return { AssetDB: require(modulePath).AssetDB, modulePath };
}

const checks = [];
const check = (name, ok, detail) => {
  checks.push({ name, ok, detail });
};

function verifyNewDatabase(AssetDB, workDir) {
  const dbPath = path.join(workDir, 'new.db');
  const db = new AssetDB(dbPath);

  db.upsertMeta({
    grade: 'firstGrade',
    key: 'a1',
    object_path: 'original/firstGrade/a1.png',
    md5_hash: 'md5AAA',
    content_type: 'image/png',
    size: 100,
    updated_at_ms: 1000,
    status: 'ready',
    deleted: 0,
  });
  db.setLocalPath('firstGrade', 'a1', '/tmp/assets/firstGrade/a1.png');

  check(
    '新規DB: activeメタは deleted=0 で保存される',
    db.get('firstGrade', 'a1').deleted === 0,
    `deleted=${db.get('firstGrade', 'a1').deleted}`,
  );

  // deleted を省略した upsert は既存値を維持する
  db.upsertMeta({ grade: 'firstGrade', key: 'a1', size: 200 });
  check(
    '新規DB: deleted 未指定の upsert は既存値を維持する',
    db.get('firstGrade', 'a1').deleted === 0 &&
      db.get('firstGrade', 'a1').size === 200,
    JSON.stringify(db.get('firstGrade', 'a1')),
  );

  // markDeleted: メタは保持、local fields だけ NULL
  db.markDeleted('firstGrade', 'a1', 2000);
  const deletedRow = db.get('firstGrade', 'a1');
  check(
    '新規DB: markDeleted はメタを保持して local fields だけ NULL にする',
    deletedRow.deleted === 1 &&
      deletedRow.object_path === 'original/firstGrade/a1.png' &&
      deletedRow.md5_hash === 'md5AAA' &&
      deletedRow.local_file_path === null &&
      deletedRow.status === null &&
      deletedRow.updated_at_ms === 2000,
    JSON.stringify(deletedRow),
  );

  // 行が無い場合も削除済み行を作る
  db.markDeleted('secondGrade', 'nokey');
  const createdRow = db.get('secondGrade', 'nokey');
  check(
    '新規DB: 行が無い markDeleted でも deleted=1 の行を作る',
    !!createdRow && createdRow.deleted === 1,
    JSON.stringify(createdRow),
  );

  // markActive で 0 へ戻す
  db.markActive('firstGrade', 'a1', 3000);
  check(
    '新規DB: markActive は deleted=0 へ戻す',
    db.get('firstGrade', 'a1').deleted === 0 &&
      db.get('firstGrade', 'a1').updated_at_ms === 3000,
    JSON.stringify(db.get('firstGrade', 'a1')),
  );

  // clearAllLocal / clearLocalCacheEntry は deleted を変えない
  db.setLocalPath('firstGrade', 'a1', '/tmp/assets/firstGrade/a1.png');
  db.markDeleted('secondGrade', 'keep');
  db.clearAllLocal();
  check(
    'clearAllLocal は deleted を変更しない',
    db.get('secondGrade', 'keep').deleted === 1 &&
      db.get('firstGrade', 'a1').deleted === 0 &&
      db.get('firstGrade', 'a1').local_file_path === null,
    JSON.stringify([db.get('secondGrade', 'keep'), db.get('firstGrade', 'a1')]),
  );

  db.upsertMeta({ grade: 'firstGrade', key: 'a2', deleted: 0 });
  db.setLocalPath('firstGrade', 'a2', '/tmp/assets/firstGrade/a2.png');
  db.clearLocalCacheEntry('firstGrade', 'a2');
  check(
    'clearLocalCacheEntry は deleted を変更しない',
    db.get('firstGrade', 'a2').deleted === 0 &&
      db.get('firstGrade', 'a2').local_file_path === null,
    JSON.stringify(db.get('firstGrade', 'a2')),
  );

  db.close();
}

function verifyMigration(AssetDB, workDir) {
  const Database = require('better-sqlite3');
  const dbPath = path.join(workDir, 'legacy.db');

  // 旧schema（deleted列なし）のDBを作り、既存行を入れる
  const legacy = new Database(dbPath);
  legacy.pragma('journal_mode = WAL');
  legacy.prepare(LEGACY_CREATE_TABLE).run();
  legacy
    .prepare(
      `INSERT INTO assets (grade, key, object_path, md5_hash, content_type, size, local_file_path, updated_at_ms, status)
       VALUES ('firstGrade','old1','original/firstGrade/old1.png','md5OLD','image/png',321,'/tmp/assets/firstGrade/old1.png',900,'ready')`,
    )
    .run();
  legacy.close();

  const db = new AssetDB(dbPath);
  const migrated = db.get('firstGrade', 'old1');

  check(
    'migration: 既存行のメタとローカルパスを保持する',
    migrated.object_path === 'original/firstGrade/old1.png' &&
      migrated.md5_hash === 'md5OLD' &&
      migrated.size === 321 &&
      migrated.local_file_path === '/tmp/assets/firstGrade/old1.png' &&
      migrated.status === 'ready' &&
      migrated.updated_at_ms === 900,
    JSON.stringify(migrated),
  );

  check(
    'migration: 既存行の deleted は未確認(NULL)になる',
    migrated.deleted === null,
    `deleted=${JSON.stringify(migrated.deleted)}`,
  );

  db.close();

  // 再実行しても安全
  const reopened = new AssetDB(dbPath);
  const again = reopened.get('firstGrade', 'old1');
  check(
    'migration: 再実行しても既存行を壊さない',
    again.deleted === null &&
      again.local_file_path === '/tmp/assets/firstGrade/old1.png',
    JSON.stringify(again),
  );

  // NULL行の確認結果を確定できる
  reopened.markActive('firstGrade', 'old1', 1500);
  check(
    'migration: NULL行を markActive で 0 へ確定できる',
    reopened.get('firstGrade', 'old1').deleted === 0,
    JSON.stringify(reopened.get('firstGrade', 'old1')),
  );
  reopened.close();
}

function verifyMigrationFailure(AssetDB, workDir) {
  const Database = require('better-sqlite3');
  const dbPath = path.join(workDir, 'broken.db');

  // assets という名前のviewを作り、ALTER TABLE を失敗させる
  const broken = new Database(dbPath);
  broken.prepare('CREATE TABLE base (grade TEXT, key TEXT)').run();
  broken.prepare('CREATE VIEW assets AS SELECT grade, key FROM base').run();
  broken.close();

  let threw = false;
  try {
    const db = new AssetDB(dbPath);
    db.close();
  } catch {
    threw = true;
  }

  check(
    'migration失敗時は例外を投げて起動させない（DBはcloseされる）',
    threw,
    `threw=${threw}`,
  );
}

app.on('window-all-closed', () => {});

app
  .whenReady()
  .then(() => {
    const workDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'demo-asset-db-migration-'),
    );
    const { AssetDB, modulePath } = loadAssetDbClass();

    verifyNewDatabase(AssetDB, workDir);
    verifyMigration(AssetDB, workDir);
    verifyMigrationFailure(AssetDB, workDir);

    fs.rmSync(modulePath, { force: true });

    const lines = [];
    let hasFailure = false;
    for (const item of checks) {
      if (!item.ok) hasFailure = true;
      lines.push(`  [${item.ok ? 'PASS' : 'FAIL'}] ${item.name}`);
      if (!item.ok) {
        lines.push(`      detail: ${item.detail}`);
      }
    }
    lines.push(hasFailure ? '\n結果: FAIL' : '\n結果: PASS');
    const summary = lines.join('\n');
    console.log(summary);

    const summaryPath = path.join(workDir, 'summary.txt');
    fs.writeFileSync(summaryPath, `${summary}\n`);
    console.log(`\nsummary: ${summaryPath}`);

    setTimeout(() => app.exit(hasFailure ? 1 : 0), 50);
  })
  .catch((e) => {
    console.error(e);
    app.exit(1);
  });
