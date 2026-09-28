/** biome-ignore-all lint/style/useNodejsImportProtocol: backend utility script */

const path = require('node:path');

const {
  admin,
  buildIndexDocId,
  getAdminApp,
  getCollectionDefinition,
  getGradeNumber,
  parseFilter,
  selectRecordsForGrade,
  toShardSuffix,
} = require('./testDataImportShared.cjs');

function log(...args) {
  console.log('[update-cache-index-entries]', ...args);
}

function parseArgs(argv) {
  const out = {
    inputPath: '',
    gradeId: '',
    collectionPath: '',
    projectId:
      process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '',
    dryRun: false,
    where: [],
    docIds: [],
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
  node ./scripts/updateCacheIndexEntries.cjs --project <id> --collection <path> --doc-id <id> [--doc-id <id>] [--dry-run]
  node ./scripts/updateCacheIndexEntries.cjs --project <id> --grade <firstGrade|secondGrade> --input <path> [--where <expr>] [--dry-run]

Options:
  --project <id>         Firebase project id
  --collection <path>   Target collection path: firstGrade | secondGrade | storageList/firstGrade/images | storageList/secondGrade/images
  --grade <id>          Alias of collection for JSON mode: firstGrade | secondGrade
  --doc-id <id>         Doc id to update in cacheIndex. Repeatable
  --input <path>        Path to JSON file containing an array of test data
  --where <expr>        Filter expression for JSON mode. Repeatable
  --dry-run             Summarize without writing to Firestore
  --help, -h            Show this help`);
}

function uniqueDocIds(docIds) {
  return [...new Set(docIds.map((item) => String(item).trim()).filter(Boolean))];
}

function groupDocIdsByShard(docIds, definition) {
  const grouped = new Map();

  for (const docId of docIds) {
    const shardSuffix = toShardSuffix(docId, definition.shardCount);
    const current = grouped.get(shardSuffix) ?? [];
    current.push(docId);
    grouped.set(shardSuffix, current);
  }

  return grouped;
}

async function updateShardChunk({ db, definition, shardSuffix, docIds, dryRun }) {
  const indexDocId = buildIndexDocId(definition, shardSuffix);
  const indexRef = db.collection(definition.indexCollectionPath).doc(indexDocId);
  const docRefs = docIds.map((docId) =>
    db.collection(definition.collectionPath).doc(docId),
  );

  return db.runTransaction(async (tx) => {
    const indexSnap = await tx.get(indexRef);
    const currentIndex = indexSnap.exists ? indexSnap.data() : {};
    const currentItems =
      currentIndex &&
      currentIndex.items &&
      typeof currentIndex.items === 'object' &&
      !Array.isArray(currentIndex.items)
        ? { ...currentIndex.items }
        : {};

    let updatedEntryCount = 0;
    let skippedMissingDocCount = 0;

    for (const docRef of docRefs) {
      const docSnap = await tx.get(docRef);
      if (!docSnap.exists) {
        skippedMissingDocCount += 1;
        continue;
      }

      const data = docSnap.data() ?? {};
      const updatedAt =
        data.updatedAt instanceof admin.firestore.Timestamp
          ? data.updatedAt
          : docSnap.updateTime;

      currentItems[docSnap.id] = {
        updatedAt,
        deleted: data.deleted === true,
      };
      updatedEntryCount += 1;
    }

    if (!dryRun && updatedEntryCount > 0) {
      tx.set(
        indexRef,
        {
          collectionPath: definition.collectionPath,
          shard: shardSuffix,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          items: currentItems,
        },
        { merge: true },
      );
    }

    return {
      updatedEntryCount,
      skippedMissingDocCount,
    };
  });
}

async function updateCacheIndexEntries({ projectId, collectionPath, docIds, dryRun }) {
  const definition = getCollectionDefinition(collectionPath);
  const app = getAdminApp(projectId);
  const db = admin.firestore(app);
  const uniqueIds = uniqueDocIds(docIds);
  const grouped = groupDocIdsByShard(uniqueIds, definition);

  let updatedEntryCount = 0;
  let skippedMissingDocCount = 0;

  for (const [shardSuffix, shardDocIds] of grouped.entries()) {
    for (let index = 0; index < shardDocIds.length; index += 200) {
      const chunk = shardDocIds.slice(index, index + 200);
      const result = await updateShardChunk({
        db,
        definition,
        shardSuffix,
        docIds: chunk,
        dryRun,
      });

      updatedEntryCount += result.updatedEntryCount;
      skippedMissingDocCount += result.skippedMissingDocCount;
    }
  }

  return {
    collectionPath,
    targetDocIdCount: uniqueIds.length,
    touchedShardCount: grouped.size,
    updatedEntryCount,
    skippedMissingDocCount,
    dryRun,
  };
}

async function resolveCollectionAndDocIds(args) {
  const collectionPath = args.collectionPath || args.gradeId;

  if (!collectionPath) {
    throw new Error('--collection or --grade is required');
  }

  if (args.docIds.length > 0) {
    return {
      collectionPath,
      docIds: uniqueDocIds(args.docIds),
      selectionSummary: null,
    };
  }

  if (!args.inputPath) {
    throw new Error('--input is required when --doc-id is not provided');
  }

  const absoluteInputPath = path.resolve(args.inputPath);
  const expectedGrade = getGradeNumber(collectionPath);
  const filters = args.where.map(parseFilter);
  const selected = await selectRecordsForGrade({
    inputPath: absoluteInputPath,
    expectedGrade,
    filters,
  });

  const deduped = new Map();
  for (const record of selected.filteredRecords) {
    deduped.set(String(record.no), record);
  }

  return {
    collectionPath,
    docIds: [...deduped.keys()],
    selectionSummary: {
      inputPath: absoluteInputPath,
      totalCount: selected.records.length,
      invalidCount: selected.invalidReasons.length,
      filteredOutCount: selected.filteredOutCount,
      duplicateOverwrittenCount:
        selected.filteredRecords.length - deduped.size,
      targetDocIdCount: deduped.size,
    },
    invalidReasons: selected.invalidReasons,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const resolved = await resolveCollectionAndDocIds(args);
  if (resolved.invalidReasons && resolved.invalidReasons.length > 0) {
    for (const reason of resolved.invalidReasons.slice(0, 20)) {
      console.error(reason);
    }
    throw new Error(
      `validation failed: ${resolved.invalidReasons.length} invalid rows`,
    );
  }

  log(
    `project=${args.projectId || '(auto)'} collection=${resolved.collectionPath} dryRun=${args.dryRun}`,
  );
  if (resolved.selectionSummary) {
    console.log(JSON.stringify(resolved.selectionSummary));
  }

  const result = await updateCacheIndexEntries({
    projectId: args.projectId,
    collectionPath: resolved.collectionPath,
    docIds: resolved.docIds,
    dryRun: args.dryRun,
  });

  console.log(JSON.stringify(result));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[update-cache-index-entries] fatal:', error);
    process.exit(1);
  });
}

module.exports = {
  updateCacheIndexEntries,
};