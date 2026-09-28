/** biome-ignore-all lint/style/useNodejsImportProtocol: backend utility script */

const path = require('node:path');
const {
  admin,
  getAdminApp,
  getGradeNumber,
  parseFilter,
  sanitizeRecord,
  selectRecordsForGrade,
} = require('./testDataImportShared.cjs');
const { updateCacheIndexEntries } = require('./updateCacheIndexEntries.cjs');

function log(...args) {
  console.log('[import-testdata]', ...args);
}

function parseArgs(argv) {
  const out = {
    inputPath: '',
    gradeId: '',
    projectId:
      process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '',
    dryRun: false,
    where: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--input') {
      out.inputPath = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--grade') {
      out.gradeId = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--project') {
      out.projectId = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--where') {
      const value = argv[index + 1] || '';
      if (value) {
        out.where.push(value);
      }
      index += 1;
      continue;
    }

    if (arg === '--dry-run') {
      out.dryRun = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      out.help = true;
    }
  }

  return out;
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/importTestData.cjs --project <id> --grade <firstGrade|secondGrade> --input <path> [--where <expr>] [--dry-run]

Options:
  --project <id>     Firebase project id
  --grade <id>       Target collection: firstGrade | secondGrade
  --input <path>     Path to JSON file containing an array of test data
  --where <expr>     Filter expression. Repeatable. Supported operators: ==, !=, in, not-in
  --dry-run          Validate and summarize without writing to Firestore
  --help, -h         Show this help

Examples:
  node ./scripts/importTestData.cjs --project demo-test-manager --grade firstGrade --input C:/tmp/data.json --where "subject!=学科Ⅰ"
  node ./scripts/importTestData.cjs --project demo-test-manager --grade secondGrade --input C:/tmp/data.json --where "autoCheck==true" --dry-run`);
}

async function loadExistingSnapshots(db, collectionPath, docIds) {
  const byId = new Map();

  for (let index = 0; index < docIds.length; index += 200) {
    const chunk = docIds.slice(index, index + 200);
    const refs = chunk.map((docId) => db.collection(collectionPath).doc(docId));
    const snapshots = await db.getAll(...refs);

    for (const snapshot of snapshots) {
      byId.set(snapshot.id, snapshot);
    }
  }

  return byId;
}

function buildWritePayload(target, existing) {
  return {
    ...target.data,
    createdAt:
      existing && existing.exists
        ? existing.get('createdAt') ||
          admin.firestore.FieldValue.serverTimestamp()
        : admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

async function commitWriteChunk({
  db,
  collectionPath,
  chunk,
  existingById,
  startIndex,
}) {
  const batch = db.batch();

  for (const target of chunk) {
    const ref = db.collection(collectionPath).doc(target.docId);
    const existing = existingById.get(target.docId);
    const payload = buildWritePayload(target, existing);
    batch.set(ref, payload, { merge: false });
  }

  try {
    await batch.commit();
    log(`write batch committed start=${startIndex} size=${chunk.length}`);
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(
      '[import-testdata] batch commit failed',
      JSON.stringify({
        collectionPath,
        startIndex,
        chunkSize: chunk.length,
        docIds: chunk.map((item) => item.docId),
        message,
      }),
    );

    if (chunk.length === 1) {
      throw error;
    }

    const middle = Math.floor(chunk.length / 2);
    const first = chunk.slice(0, middle);
    const second = chunk.slice(middle);

    await commitWriteChunk({
      db,
      collectionPath,
      chunk: first,
      existingById,
      startIndex,
    });

    await commitWriteChunk({
      db,
      collectionPath,
      chunk: second,
      existingById,
      startIndex: startIndex + middle,
    });
  }
}

async function writeDocuments(db, collectionPath, targets, existingById) {
  const batchSize = 25;
  let createCount = 0;
  let replaceCount = 0;

  for (const target of targets) {
    const existing = existingById.get(target.docId);
    if (existing && existing.exists) {
      replaceCount += 1;
    } else {
      createCount += 1;
    }
  }

  for (let index = 0; index < targets.length; index += batchSize) {
    const chunk = targets.slice(index, index + batchSize);

    await commitWriteChunk({
      db,
      collectionPath,
      chunk,
      existingById,
      startIndex: index,
    });
  }

  return { createCount, replaceCount };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.inputPath) throw new Error('--input is required');
  if (!args.gradeId) throw new Error('--grade is required');

  const expectedGrade = getGradeNumber(args.gradeId);
  const collectionPath = args.gradeId;
  const filters = args.where.map(parseFilter);
  const useEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

  log(
    `mode=${useEmulator ? 'emulator' : 'production'} project=${args.projectId || '(auto)'} collection=${collectionPath} dryRun=${args.dryRun}`,
  );
  if (filters.length > 0) {
    log(`filters=${args.where.join(' ; ')}`);
  }

  const absoluteInputPath = path.resolve(args.inputPath);
  const selected = await selectRecordsForGrade({
    inputPath: absoluteInputPath,
    expectedGrade,
    filters,
  });
  const invalidReasons = selected.invalidReasons;
  const filteredRecords = selected.filteredRecords;
  const filteredOutCount = selected.filteredOutCount;

  const deduped = new Map();
  for (const record of filteredRecords) {
    deduped.set(String(record.no), record);
  }

  const targets = Array.from(deduped.entries()).map(([docId, record]) => ({
    docId,
    data: sanitizeRecord(record, expectedGrade),
  }));

  const summary = {
    inputPath: absoluteInputPath,
    collectionPath,
    totalCount: selected.records.length,
    invalidCount: invalidReasons.length,
    filteredOutCount,
    duplicateOverwrittenCount: filteredRecords.length - targets.length,
    targetCount: targets.length,
  };

  log('summary');
  console.log(JSON.stringify(summary));

  if (invalidReasons.length > 0) {
    for (const reason of invalidReasons.slice(0, 20)) {
      console.error(reason);
    }

    throw new Error(`validation failed: ${invalidReasons.length} invalid rows`);
  }

  if (args.dryRun) {
    return;
  }

  const app = getAdminApp(args.projectId);
  const db = admin.firestore(app);
  const existingById = await loadExistingSnapshots(
    db,
    collectionPath,
    targets.map((item) => item.docId),
  );

  const writeSummary = await writeDocuments(
    db,
    collectionPath,
    targets,
    existingById,
  );

  log(
    `write completed create=${writeSummary.createCount} replace=${writeSummary.replaceCount}`,
  );

  const cacheIndexSummary = await updateCacheIndexEntries({
    projectId: args.projectId,
    collectionPath,
    docIds: targets.map((item) => item.docId),
    dryRun: false,
  });

  log(
    `cacheIndex update completed updatedEntries=${cacheIndexSummary.updatedEntryCount} touchedShards=${cacheIndexSummary.touchedShardCount}`,
  );
  console.log(
    JSON.stringify({
      ...summary,
      createCount: writeSummary.createCount,
      replaceCount: writeSummary.replaceCount,
      cacheIndexUpdated: true,
      cacheIndexUpdatedEntryCount: cacheIndexSummary.updatedEntryCount,
      cacheIndexTouchedShardCount: cacheIndexSummary.touchedShardCount,
      cacheIndexSkippedMissingDocCount:
        cacheIndexSummary.skippedMissingDocCount,
    }),
  );
}

main().catch((error) => {
  console.error('[import-testdata] fatal:', error);
  process.exit(1);
});