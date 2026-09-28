/** biome-ignore-all lint/style/useNodejsImportProtocol: backend utility script */

const admin = require('firebase-admin');

const DEFAULT_COLLECTIONS = [
  {
    collectionPath: 'firstGrade',
    indexCollectionPath: 'cacheIndex',
    indexDocIdPrefix: 'firstGrade',
    shardCount: 16,
  },
  {
    collectionPath: 'secondGrade',
    indexCollectionPath: 'cacheIndex',
    indexDocIdPrefix: 'secondGrade',
    shardCount: 16,
  },
  {
    collectionPath: 'storageList/firstGrade/images',
    indexCollectionPath: 'cacheIndex',
    indexDocIdPrefix: 'storageList_firstGrade_images',
    shardCount: 16,
  },
  {
    collectionPath: 'storageList/secondGrade/images',
    indexCollectionPath: 'cacheIndex',
    indexDocIdPrefix: 'storageList_secondGrade_images',
    shardCount: 16,
  },
];

function log(...args) {
  console.log('[build-cache-index]', ...args);
}

function hashDocId(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function toShardSuffix(docId, shardCount) {
  const shard = hashDocId(docId) % shardCount;
  return shard.toString(16).padStart(2, '0');
}

function buildIndexDocId(definition, shardSuffix) {
  return `${definition.indexDocIdPrefix}_${shardSuffix}`;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseArgs(argv) {
  const out = {
    projectId:
      process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '',
    dryRun: false,
    collections: [],
    pageSize: 500,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--project') {
      out.projectId = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--collection') {
      const value = argv[index + 1] || '';
      if (value) {
        out.collections.push(value);
      }
      index += 1;
      continue;
    }

    if (arg === '--collections') {
      const value = argv[index + 1] || '';
      if (value) {
        out.collections.push(
          ...value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        );
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
    }
  }

  return out;
}

function pickCollections(requestedPaths) {
  if (!requestedPaths.length) {
    return DEFAULT_COLLECTIONS;
  }

  const allowed = new Set(requestedPaths);
  const selected = DEFAULT_COLLECTIONS.filter((item) =>
    allowed.has(item.collectionPath),
  );

  const unknown = requestedPaths.filter(
    (path) => !DEFAULT_COLLECTIONS.some((item) => item.collectionPath === path),
  );

  if (unknown.length > 0) {
    throw new Error(`unsupported collectionPath: ${unknown.join(', ')}`);
  }

  return selected;
}

function getAdminApp(projectId) {
  const useEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

  if (useEmulator) {
    if (!projectId) {
      throw new Error(
        'FIRESTORE_EMULATOR_HOST 利用時は --project または GCLOUD_PROJECT が必要です',
      );
    }

    return admin.initializeApp({ projectId });
  }

  if (!projectId) {
    throw new Error('--project is required when using production Firestore');
  }

  return admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
  });
}

async function scanCollection(db, definition, pageSize) {
  const byShard = new Map();
  let lastDoc = null;
  let scannedCount = 0;
  let missingUpdatedAtCount = 0;

  for (;;) {
    let query = db
      .collection(definition.collectionPath)
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

      const data = docSnap.data();
      const dataUpdatedAt = isPlainObject(data) ? data.updatedAt : undefined;
      const updatedAt =
        dataUpdatedAt instanceof admin.firestore.Timestamp
          ? dataUpdatedAt
          : docSnap.updateTime;

      if (!(dataUpdatedAt instanceof admin.firestore.Timestamp)) {
        missingUpdatedAtCount += 1;
      }

      const deleted =
        isPlainObject(data) && Object.prototype.hasOwnProperty.call(data, 'deleted')
          ? data.deleted === true
          : false;
      const shardSuffix = toShardSuffix(docSnap.id, definition.shardCount);
      const shardState = byShard.get(shardSuffix) ?? {};

      shardState[docSnap.id] = {
        updatedAt,
        deleted,
      };

      byShard.set(shardSuffix, shardState);
    }

    if (snap.size < pageSize) {
      break;
    }

    lastDoc = snap.docs.at(-1) ?? null;
  }

  return {
    scannedCount,
    missingUpdatedAtCount,
    byShard,
  };
}

async function writeIndexDocs(db, definition, byShard, dryRun) {
  const now = admin.firestore.Timestamp.now();
  const docs = [];

  for (let shard = 0; shard < definition.shardCount; shard += 1) {
    const shardSuffix = shard.toString(16).padStart(2, '0');
    const docId = buildIndexDocId(definition, shardSuffix);
    const docRef = db.collection(definition.indexCollectionPath).doc(docId);
    const items = byShard.get(shardSuffix) ?? {};
    const payload = {
      collectionPath: definition.collectionPath,
      shard: shardSuffix,
      updatedAt: now,
      items,
    };

    docs.push({ docRef, payload, itemCount: Object.keys(items).length });
  }

  if (dryRun) {
    return docs;
  }

  for (let index = 0; index < docs.length; index += 400) {
    const chunk = docs.slice(index, index + 400);
    const batch = db.batch();

    for (const item of chunk) {
      batch.set(item.docRef, item.payload, { merge: false });
    }

    await batch.commit();
  }

  return docs;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const definitions = pickCollections(args.collections);
  const app = getAdminApp(args.projectId);
  const db = admin.firestore(app);
  const useEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

  log(
    `mode=${useEmulator ? 'emulator' : 'production'} project=${args.projectId || '(auto)'}`,
  );
  log(
    `targets=${definitions.map((item) => item.collectionPath).join(', ')} dryRun=${args.dryRun}`,
  );

  const summary = [];

  for (const definition of definitions) {
    log(`scan start: ${definition.collectionPath}`);
    const scanned = await scanCollection(db, definition, args.pageSize);
    const writtenDocs = await writeIndexDocs(
      db,
      definition,
      scanned.byShard,
      args.dryRun,
    );
    const nonEmptyShards = writtenDocs.filter((item) => item.itemCount > 0).length;

    summary.push({
      collectionPath: definition.collectionPath,
      scannedCount: scanned.scannedCount,
      missingUpdatedAtCount: scanned.missingUpdatedAtCount,
      shardDocCount: writtenDocs.length,
      nonEmptyShards,
    });

    log(
      `scan done: ${definition.collectionPath} docs=${scanned.scannedCount} shardDocs=${writtenDocs.length} nonEmptyShards=${nonEmptyShards} missingUpdatedAt=${scanned.missingUpdatedAtCount}`,
    );
  }

  log(args.dryRun ? 'dry-run summary' : 'completed');
  for (const item of summary) {
    console.log(
      JSON.stringify({
        collectionPath: item.collectionPath,
        scannedCount: item.scannedCount,
        shardDocCount: item.shardDocCount,
        nonEmptyShards: item.nonEmptyShards,
        missingUpdatedAtCount: item.missingUpdatedAtCount,
      }),
    );
  }
}

main().catch((error) => {
  console.error('[build-cache-index] fatal:', error);
  process.exit(1);
});
