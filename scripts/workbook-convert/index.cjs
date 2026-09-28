#!/usr/bin/env node
'use strict';
/*
 * CLI. TestManager の TestData を WorkbookApp の形式へ変換する。
 * 使い方と前提は README.md を参照。
 */

const fs = require('node:fs');
const path = require('node:path');

const { convert } = require('./convertTestData.cjs');
const { createEmulatorIo, requestExport } = require('./emulatorIo.cjs');

function parseArgs(argv) {
  const args = {
    sourceProject: process.env.CONVERT_SOURCE_PROJECT || '',
    targetProject: process.env.CONVERT_TARGET_PROJECT || '',
    sourceFirestore: process.env.CONVERT_SOURCE_FIRESTORE_HOST || '',
    sourceStorage: process.env.CONVERT_SOURCE_STORAGE_HOST || '',
    targetDatabase: process.env.CONVERT_TARGET_DATABASE_HOST || '',
    targetStorage: process.env.CONVERT_TARGET_STORAGE_HOST || '',
    grades: '',
    reportOut: '',
    webviewDir: process.env.CONVERT_WEBVIEW_DIR || '',
    exportTo: process.env.CONVERT_EXPORT_TO || '',
    hub: process.env.CONVERT_TARGET_HUB_HOST || '',
    targetFirestore: process.env.CONVERT_TARGET_FIRESTORE_HOST || '',
    targetAuth: process.env.CONVERT_TARGET_AUTH_HOST || '',
    mockAccounts: process.env.CONVERT_MOCK_ACCOUNTS || '',
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--source-project') args.sourceProject = argv[++i] || '';
    else if (token === '--target-project') args.targetProject = argv[++i] || '';
    else if (token === '--source-firestore') args.sourceFirestore = argv[++i] || '';
    else if (token === '--source-storage') args.sourceStorage = argv[++i] || '';
    else if (token === '--target-database') args.targetDatabase = argv[++i] || '';
    else if (token === '--target-storage') args.targetStorage = argv[++i] || '';
    else if (token === '--grades') args.grades = argv[++i] || '';
    else if (token === '--report-out') args.reportOut = argv[++i] || '';
    else if (token === '--webview-dir') args.webviewDir = argv[++i] || '';
    else if (token === '--export-to') args.exportTo = argv[++i] || '';
    else if (token === '--target-hub') args.hub = argv[++i] || '';
    else if (token === '--target-firestore') args.targetFirestore = argv[++i] || '';
    else if (token === '--target-auth') args.targetAuth = argv[++i] || '';
    else if (token === '--mock-accounts') args.mockAccounts = argv[++i] || '';
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`unknown argument: ${token}`);
  }
  return args;
}

function usage() {
  console.log(`
workbook-convert — TestManager の TestData を WorkbookApp の形式へ変換する

  node scripts/workbook-convert/index.cjs --dry-run
  node scripts/workbook-convert/index.cjs

引数（環境変数でも指定できる）:
  --source-project    TestManager の projectId        (CONVERT_SOURCE_PROJECT)
  --target-project    WorkbookApp の projectId        (CONVERT_TARGET_PROJECT)
  --source-firestore  TestManager の Firestore host   (CONVERT_SOURCE_FIRESTORE_HOST)
  --source-storage    TestManager の Storage host     (CONVERT_SOURCE_STORAGE_HOST)
  --target-database   WorkbookApp の RTDB host        (CONVERT_TARGET_DATABASE_HOST)
  --target-storage    WorkbookApp の Storage host     (CONVERT_TARGET_STORAGE_HOST)
  --target-firestore  WorkbookApp の Firestore host   (CONVERT_TARGET_FIRESTORE_HOST)
  --target-auth       WorkbookApp の Auth host        (CONVERT_TARGET_AUTH_HOST)
  --mock-accounts     client の mockAccounts.ts へのパス（模擬アカウントの正本）
                                                      (CONVERT_MOCK_ACCOUNTS)
  --grades            既定 firstGrade,secondGrade
  --webview-dir       questionWebview.html / answerWebview.html のあるディレクトリ
                                                      (CONVERT_WEBVIEW_DIR)
  --export-to         変換後に emulator の内容を書き出す先（例 apps/workbook-app/backend/_data）
                                                      (CONVERT_EXPORT_TO)
  --target-hub        WorkbookApp の Emulator Hub host（--export-to に必要）
                                                      (CONVERT_TARGET_HUB_HOST)
  --report-out        レポートの JSON 出力先
  --dry-run           書き込まず、移行可否とレポートだけを出す

両プロジェクトの emulator を同時に起動しておくこと。host が一つでも欠けると起動を拒否する。
`.trim());
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { usage(); return; }

  const io = createEmulatorIo({
    source: {
      projectId: args.sourceProject,
      firestoreHost: args.sourceFirestore,
      storageHost: args.sourceStorage,
    },
    target: {
      projectId: args.targetProject,
      databaseHost: args.targetDatabase,
      storageHost: args.targetStorage,
      firestoreHost: args.targetFirestore,
      authHost: args.targetAuth,
    },
  });

  const grades = args.grades ? args.grades.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

  // 出題画面の webview。TestManager 側に対応物が無いので外から渡す。
  const webviews = [];
  if (args.webviewDir) {
    for (const name of ['questionWebview', 'answerWebview']) {
      const file = path.resolve(args.webviewDir, `${name}.html`);
      if (!fs.existsSync(file)) throw new Error(`webview が見つかりません: ${file}`);
      webviews.push({ name, html: fs.readFileSync(file, 'utf8') });
    }
  }

  const report = await convert({
    io, bucket: io.targetBucket, grades, dryRun: args.dryRun, webviews,
    mockAccountsPath: args.mockAccounts,
  });

  console.log(`[convert] ${args.dryRun ? 'dry-run' : 'applied'}`);
  console.log(`[convert] 数式 ${report.formulasRendered} 件を描画`);
  console.log(`[convert] webview ${report.webviews.length} 件: ${report.webviews.join(', ') || '(無し)'}`);
  console.log(`[convert] firestore seed: ${report.firestore.join(', ') || '(無し)'}`);
  console.log(`[convert] auth seed: ${report.authAccounts.join(', ') || '(無し)'}`);
  const { converted, bytesIn, bytesOut, missing } = {
    converted: report.images.converted,
    bytesIn: report.images.bytesIn,
    bytesOut: report.images.bytesOut,
    missing: report.images.missing,
  };
  const ratio = bytesIn > 0 ? ((bytesOut / bytesIn) * 100).toFixed(1) : '0.0';
  console.log(`[convert] 画像 ${converted} 枚: ${bytesIn} -> ${bytesOut} bytes (${ratio}%)`);
  if (missing.length > 0) {
    console.log(`[convert] 画像が見つからない: ${missing.length} 件`);
    for (const m of missing.slice(0, 10)) console.log(`   - ${m}`);
  }
  if (report.skipped.length > 0) {
    console.log(`[convert] skip ${report.skipped.length} 件:`);
    for (const s of report.skipped.slice(0, 20)) console.log(`   - ${s}`);
  }
  if (report.errors.length > 0) {
    console.log(`[convert] エラー ${report.errors.length} 件:`);
    for (const e of report.errors.slice(0, 20)) console.log(`   - ${e}`);
  }
  // 変換は起動中の emulator へ書くだけなので、ここで export を依頼しないと
  // ディスク上の _data は作られない。
  if (args.exportTo && !args.dryRun) {
    if (!args.hub) throw new Error('--export-to には --target-hub が必要です');
    const destination = path.resolve(args.exportTo);
    fs.mkdirSync(destination, { recursive: true });
    await requestExport(args.hub, destination);
    const count = fs.existsSync(destination) ? fs.readdirSync(destination).length : 0;
    console.log(`[convert] export: ${args.exportTo}（${count} エントリ）`);
    report.exportedTo = destination;
  }

  if (args.reportOut) {
    fs.mkdirSync(path.dirname(path.resolve(args.reportOut)), { recursive: true });
    fs.writeFileSync(path.resolve(args.reportOut), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`[convert] レポート: ${args.reportOut}`);
  }
  // skip と描画失敗は「データ側の不備」なので、気付けるよう終了コードを分ける。
  if (report.skipped.length > 0 || report.errors.length > 0) process.exitCode = 2;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[convert] ERROR: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { parseArgs };
