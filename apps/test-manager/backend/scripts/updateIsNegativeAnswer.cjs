/** biome-ignore-all lint/style/useNodejsImportProtocol: backend utility script */

const fs = require('node:fs');
const path = require('node:path');
const {
  admin,
  getAdminApp,
  getCollectionDefinition,
} = require('./testDataImportShared.cjs');
const { judgeIsNegativeAnswer } = require('./testDataAutoCheckShared.cjs');
const { updateCacheIndexEntries } = require('./updateCacheIndexEntries.cjs');

const FIELD_NAME = 'isNegativeAnswer';
const SCRIPT_TAG = '[update-is-negative-answer]';
const GRADE_ALIASES = ['firstGrade', 'secondGrade'];

function logJson(obj) {
  console.log(JSON.stringify({ ...obj, timestamp: new Date().toISOString() }));
}

function parseArgs(argv) {
  const out = {
    gradeIds: [],
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '',
    dryRun: false,
    noCacheIndex: false,
    help: false,
    pageSize: 500,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--grade') {
      const val = argv[i + 1] || '';
      if (val) out.gradeIds.push(val);
      i += 1;
    } else if (arg === '--project') {
      out.projectId = argv[i + 1] || '';
      i += 1;
    } else if (arg === '--page-size') {
      const raw = Number(argv[i + 1] || '500');
      if (Number.isFinite(raw) && raw > 0) out.pageSize = Math.floor(raw);
      i += 1;
    } else if (arg === '--dry-run') {
      out.dryRun = true;
    } else if (arg === '--no-cache-index') {
      out.noCacheIndex = true;
    } else if (arg === '--help' || arg === '-h') {
      out.help = true;
    }
  }

  // --grade 未指定時は両コレクションを対象
  if (out.gradeIds.length === 0) {
    out.gradeIds = [...GRADE_ALIASES];
  }

  return out;
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/updateIsNegativeAnswer.cjs --dry-run [--grade <firstGrade|secondGrade>]
  node ./scripts/updateIsNegativeAnswer.cjs         [--grade <firstGrade|secondGrade>]

Options:
  --grade <id>     Target collection: firstGrade | secondGrade (default: both)
  --project <id>   Firebase project id (default: GCLOUD_PROJECT env)
  --dry-run          Scan and log diff without writing to Firestore
  --no-cache-index   Skip cacheIndex update after writing
  --page-size <n>    Scan page size per query (default: 500)
  --help, -h         Show this help`);
}

async function scanAllDocs({ db, collectionPath, pageSize }) {
  const docs = [];
  let lastDoc = null;

  for (;;) {
    let query = db
      .collection(collectionPath)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(pageSize);
    if (lastDoc) query = query.startAfter(lastDoc.id);

    const snap = await query.get();
    if (snap.empty) break;
    for (const docSnap of snap.docs) docs.push(docSnap);
    if (snap.size < pageSize) break;
    lastDoc = snap.docs.at(-1) ?? null;
  }

  return docs;
}

function buildPlan(docs) {
  const targets = [];
  let unchangedCount = 0;

  for (const docSnap of docs) {
    const data = docSnap.data() ?? {};
    const current = Object.prototype.hasOwnProperty.call(data, FIELD_NAME) ? data[FIELD_NAME] : null;
    const next = judgeIsNegativeAnswer(data);

    if (current === next) {
      unchangedCount += 1;
      continue;
    }

    targets.push({ id: docSnap.id, from: current, to: next });
  }

  return { targets, unchangedCount };
}

async function applyPlan({ db, collectionPath, targets }) {
  const BATCH_SIZE = 200;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const chunk = targets.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const t of chunk) {
      batch.set(
        db.collection(collectionPath).doc(t.id),
        { [FIELD_NAME]: t.to, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
      );
    }
    await batch.commit();
    console.error(`${SCRIPT_TAG} batch committed start=${i} size=${chunk.length}`);
  }
}

async function runForCollection({ db, collectionPath, pageSize, dryRun, projectId, noCacheIndex }) {
  const docs = await scanAllDocs({ db, collectionPath, pageSize });
  const plan = buildPlan(docs);

  logJson({
    level: 'info',
    phase: 'scan',
    collection: collectionPath,
    total: docs.length,
    toUpdate: plan.targets.length,
    dryRun,
  });

  for (const t of plan.targets) {
    logJson({ level: 'info', phase: 'target', id: t.id, field: FIELD_NAME, from: t.from, to: t.to, dryRun });
  }

  if (!dryRun && plan.targets.length > 0) {
    await applyPlan({ db, collectionPath, targets: plan.targets });
  }

  /** @type {{ updatedEntryCount: number; touchedShardCount: number; skippedMissingDocCount: number } | null} */
  let cacheIndexResult = null;
  if (!dryRun && plan.targets.length > 0 && !noCacheIndex) {
    cacheIndexResult = await updateCacheIndexEntries({
      projectId,
      collectionPath,
      docIds: plan.targets.map((t) => t.id),
      dryRun: false,
    });
    logJson({
      level: 'info',
      phase: 'cacheIndex',
      collection: collectionPath,
      updatedEntryCount: cacheIndexResult.updatedEntryCount,
      touchedShardCount: cacheIndexResult.touchedShardCount,
      skippedMissingDocCount: cacheIndexResult.skippedMissingDocCount,
      dryRun,
    });
  }

  const summary = {
    collection: collectionPath,
    field: FIELD_NAME,
    total: docs.length,
    toUpdate: plan.targets.length,
    updated: dryRun ? 0 : plan.targets.length,
    skipped: plan.unchangedCount,
    dryRun,
    noCacheIndex,
    cacheIndex: cacheIndexResult,
    targets: plan.targets,
    timestamp: new Date().toISOString(),
  };

  logJson({ level: 'info', phase: 'done', ...summary });

  // _tmp/ に結果 JSON を保存
  const tmpDir = path.resolve(process.cwd(), '_tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = path.join(tmpDir, `update-is-negative-answer-${collectionPath}-${ts}.json`);
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf-8');
  console.error(`${SCRIPT_TAG} result saved to ${outPath}`);

  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const useEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  console.error(
    `${SCRIPT_TAG} mode=${useEmulator ? 'emulator' : 'production'} dryRun=${args.dryRun} grades=${args.gradeIds.join(',')}`,
  );

  const app = getAdminApp(args.projectId);
  const db = admin.firestore(app);

  for (const gradeId of args.gradeIds) {
    getCollectionDefinition(gradeId);
    await runForCollection({
      db,
      collectionPath: gradeId,
      pageSize: args.pageSize,
      dryRun: args.dryRun,
      projectId: args.projectId,
      noCacheIndex: args.noCacheIndex,
    });
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`${SCRIPT_TAG} fatal:`, error);
    process.exit(1);
  });
}

module.exports = { runForCollection };
