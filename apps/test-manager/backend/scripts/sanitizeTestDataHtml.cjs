/** biome-ignore-all lint/style/useNodejsImportProtocol: backend utility script */

const fs = require('node:fs/promises');
const path = require('node:path');

const {
  admin,
  getAdminApp,
  getCollectionDefinition,
  matchesFilter,
  parseFilter,
} = require('./testDataImportShared.cjs');
const {
  buildHtmlSanitizePatch,
  createEmptyOperationSummary,
} = require('./testDataHtmlSanitizeShared.cjs');
const { updateCacheIndexEntries } = require('./updateCacheIndexEntries.cjs');

function log(...args) {
  console.log('[sanitize-testdata-html]', ...args);
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
    reportOut: '',
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

    if (arg === '--report-out') {
      out.reportOut = argv[index + 1] || '';
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
  node ./scripts/sanitizeTestDataHtml.cjs --project <id> --grade <firstGrade|secondGrade> [--where <expr>] [--doc-id <id>] [--page-size <number>] [--report-out <path>] [--dry-run]
  node ./scripts/sanitizeTestDataHtml.cjs --project <id> --collection <path> [--where <expr>] [--doc-id <id>] [--page-size <number>] [--report-out <path>] [--dry-run]

Options:
  --project <id>         Firebase project id
  --grade <id>           Target collection alias: firstGrade | secondGrade
  --collection <path>    Target collection path: firstGrade | secondGrade
  --where <expr>         Filter expression. Repeatable. Supported operators: ==, !=, in, not-in
  --doc-id <id>          Target doc id. Repeatable
  --page-size <number>   Scan page size when --doc-id is omitted. Default: 500
  --report-out <path>    Write detailed JSON report to file
  --dry-run              Summarize without writing to Firestore or cacheIndex
  --help, -h             Show this help

Behavior:
  - warning / notification 原因となる既知の属性・class・style を除去します
  - img align=left|right|center は image-resizer 互換 style へ変換します
  - img の src は保存しないため除去します
  - img の width / height は数値または空文字だけ保持します
  - tag 自体は削除せず、属性正規化に限定します

Examples:
  node ./scripts/sanitizeTestDataHtml.cjs --project demo-test-manager --grade firstGrade --dry-run
  node ./scripts/sanitizeTestDataHtml.cjs --project demo-test-manager --grade secondGrade --where "subject!=学科Ⅰ"
  node ./scripts/sanitizeTestDataHtml.cjs --project demo-test-manager --collection firstGrade --doc-id 100 --doc-id 101 --report-out ./_tmp/sanitize-firstGrade.json`);
}

function uniqueDocIds(docIds) {
  return [...new Set(docIds.map((item) => String(item).trim()).filter(Boolean))];
}

function matchesAllFilters(data, filters) {
  return filters.every((filter) => matchesFilter(data, filter));
}

function accumulateSummary(target, source) {
  target.wrapperStyleNormalizedCount += source.wrapperStyleNormalizedCount;
  target.convertedAlignCount += source.convertedAlignCount;
  target.removedAlignCount += source.removedAlignCount;
  target.removedSrcCount += source.removedSrcCount;
  target.removedAttributeCount += source.removedAttributeCount;
  target.removedClassCount += source.removedClassCount;
  target.removedInlineStyleAttributeCount +=
    source.removedInlineStyleAttributeCount;
  target.removedStylePropertyCount += source.removedStylePropertyCount;
  target.removedStyleValueCount += source.removedStyleValueCount;
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

function buildSanitizePlan(targets) {
  const changedTargets = [];
  const failedTargets = [];
  const operationSummary = createEmptyOperationSummary();
  let unchangedCount = 0;
  let changedFieldCount = 0;

  for (const snapshot of targets) {
    try {
      const data = snapshot.data() ?? {};
      const plan = buildHtmlSanitizePatch(data);

      if (!plan.changed) {
        unchangedCount += 1;
        continue;
      }

      changedFieldCount += plan.changedFields.length;
      accumulateSummary(operationSummary, plan.operationSummary);
      changedTargets.push({
        docId: snapshot.id,
        patch: plan.patch,
        changedFields: plan.changedFields,
        fieldDetails: plan.fieldDetails,
        operationSummary: plan.operationSummary,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failedTargets.push({
        docId: snapshot.id,
        message,
      });
    }
  }

  return {
    changedTargets,
    failedTargets,
    unchangedCount,
    changedFieldCount,
    operationSummary,
  };
}

async function commitSanitizeChunk({ db, collectionPath, chunk, startIndex }) {
  const batch = db.batch();

  for (const target of chunk) {
    const ref = db.collection(collectionPath).doc(target.docId);
    batch.set(
      ref,
      {
        ...target.patch,
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
      '[sanitize-testdata-html] batch commit failed',
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

    await commitSanitizeChunk({
      db,
      collectionPath,
      chunk: first,
      startIndex,
    });

    await commitSanitizeChunk({
      db,
      collectionPath,
      chunk: second,
      startIndex: startIndex + middle,
    });
  }
}

async function writeSanitizeTargets({ db, collectionPath, changedTargets }) {
  const batchSize = 100;

  for (let index = 0; index < changedTargets.length; index += batchSize) {
    const chunk = changedTargets.slice(index, index + batchSize);
    await commitSanitizeChunk({
      db,
      collectionPath,
      chunk,
      startIndex: index,
    });
  }
}

async function writeReport(reportOut, report) {
  if (!reportOut) {
    return;
  }

  const absoluteReportPath = path.resolve(reportOut);
  await fs.mkdir(path.dirname(absoluteReportPath), { recursive: true });
  await fs.writeFile(absoluteReportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  log(`report written path=${absoluteReportPath}`);
}

async function sanitizeTestDataHtml({
  projectId,
  collectionPath,
  filters,
  docIds,
  pageSize,
  dryRun,
  reportOut,
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

  const plan = buildSanitizePlan(sourceSummary.targets);
  const summary = {
    collectionPath,
    scannedCount: sourceSummary.scannedCount,
    filteredOutCount: sourceSummary.filteredOutCount,
    missingDocCount: sourceSummary.missingDocCount,
    targetCount: sourceSummary.targets.length,
    unchangedCount: plan.unchangedCount,
    sanitizedCount: plan.changedTargets.length,
    changedFieldCount: plan.changedFieldCount,
    wrapperStyleNormalizedCount: plan.operationSummary.wrapperStyleNormalizedCount,
    convertedAlignCount: plan.operationSummary.convertedAlignCount,
    removedAlignCount: plan.operationSummary.removedAlignCount,
    removedSrcCount: plan.operationSummary.removedSrcCount,
    removedAttributeCount: plan.operationSummary.removedAttributeCount,
    removedClassCount: plan.operationSummary.removedClassCount,
    removedInlineStyleAttributeCount:
      plan.operationSummary.removedInlineStyleAttributeCount,
    removedStylePropertyCount: plan.operationSummary.removedStylePropertyCount,
    removedStyleValueCount: plan.operationSummary.removedStyleValueCount,
    failedCount: plan.failedTargets.length,
    dryRun,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    summary,
    changedDocs: plan.changedTargets.map((target) => ({
      docId: target.docId,
      changedFields: target.changedFields,
      operationSummary: target.operationSummary,
      fieldDetails: target.fieldDetails,
    })),
    failedDocs: plan.failedTargets,
  };

  if (dryRun || plan.changedTargets.length === 0 || plan.failedTargets.length > 0) {
    await writeReport(reportOut, {
      ...report,
      summary: {
        ...summary,
        cacheIndexUpdated: false,
        cacheIndexUpdatedEntryCount: 0,
        cacheIndexTouchedShardCount: 0,
        cacheIndexSkippedMissingDocCount: 0,
      },
    });

    return {
      ...summary,
      cacheIndexUpdated: false,
      cacheIndexUpdatedEntryCount: 0,
      cacheIndexTouchedShardCount: 0,
      cacheIndexSkippedMissingDocCount: 0,
    };
  }

  await writeSanitizeTargets({
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

  const result = {
    ...summary,
    cacheIndexUpdated: true,
    cacheIndexUpdatedEntryCount: cacheIndexSummary.updatedEntryCount,
    cacheIndexTouchedShardCount: cacheIndexSummary.touchedShardCount,
    cacheIndexSkippedMissingDocCount: cacheIndexSummary.skippedMissingDocCount,
  };

  await writeReport(reportOut, {
    ...report,
    summary: result,
  });

  return result;
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
  if (args.reportOut) {
    log(`reportOut=${path.resolve(args.reportOut)}`);
  }

  const summary = await sanitizeTestDataHtml({
    projectId: args.projectId,
    collectionPath,
    filters,
    docIds: args.docIds,
    pageSize: args.pageSize,
    dryRun: args.dryRun,
    reportOut: args.reportOut,
  });

  console.log(JSON.stringify(summary));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[sanitize-testdata-html] fatal:', error);
    process.exit(1);
  });
}

module.exports = {
  buildSanitizePlan,
  sanitizeTestDataHtml,
};