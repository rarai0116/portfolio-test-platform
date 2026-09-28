/** biome-ignore-all lint/style/useNodejsImportProtocol: backend utility script */

/**
 * createEmptyTestData.cjs
 *
 * test-manager の `firstGrade` / `secondGrade` に、編集可能な最小の
 * 空オリジナル問題 doc を作成する seed スクリプト。
 *
 * - docId と `no` を一致させ、連番で作成する。
 * - 初期値は client 側の `useOriginalTestDataCreate`（buildEmptyOriginalTestData）
 *   に寄せる。`status` は `autoCheck:false` の状態導出結果である `エラー`。
 * - 書き込み後に、作成した docId だけ `cacheIndex` を部分更新する。
 * - 本タスクでは emulator のみを対象にする。本番接続時は `--allow-prod` を必須にする。
 */

const fs = require('node:fs');
const path = require('node:path');

const {
  admin,
  getAdminApp,
  getGradeNumber,
} = require('./testDataImportShared.cjs');
const { updateCacheIndexEntries } = require('./updateCacheIndexEntries.cjs');

const SUPPORTED_SUBJECTS = ['学科Ⅰ', '学科Ⅱ', '学科Ⅲ', '学科Ⅳ', '学科Ⅴ'];

function log(...args) {
  console.log('[create-empty-testdata]', ...args);
}

/**
 * autoCheck 未通過の空問題の状態。
 * client 側 deriveActiveTestDataStatus({autoCheckOk:false, ...}) と同じく `エラー`。
 */
function deriveEmptyStatus() {
  return 'エラー';
}

/**
 * buildEmptyOriginalTestData 相当の最小初期値を作る（純粋関数・テスト対象）。
 * createdAt / updatedAt は書き込み時に serverTimestamp を付与するためここには含めない。
 */
function buildEmptyTestDataPayload({
  no,
  gradeNumber,
  subject,
  bigCategoryTag,
  smallCategoryTag,
  themeTag,
  uuid,
}) {
  const payload = {
    no,
    grade: gradeNumber,
    isOriginal: true,
    calibrationCheck: false,
    status: deriveEmptyStatus(),
    active: true,

    answerNumber: '',
    answerText: '',
    answerText1: '',
    answerText2: '',
    answerText3: '',
    answerText4: '',
    answerText5: '',
    bigCategoryTag: bigCategoryTag ?? '',
    ch1: '',
    ch2: '',
    ch3: '',
    ch4: '',
    ch5: '',
    difficult: '',
    isConvertibleQaa: false,
    isNegativeAnswer: false,
    nengo: '',
    parentNo: 0,
    smallCategoryTag: smallCategoryTag ?? '',
    subject: subject ?? '学科Ⅰ',
    testNo: '',
    text: '',
    themeTag: themeTag ?? '',
    year: '',
    autoCheck: false,
    answerEditorType: 'normal',
    questionEditorType: 'normal',
    deleted: false,
  };

  if (uuid) {
    payload.uuid = uuid;
  }

  return payload;
}

/**
 * 連番の作成計画を組み立てる（純粋関数・テスト対象）。
 */
function buildCreatePlan({
  gradeId,
  gradeNumber,
  startNo,
  count,
  subject,
  bigCategoryTag,
  smallCategoryTag,
  themeTag,
  withUuid,
}) {
  const plan = [];
  for (let index = 0; index < count; index += 1) {
    const no = startNo + index;
    const docId = String(no);
    plan.push({
      no,
      docId,
      path: `${gradeId}/${docId}`,
      data: buildEmptyTestDataPayload({
        no,
        gradeNumber,
        subject,
        bigCategoryTag,
        smallCategoryTag,
        themeTag,
        uuid: withUuid ? randomUuid() : undefined,
      }),
    });
  }
  return plan;
}

function randomUuid() {
  return require('node:crypto').randomUUID();
}

function parseIntOption(raw, name) {
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer: ${raw}`);
  }
  return value;
}

function parseArgs(argv) {
  const out = {
    gradeId: '',
    projectId:
      process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '',
    count: 1,
    startNo: null,
    subject: '学科Ⅰ',
    bigCategoryTag: '',
    smallCategoryTag: '',
    themeTag: '',
    withUuid: false,
    dryRun: false,
    yes: false,
    allowProd: false,
    logDir: '',
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1] || '';
      index += 1;
      return value;
    };

    switch (arg) {
      case '--grade':
        out.gradeId = next();
        break;
      case '--project':
        out.projectId = next();
        break;
      case '--count':
        out.count = parseIntOption(next(), '--count');
        break;
      case '--start-no':
        out.startNo = parseIntOption(next(), '--start-no');
        break;
      case '--no':
        out.startNo = parseIntOption(next(), '--no');
        break;
      case '--subject':
        out.subject = next();
        break;
      case '--big-category':
        out.bigCategoryTag = next();
        break;
      case '--small-category':
        out.smallCategoryTag = next();
        break;
      case '--theme':
        out.themeTag = next();
        break;
      case '--uuid':
        out.withUuid = true;
        break;
      case '--dry-run':
        out.dryRun = true;
        break;
      case '--yes':
        out.yes = true;
        break;
      case '--allow-prod':
        out.allowProd = true;
        break;
      case '--log-dir':
        out.logDir = next();
        break;
      case '--help':
      case '-h':
        out.help = true;
        break;
      default:
        break;
    }
  }

  return out;
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/createEmptyTestData.cjs --project <id> --grade <firstGrade|secondGrade> [options]

Options:
  --project <id>          Firebase project id (emulator でも推奨)
  --grade <id>            Target collection: firstGrade | secondGrade
  --count <n>             作成件数。既定 1
  --start-no <n> | --no <n>
                          先頭の no（= docId）。未指定なら既存最大 no + 1
  --subject <学科Ⅰ..学科Ⅴ> 既定 学科Ⅰ
  --big-category <s>      bigCategoryTag 初期値
  --small-category <s>    smallCategoryTag 初期値
  --theme <s>             themeTag 初期値
  --uuid                  uuid(UUIDv4) を付与する（既定は付与しない）
  --dry-run               書き込まず、作成計画と衝突チェック結果のみ出力
  --yes                   実書き込みの確認を省略
  --allow-prod            emulator 未接続（本番）での実行を許可（既定は拒否）
  --log-dir <path>        ログ出力先。既定 ./_tmp/createEmptyTestData
  --help, -h              Show this help

Examples:
  # dry-run（firstGrade に 1 問、no は自動採番）
  node ./scripts/createEmptyTestData.cjs --project demo-test-manager --grade firstGrade --dry-run
  # 実作成（secondGrade に no=1 を 1 問）
  node ./scripts/createEmptyTestData.cjs --project demo-test-manager --grade secondGrade --no 1 --yes`);
}

async function resolveMaxNo(db, collectionPath) {
  const snap = await db
    .collection(collectionPath)
    .orderBy('no', 'desc')
    .limit(1)
    .get();
  if (snap.empty) return 0;
  const top = snap.docs[0].get('no');
  return typeof top === 'number' ? top : 0;
}

async function findCollisions(db, collectionPath, docIds) {
  const collisions = [];
  for (let index = 0; index < docIds.length; index += 200) {
    const chunk = docIds.slice(index, index + 200);
    const refs = chunk.map((docId) => db.collection(collectionPath).doc(docId));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (snap.exists) collisions.push(snap.id);
    }
  }
  return collisions;
}

async function writePlan(db, collectionPath, plan) {
  const batchSize = 25;
  for (let index = 0; index < plan.length; index += batchSize) {
    const chunk = plan.slice(index, index + batchSize);
    const batch = db.batch();
    for (const item of chunk) {
      const ref = db.collection(collectionPath).doc(item.docId);
      batch.set(
        ref,
        {
          ...item.data,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: false },
      );
    }
    await batch.commit();
    log(`write batch committed start=${index} size=${chunk.length}`);
  }
}

function writeLog(logDir, fileName, payload) {
  const dir = path.resolve(logDir);
  fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, fileName);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  return outPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.gradeId) throw new Error('--grade is required');
  const gradeNumber = getGradeNumber(args.gradeId);
  const collectionPath = args.gradeId;

  if (args.subject && !SUPPORTED_SUBJECTS.includes(args.subject)) {
    throw new Error(
      `--subject must be one of ${SUPPORTED_SUBJECTS.join(' / ')}: ${args.subject}`,
    );
  }
  if (args.count < 1) throw new Error('--count must be >= 1');
  if (args.startNo !== null && args.startNo < 0) {
    throw new Error('--start-no / --no must be >= 0');
  }

  const useEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  if (!useEmulator && !args.allowProd) {
    throw new Error(
      '本番 Firestore への接続が検出されました。emulator では FIRESTORE_EMULATOR_HOST を設定してください。本番実行が必要な場合のみ --allow-prod を付けてください。',
    );
  }

  const logDir = args.logDir || './_tmp/createEmptyTestData';
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);

  log(
    `mode=${useEmulator ? 'emulator' : 'production'} project=${args.projectId || '(auto)'} collection=${collectionPath} dryRun=${args.dryRun}`,
  );

  const app = getAdminApp(args.projectId);
  const db = admin.firestore(app);

  const startNo =
    args.startNo !== null
      ? args.startNo
      : (await resolveMaxNo(db, collectionPath)) + 1;

  const plan = buildCreatePlan({
    gradeId: args.gradeId,
    gradeNumber,
    startNo,
    count: args.count,
    subject: args.subject,
    bigCategoryTag: args.bigCategoryTag,
    smallCategoryTag: args.smallCategoryTag,
    themeTag: args.themeTag,
    withUuid: args.withUuid,
  });

  const docIds = plan.map((item) => item.docId);
  const collisions = await findCollisions(db, collectionPath, docIds);

  const summary = {
    mode: useEmulator ? 'emulator' : 'production',
    collectionPath,
    gradeNumber,
    startNo,
    count: args.count,
    docIds,
    subject: args.subject,
    withUuid: args.withUuid,
    collisions,
    dryRun: args.dryRun,
  };

  log('summary');
  console.log(JSON.stringify(summary));

  if (collisions.length > 0) {
    const logPath = writeLog(
      logDir,
      `create-empty-${collectionPath}-${timestamp}-collision.json`,
      { summary, plan },
    );
    throw new Error(
      `docId 衝突が ${collisions.length} 件あります（${collisions.join(', ')}）。--start-no をずらしてください。log=${logPath}`,
    );
  }

  if (args.dryRun) {
    const logPath = writeLog(
      logDir,
      `create-empty-${collectionPath}-${timestamp}-dry-run.json`,
      { summary, plan },
    );
    log(`dry-run log written: ${logPath}`);
    return;
  }

  if (!args.yes) {
    throw new Error(
      '実書き込みには --yes が必要です。まず --dry-run で計画を確認してください。',
    );
  }

  await writePlan(db, collectionPath, plan);
  log(`write completed count=${plan.length}`);

  const cacheIndexSummary = await updateCacheIndexEntries({
    projectId: args.projectId,
    collectionPath,
    docIds,
    dryRun: false,
  });

  log(
    `cacheIndex update completed updatedEntries=${cacheIndexSummary.updatedEntryCount} touchedShards=${cacheIndexSummary.touchedShardCount}`,
  );

  const result = {
    ...summary,
    createdCount: plan.length,
    cacheIndexUpdated: true,
    cacheIndexUpdatedEntryCount: cacheIndexSummary.updatedEntryCount,
    cacheIndexTouchedShardCount: cacheIndexSummary.touchedShardCount,
    cacheIndexSkippedMissingDocCount: cacheIndexSummary.skippedMissingDocCount,
  };
  const logPath = writeLog(
    logDir,
    `create-empty-${collectionPath}-${timestamp}-result.json`,
    { result, plan },
  );
  log(`result log written: ${logPath}`);
  console.log(JSON.stringify(result));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[create-empty-testdata] fatal:', error);
    process.exit(1);
  });
}

module.exports = {
  buildEmptyTestDataPayload,
  buildCreatePlan,
  deriveEmptyStatus,
  parseArgs,
};
