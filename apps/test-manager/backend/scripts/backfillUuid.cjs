/** biome-ignore-all lint/style/useNodejsImportProtocol: backend utility script */

const { randomUUID } = require('node:crypto');
const {
  admin,
  getAdminApp,
  getCollectionDefinition,
  matchesFilter,
  parseFilter,
} = require('./testDataImportShared.cjs');
const { updateCacheIndexEntries } = require('./updateCacheIndexEntries.cjs');

function log(...args) {
  console.log('[backfill-uuid]', ...args);
}

function parseArgs(argv) {
  const out = {
    gradeId: '',
    collectionPath: '',
    projectId:
      process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '',
    dryRun: false,
    where: [],
    docIds: [],
    pageSize: 500,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--grade') {
      out.gradeId = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--collection') {
      out.collectionPath = argv[index + 1] || '';
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

    if (arg === '--doc-id') {
      const value = argv[index + 1] || '';
      if (value) {
        out.docIds.push(value);
      }
      index += 1;
      continue;
    }

    if (arg === '--page-size') {
      const raw = Number(argv[index + 1] || '500');
      if (Number.isFinite(raw) && raw > 0) {
        out.pageSize = Math.floor(raw);
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
  node ./scripts/backfillUuid.cjs --project <id> --grade <firstGrade|secondGrade> [--where <expr>] [--doc-id <id>] [--page-size <number>] [--dry-run]
  node ./scripts/backfillUuid.cjs --project <id> --collection <path> [--where <expr>] [--doc-id <id>] [--page-size <number>] [--dry-run]

Options:
  --project <id>        Firebase project id
  --grade <id>          Target collection alias: firstGrade | secondGrade
  --collection <path>   Target collection path: firstGrade | secondGrade
  --where <expr>        Filter expression. Repeatable. Supported operators: ==, !=, in, not-in
  --doc-id <id>         Target doc id. Repeatable
  --page-size <number>  Scan page size when --doc-id is omitted. Default: 500
  --dry-run             Summarize without writing to Firestore or cacheIndex
  --help, -h            Show this help

Behavior:
  uuid が未設定（フィールドが存在しない）の問題データに UUIDv4 を付与する。
  既に uuid が設定されているドキュメントはスキップする。
  backfill を再実行しても既存の uuid を上書きしない。

Examples:
  node ./scripts/backfillUuid.cjs --project demo-test-manager --grade firstGrade --dry-run
  node ./scripts/backfillUuid.cjs --project demo-test-manager --grade secondGrade
  node ./scripts/backfillUuid.cjs --project demo-test-manager --collection firstGrade --doc-id 100 --doc-id 101`);
}

function uniqueDocIds(docIds) {
  return [...new Set(docIds.map((item) => String(item).trim()).filter(Boolean))];
}

function matchesAllFilters(data, filters) {
  return filters.every((filter) => matchesFilter(data, filter));
}

/**
 * uuid が存在しないドキュメントを対象に pageSize 単位でスキャンする。
 * Firestore の where('uuid', '==', null) は存在しないフィールドを返さないため、
 * クライアント側でフィルタリングする。
 */
async function scanTargetSnapshots({ db, collectionPath, filters, pageSize }) {
  const targets = [];
  let scannedCount = 0;
  let filteredOutCount = 0;
  let skippedHasUuidCount = 0;
  let lastDoc = null;

  while (true) {
    let query = db
  .collection(collectionPath)
  .orderBy(admin.firestore.FieldPath.documentId())
  .limit(pageSize);

    if (lastDoc) {
      query = query.startAfter(lastDoc.id);
    }

    const snap = await query.get();
    if (snap.empty) {
      break;
    }

    for (const docSnap of snap.docs) {
      scannedCount += 1;
      const data = docSnap.data() ?? {};

      if (!matchesAllFilters(data, filters)) {
        filteredOutCount += 1;
        continue;
      }

      // uuid が既に存在する場合はスキップ
      if (typeof data.uuid === 'string' && data.uuid.length > 0) {
        skippedHasUuidCount += 1;
        continue;
      }

      targets.push(docSnap);
    }

    if (snap.size < pageSize) {
      break;
    }

    lastDoc = snap.docs.at(-1) ?? null;
  }

  return { targets, scannedCount, filteredOutCount, skippedHasUuidCount };
}

async function loadTargetSnapshotsByDocId({
  db,
  collectionPath,
  docIds,
  filters,
}) {
  const targets = [];
  let missingDocCount = 0;
  let filteredOutCount = 0;
  let skippedHasUuidCount = 0;

  for (let index = 0; index < docIds.length; index += 200) {
    const chunk = docIds.slice(index, index + 200);
    const snap = await db
      .collection(collectionPath)
      .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
      .get();

    const foundIds = new Set(snap.docs.map((d) => d.id));

    for (const id of chunk) {
      if (!foundIds.has(id)) {
        missingDocCount += 1;
        log(`doc not found: ${id}`);
      }
    }

    for (const docSnap of snap.docs) {
      const data = docSnap.data() ?? {};

      if (!matchesAllFilters(data, filters)) {
        filteredOutCount += 1;
        continue;
      }

      if (typeof data.uuid === 'string' && data.uuid.length > 0) {
        skippedHasUuidCount += 1;
        continue;
      }

      targets.push(docSnap);
    }
  }

  return {
    targets,
    scannedCount: docIds.length,
    filteredOutCount,
    skippedHasUuidCount,
    missingDocCount,
  };
}

async function commitUuidChunk({ db, collectionPath, chunk, startIndex }) {
  const batch = db.batch();

  for (const target of chunk) {
    const ref = db.collection(collectionPath).doc(target.docId);
    batch.set(
      ref,
      {
        uuid: target.uuid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  try {
    await batch.commit();
    log(`write batch committed start=${startIndex} size=${chunk.length}`);
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(
      '[backfill-uuid] batch commit failed',
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

    await commitUuidChunk({ db, collectionPath, chunk: first, startIndex });
    await commitUuidChunk({
      db,
      collectionPath,
      chunk: second,
      startIndex: startIndex + middle,
    });
  }
}

async function writeUuids({ db, collectionPath, changedTargets }) {
  const batchSize = 100;

  for (let index = 0; index < changedTargets.length; index += batchSize) {
    const chunk = changedTargets.slice(index, index + batchSize);
    await commitUuidChunk({ db, collectionPath, chunk, startIndex: index });
  }
}

async function backfillUuids({
  projectId,
  collectionPath,
  filters,
  docIds,
  pageSize,
  dryRun,
}) {
  getCollectionDefinition(collectionPath);

  const app = getAdminApp(projectId);
  const db = admin.firestore(app);
  const normalizedDocIds = uniqueDocIds(docIds);

  const sourceSummary =
    normalizedDocIds.length > 0
      ? await loadTargetSnapshotsByDocId({
          db,
          collectionPath,
          docIds: normalizedDocIds,
          filters,
        })
      : await scanTargetSnapshots({
          db,
          collectionPath,
          filters,
          pageSize,
        });

  const changedTargets = sourceSummary.targets.map((docSnap) => ({
    docId: docSnap.id,
    uuid: randomUUID(),
  }));

  const summary = {
    collectionPath,
    scannedCount: sourceSummary.scannedCount,
    filteredOutCount: sourceSummary.filteredOutCount,
    skippedHasUuidCount: sourceSummary.skippedHasUuidCount,
    missingDocCount: sourceSummary.missingDocCount ?? 0,
    targetCount: sourceSummary.targets.length,
    assignedCount: changedTargets.length,
    dryRun,
  };

  if (dryRun || changedTargets.length === 0) {
    return {
      ...summary,
      cacheIndexUpdated: false,
      cacheIndexUpdatedEntryCount: 0,
      cacheIndexTouchedShardCount: 0,
      cacheIndexSkippedMissingDocCount: 0,
    };
  }

  await writeUuids({ db, collectionPath, changedTargets });

  const cacheIndexSummary = await updateCacheIndexEntries({
    projectId,
    collectionPath,
    docIds: changedTargets.map((item) => item.docId),
    dryRun: false,
  });

  return {
    ...summary,
    cacheIndexUpdated: true,
    cacheIndexUpdatedEntryCount: cacheIndexSummary.updatedEntryCount,
    cacheIndexTouchedShardCount: cacheIndexSummary.touchedShardCount,
    cacheIndexSkippedMissingDocCount: cacheIndexSummary.skippedMissingDocCount,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const collectionPath = args.collectionPath || args.gradeId;
  if (!collectionPath) {
    throw new Error('--collection or --grade is required');
  }

  const filters = args.where.map(parseFilter);
  const useEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

  log(
    `mode=${useEmulator ? 'emulator' : 'production'} project=${args.projectId || '(auto)'} collection=${collectionPath} dryRun=${args.dryRun}`,
  );
  if (filters.length > 0) {
    log(`filters=${args.where.join(' ; ')}`);
  }
  if (args.docIds.length > 0) {
    log(`docIds=${uniqueDocIds(args.docIds).join(', ')}`);
  }

  const summary = await backfillUuids({
    projectId: args.projectId,
    collectionPath,
    filters,
    docIds: args.docIds,
    pageSize: args.pageSize,
    dryRun: args.dryRun,
  });

  console.log(JSON.stringify(summary));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[backfill-uuid] fatal:', error);
    process.exit(1);
  });
}

module.exports = { backfillUuids };
