/** biome-ignore-all lint/style/useNodejsImportProtocol: backend utility script */

const fs = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

const {
  admin,
  buildIndexDocId,
  getAdminApp,
  getCollectionDefinition,
  toShardSuffix,
} = require('./testDataImportShared.cjs');

const QUESTION_COLLECTIONS = new Set(['firstGrade', 'secondGrade']);

function log(...args) {
  console.log('[delete-testdata-by-id]', ...args);
}

function parseArgs(argv) {
  const out = {
    projectId:
      process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '',
    gradeId: '',
    collectionPath: '',
    reportOut: '',
    idSpecs: [],
    dryRun: false,
    yes: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--project') {
      out.projectId = argv[index + 1] || '';
      index += 1;
      continue;
    }

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

    if (arg === '--report-out') {
      out.reportOut = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--id' || arg === '--doc-id') {
      const value = argv[index + 1] || '';
      if (value) {
        out.idSpecs.push(value);
      }
      index += 1;
      continue;
    }

    if (arg === '--ids' || arg === '--doc-ids') {
      const value = argv[index + 1] || '';
      if (value) {
        out.idSpecs.push(...value.split(','));
      }
      index += 1;
      continue;
    }

    if (arg === '--dry-run') {
      out.dryRun = true;
      continue;
    }

    if (arg === '--yes') {
      out.yes = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      out.help = true;
      continue;
    }

    if (!arg.startsWith('--')) {
      out.idSpecs.push(arg);
    }
  }

  return out;
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/deleteTestDataById.cjs --project <id> --grade <firstGrade|secondGrade> [--report-out <path>] [--dry-run] [--yes] <idSpec> [<idSpec> ...]
  node ./scripts/deleteTestDataById.cjs --project <id> --collection <path> [--report-out <path>] [--dry-run] [--yes] --ids <spec1,spec2,...>

Options:
  --project <id>         Firebase project id
  --grade <id>           Target collection alias: firstGrade | secondGrade
  --collection <path>    Target collection path: firstGrade | secondGrade
  --id <spec>            Delete target id spec. Repeatable
  --ids <a,b,c>          Delete target id specs as comma separated list
  --doc-id <spec>        Alias of --id
  --doc-ids <a,b,c>      Alias of --ids
  --report-out <path>    Write detailed JSON report to file
  --dry-run              Summarize without deleting Firestore docs or cacheIndex entries
  --yes                  Skip confirmation prompt
  --help, -h             Show this help

Id spec:
  - 10      : single doc id
  - 10-20   : inclusive range
  - 10 20 30 40-45 のように混在指定可

Examples:
  node ./scripts/deleteTestDataById.cjs --project demo-test-manager --grade firstGrade --dry-run 10-20 30 40
  node ./scripts/deleteTestDataById.cjs --project demo-test-manager --grade secondGrade --report-out ./_tmp/delete-secondGrade.json 100 120-125
  node ./scripts/deleteTestDataById.cjs --project demo-test-manager --collection firstGrade --ids 10-20,30,40-45 --yes`);
}

function compareNumericString(left, right) {
  const leftNum = Number(left);
  const rightNum = Number(right);

  if (Number.isFinite(leftNum) && Number.isFinite(rightNum)) {
    return leftNum - rightNum;
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function normalizeIdToken(value) {
  const trimmed = String(value).trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`invalid id: ${value}`);
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`invalid id: ${value}`);
  }

  return String(parsed);
}

function expandIdSpec(spec) {
  const trimmed = String(spec).trim();
  if (!trimmed) {
    return [];
  }

  if (/^\d+$/.test(trimmed)) {
    return [normalizeIdToken(trimmed)];
  }

  const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(trimmed);
  if (!rangeMatch) {
    throw new Error(`invalid id spec: ${spec}`);
  }

  const start = Number(rangeMatch[1]);
  const end = Number(rangeMatch[2]);

  if (start > end) {
    throw new Error(`invalid id range: ${spec}`);
  }

  const ids = [];
  for (let value = start; value <= end; value += 1) {
    ids.push(String(value));
  }

  return ids;
}

function resolveDocIds(idSpecs) {
  const deduped = new Set();

  for (const spec of idSpecs) {
    for (const docId of expandIdSpec(spec)) {
      deduped.add(docId);
    }
  }

  return [...deduped].sort(compareNumericString);
}

function pickCollectionPath(args) {
  const collectionPath = args.collectionPath || args.gradeId;
  if (!collectionPath) {
    throw new Error('--collection or --grade is required');
  }

  if (!QUESTION_COLLECTIONS.has(collectionPath)) {
    throw new Error(`unsupported collectionPath: ${collectionPath}`);
  }

  return collectionPath;
}

function pickDocMeta(docId, data) {
  return {
    docId,
    subject: typeof data?.subject === 'string' ? data.subject : '',
    nengo: typeof data?.nengo === 'string' ? data.nengo : '',
    year:
      typeof data?.year === 'string' || typeof data?.year === 'number'
        ? String(data.year)
        : '',
    testNo:
      typeof data?.testNo === 'string' || typeof data?.testNo === 'number'
        ? String(data.testNo)
        : '',
    no:
      typeof data?.no === 'string' || typeof data?.no === 'number'
        ? String(data.no)
        : '',
  };
}

async function confirmProceed({ collectionPath, docIds }) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(
      `${collectionPath} の問題 ${docIds.length} 件を物理削除します。続行しますか？ [y/N] `,
    );
    return /^y(?:es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

async function deleteDocAndCacheIndexEntry({
  db,
  definition,
  docId,
  dryRun,
}) {
  const docRef = db.collection(definition.collectionPath).doc(docId);
  const shardSuffix = toShardSuffix(docId, definition.shardCount);
  const indexDocId = buildIndexDocId(definition, shardSuffix);
  const indexRef = db.collection(definition.indexCollectionPath).doc(indexDocId);

  return db.runTransaction(async (tx) => {
    const [docSnapshot, indexSnapshot] = await Promise.all([
      tx.get(docRef),
      tx.get(indexRef),
    ]);

    const data = docSnapshot.exists ? docSnapshot.data() ?? {} : {};
    const meta = pickDocMeta(docId, data);
    const indexData = indexSnapshot.exists ? indexSnapshot.data() ?? {} : {};
    const currentItems =
      indexData &&
      indexData.items &&
      typeof indexData.items === 'object' &&
      !Array.isArray(indexData.items)
        ? { ...indexData.items }
        : {};
    const hasDoc = docSnapshot.exists;
    const hasIndexEntry = Object.prototype.hasOwnProperty.call(currentItems, docId);

    if (!hasDoc && !hasIndexEntry) {
      return {
        status: 'missing',
        meta,
        deletedDoc: false,
        deletedIndexEntry: false,
      };
    }

    if (dryRun) {
      return {
        status:
          hasDoc && hasIndexEntry
            ? 'would-delete-doc-and-index'
            : hasDoc
              ? 'would-delete-doc-only'
              : 'would-delete-stale-index',
        meta,
        deletedDoc: hasDoc,
        deletedIndexEntry: hasIndexEntry,
      };
    }

    if (hasDoc) {
      tx.delete(docRef);
    }

    if (hasIndexEntry) {
      delete currentItems[docId];
      tx.set(
        indexRef,
        {
          collectionPath: definition.collectionPath,
          shard: shardSuffix,
          updatedAt: admin.firestore.Timestamp.now(),
          items: currentItems,
        },
        { merge: true },
      );
    }

    return {
      status:
        hasDoc && hasIndexEntry
          ? 'deleted'
          : hasDoc
            ? 'deleted-doc-only'
            : 'deleted-stale-index',
      meta,
      deletedDoc: hasDoc,
      deletedIndexEntry: hasIndexEntry,
    };
  });
}

async function writeReport(reportOut, report) {
  if (!reportOut) {
    return;
  }

  const absolutePath = path.resolve(reportOut);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  log(`report written path=${absolutePath}`);
}

async function deleteTestDataById({
  projectId,
  collectionPath,
  docIds,
  dryRun,
  reportOut,
}) {
  const definition = getCollectionDefinition(collectionPath);
  const app = getAdminApp(projectId);
  const db = admin.firestore(app);

  const summary = {
    collectionPath,
    targetDocIdCount: docIds.length,
    deletedCount: 0,
    deletedDocCount: 0,
    deletedIndexEntryCount: 0,
    deletedDocOnlyCount: 0,
    deletedStaleIndexCount: 0,
    missingCount: 0,
    failedCount: 0,
    dryRun,
  };
  const deletedDocs = [];
  const missingDocs = [];
  const failedDocs = [];

  for (const docId of docIds) {
    try {
      const result = await deleteDocAndCacheIndexEntry({
        db,
        definition,
        docId,
        dryRun,
      });

      if (result.status === 'missing') {
        summary.missingCount += 1;
        missingDocs.push({
          docId,
        });
        continue;
      }

      if (
        result.status === 'deleted' ||
        result.status === 'deleted-doc-only' ||
        result.status === 'deleted-stale-index' ||
        result.status === 'would-delete-doc-and-index' ||
        result.status === 'would-delete-doc-only' ||
        result.status === 'would-delete-stale-index'
      ) {
        summary.deletedCount += 1;
      }

      if (result.deletedDoc) {
        summary.deletedDocCount += 1;
      }

      if (result.deletedIndexEntry) {
        summary.deletedIndexEntryCount += 1;
      }

      if (
        result.status === 'deleted-doc-only' ||
        result.status === 'would-delete-doc-only'
      ) {
        summary.deletedDocOnlyCount += 1;
      }

      if (
        result.status === 'deleted-stale-index' ||
        result.status === 'would-delete-stale-index'
      ) {
        summary.deletedStaleIndexCount += 1;
      }

      deletedDocs.push({
        docId,
        ...result.meta,
        status: result.status,
      });
      log('target', JSON.stringify({ docId, ...result.meta, status: result.status }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.failedCount += 1;
      failedDocs.push({
        docId,
        message,
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary,
    deletedDocs,
    missingDocs,
    failedDocs,
  };

  await writeReport(reportOut, report);
  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return { exitCode: 0 };
  }

  const collectionPath = pickCollectionPath(args);
  const docIds = resolveDocIds(args.idSpecs);

  if (docIds.length === 0) {
    throw new Error('削除対象がありません。ID または ID 範囲を指定してください');
  }

  if (!args.dryRun && !args.yes) {
    const confirmed = await confirmProceed({ collectionPath, docIds });
    if (!confirmed) {
      log('aborted by user');
      return { exitCode: 0, aborted: true };
    }
  }

  const useEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  log(
    `mode=${useEmulator ? 'emulator' : 'production'} project=${args.projectId || '(auto)'} collection=${collectionPath} dryRun=${args.dryRun}`,
  );
  if (args.reportOut) {
    log(`reportOut=${path.resolve(args.reportOut)}`);
  }
  log(`docIds=${docIds.join(', ')}`);

  const summary = await deleteTestDataById({
    projectId: args.projectId,
    collectionPath,
    docIds,
    dryRun: args.dryRun,
    reportOut: args.reportOut,
  });

  console.log(JSON.stringify(summary));
  return { exitCode: 0 };
}

if (require.main === module) {
  main()
    .then((result) => {
      if (result && typeof result.exitCode === 'number') {
        process.exit(result.exitCode);
      }
    })
    .catch((error) => {
      console.error('[delete-testdata-by-id] fatal:', error);
      process.exit(1);
    });
}

module.exports = {
  deleteTestDataById,
  expandIdSpec,
  resolveDocIds,
};