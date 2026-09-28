/** biome-ignore-all lint/style/useNodejsImportProtocol: backend utility script */

const {
  admin,
  getAdminApp,
  getCollectionDefinition,
  matchesFilter,
  parseFilter,
} = require('./testDataImportShared.cjs');
const { runAutoCheckForScript } = require('./testDataAutoCheckShared.cjs');
const { updateCacheIndexEntries } = require('./updateCacheIndexEntries.cjs');

function log(...args) {
  console.log('[normalize-testdata-status]', ...args);
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
  node ./scripts/normalizeTestDataStatus.cjs --project <id> --grade <firstGrade|secondGrade> [--where <expr>] [--doc-id <id>] [--page-size <number>] [--dry-run]
  node ./scripts/normalizeTestDataStatus.cjs --project <id> --collection <path> [--where <expr>] [--doc-id <id>] [--page-size <number>] [--dry-run]

Options:
  --project <id>        Firebase project id
  --grade <id>          Target collection alias: firstGrade | secondGrade
  --collection <path>   Target collection path: firstGrade | secondGrade
  --where <expr>        Filter expression. Repeatable. Supported operators: ==, !=, in, not-in
  --doc-id <id>         Target doc id. Repeatable
  --page-size <number>  Scan page size when --doc-id is omitted. Default: 500
  --dry-run             Summarize without writing to Firestore or cacheIndex
  --help, -h            Show this help

Status rules:
  停止中は維持
  autoCheck を再計算し success 以外は false
  autoCheck === false は エラー
  autoCheck === true && calibrationCheck === true は 準備完了
  それ以外は 準備中

Examples:
  node ./scripts/normalizeTestDataStatus.cjs --project demo-test-manager --grade firstGrade --dry-run
  node ./scripts/normalizeTestDataStatus.cjs --project demo-test-manager --grade secondGrade --where "subject!=学科Ⅰ"
  node ./scripts/normalizeTestDataStatus.cjs --project demo-test-manager --collection firstGrade --doc-id 100 --doc-id 101`);
}

function uniqueDocIds(docIds) {
  return [...new Set(docIds.map((item) => String(item).trim()).filter(Boolean))];
}

function deriveNormalizedStatus(args) {
  if (args.currentStatus === '停止中') return '停止中';
  if (args.autoCheckOk !== true) return 'エラー';
  return args.calibrationCheck === true ? '準備完了' : '準備中';
}

function buildNormalizationPatch(data) {
  const autoCheckResult = runAutoCheckForScript(data);
  const nextAutoCheck = autoCheckResult.autoCheckOk;
  const nextStatus = deriveNormalizedStatus({
    currentStatus: data.status,
    autoCheckOk: nextAutoCheck,
    calibrationCheck: data.calibrationCheck === true,
  });

  const currentAutoCheck = data.autoCheck === true;
  if (currentAutoCheck === nextAutoCheck && data.status === nextStatus) {
    return null;
  }

  return {
    autoCheckResult,
    fromAutoCheck: currentAutoCheck,
    toAutoCheck: nextAutoCheck,
    fromStatus: data.status,
    toStatus: nextStatus,
  };
}

function matchesAllFilters(data, filters) {
  return filters.every((filter) => matchesFilter(data, filter));
}

async function loadTargetSnapshotsByDocId({ db, collectionPath, docIds, filters }) {
  const targets = [];
  let missingDocCount = 0;
  let filteredOutCount = 0;

  for (let index = 0; index < docIds.length; index += 200) {
    const chunk = docIds.slice(index, index + 200);
    const refs = chunk.map((docId) => db.collection(collectionPath).doc(docId));
    const snapshots = await db.getAll(...refs);

    for (const snapshot of snapshots) {
      if (!snapshot.exists) {
        missingDocCount += 1;
        continue;
      }

      const data = snapshot.data() ?? {};
      if (!matchesAllFilters(data, filters)) {
        filteredOutCount += 1;
        continue;
      }

      targets.push(snapshot);
    }
  }

  return {
    targets,
    scannedCount: docIds.length,
    filteredOutCount,
    missingDocCount,
  };
}

async function scanTargetSnapshots({ db, collectionPath, filters, pageSize }) {
  const targets = [];
  let scannedCount = 0;
  let filteredOutCount = 0;
  let lastDoc = null;

  for (;;) {
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

      targets.push(docSnap);
    }

    if (snap.size < pageSize) {
      break;
    }

    lastDoc = snap.docs.at(-1) ?? null;
  }

  return {
    targets,
    scannedCount,
    filteredOutCount,
    missingDocCount: 0,
  };
}

function buildNormalizationPlan(targets) {
  const changedTargets = [];
  let unchangedCount = 0;
  let autoCheckChangedCount = 0;
  let statusChangedCount = 0;
  let successCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  for (const snapshot of targets) {
    const data = snapshot.data() ?? {};
    const patch = buildNormalizationPatch(data);

    if (patch?.autoCheckResult.status === 'success') {
      successCount += 1;
    } else if (patch?.autoCheckResult.status === 'warning') {
      warningCount += 1;
    } else if (patch?.autoCheckResult.status === 'error') {
      errorCount += 1;
    }

    if (!patch) {
      const autoCheckResult = runAutoCheckForScript(data);
      if (autoCheckResult.status === 'success') {
        successCount += 1;
      } else if (autoCheckResult.status === 'warning') {
        warningCount += 1;
      } else {
        errorCount += 1;
      }
    }

    if (!patch) {
      unchangedCount += 1;
      continue;
    }

    if (patch.fromAutoCheck !== patch.toAutoCheck) {
      autoCheckChangedCount += 1;
    }
    if (patch.fromStatus !== patch.toStatus) {
      statusChangedCount += 1;
    }

    changedTargets.push({
      docId: snapshot.id,
      fromAutoCheck: patch.fromAutoCheck,
      toAutoCheck: patch.toAutoCheck,
      fromStatus: patch.fromStatus,
      toStatus: patch.toStatus,
    });
  }

  return {
    changedTargets,
    unchangedCount,
    autoCheckChangedCount,
    statusChangedCount,
    successCount,
    warningCount,
    errorCount,
  };
}

async function commitNormalizeChunk({ db, collectionPath, chunk, startIndex }) {
  const batch = db.batch();

  for (const target of chunk) {
    const ref = db.collection(collectionPath).doc(target.docId);
    batch.set(
      ref,
      {
        autoCheck: target.toAutoCheck,
        status: target.toStatus,
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
      '[normalize-testdata-status] batch commit failed',
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

    await commitNormalizeChunk({
      db,
      collectionPath,
      chunk: first,
      startIndex,
    });

    await commitNormalizeChunk({
      db,
      collectionPath,
      chunk: second,
      startIndex: startIndex + middle,
    });
  }
}

async function writeNormalizedStatuses({ db, collectionPath, changedTargets }) {
  const batchSize = 100;

  for (let index = 0; index < changedTargets.length; index += batchSize) {
    const chunk = changedTargets.slice(index, index + batchSize);
    await commitNormalizeChunk({
      db,
      collectionPath,
      chunk,
      startIndex: index,
    });
  }
}

async function normalizeStatuses({
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

  const plan = buildNormalizationPlan(sourceSummary.targets);
  const summary = {
    collectionPath,
    scannedCount: sourceSummary.scannedCount,
    filteredOutCount: sourceSummary.filteredOutCount,
    missingDocCount: sourceSummary.missingDocCount,
    targetCount: sourceSummary.targets.length,
    unchangedCount: plan.unchangedCount,
    normalizedCount: plan.changedTargets.length,
    autoCheckChangedCount: plan.autoCheckChangedCount,
    statusChangedCount: plan.statusChangedCount,
    successCount: plan.successCount,
    warningCount: plan.warningCount,
    errorCount: plan.errorCount,
    dryRun,
  };

  if (dryRun || plan.changedTargets.length === 0) {
    return {
      ...summary,
      cacheIndexUpdated: false,
      cacheIndexUpdatedEntryCount: 0,
      cacheIndexTouchedShardCount: 0,
      cacheIndexSkippedMissingDocCount: 0,
    };
  }

  await writeNormalizedStatuses({
    db,
    collectionPath,
    changedTargets: plan.changedTargets,
  });

  const cacheIndexSummary = await updateCacheIndexEntries({
    projectId,
    collectionPath,
    docIds: plan.changedTargets.map((item) => item.docId),
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

  const summary = await normalizeStatuses({
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
    console.error('[normalize-testdata-status] fatal:', error);
    process.exit(1);
  });
}

module.exports = {
  buildNormalizationPatch,
  deriveNormalizedStatus,
  normalizeStatuses,
};