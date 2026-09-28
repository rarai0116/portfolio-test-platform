/** biome-ignore-all lint/style/useNodejsImportProtocol: backend utility script */

const fs = require('node:fs/promises');
const path = require('node:path');

const {
  admin,
  getAdminApp,
} = require('./testDataImportShared.cjs');

const VALID_GRADES = new Set(['firstGrade', 'secondGrade']);
const VALID_DIRECTIONS = new Set([
  'both',
  'firestore-to-storage',
  'storage-to-firestore',
]);

function log(...args) {
  console.log('[audit-storage-list-objects]', ...args);
}

function parseArgs(argv) {
  const out = {
    projectId:
      process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '',
    gradeId: '',
    direction: 'both',
    pageSize: 500,
    reportOut: '',
    imageIds: [],
    includeNonPng: false,
    help: false,
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

    if (arg === '--direction') {
      out.direction = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--image-id') {
      const value = argv[index + 1] || '';
      if (value) out.imageIds.push(value);
      index += 1;
      continue;
    }

    if (arg === '--image-ids') {
      const value = argv[index + 1] || '';
      out.imageIds.push(...value.split(','));
      index += 1;
      continue;
    }

    if (arg === '--page-size') {
      const value = Number(argv[index + 1] || '');
      if (Number.isInteger(value) && value > 0) {
        out.pageSize = value;
      }
      index += 1;
      continue;
    }

    if (arg === '--report-out') {
      out.reportOut = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--include-non-png') {
      out.includeNonPng = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      out.help = true;
    }
  }

  out.imageIds = uniqueStrings(out.imageIds);
  return out;
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/auditStorageListObjects.cjs --project <id> --grade <firstGrade|secondGrade> [options]

Options:
  --project <id>        Firebase project id
  --grade <id>          Target grade: firstGrade | secondGrade
  --direction <mode>    both | firestore-to-storage | storage-to-firestore. Default: both
  --image-id <id>       Restrict to specific image id. Repeatable
  --image-ids <a,b,c>   Restrict to comma separated image ids
  --page-size <number>  Firestore page size. Default: 500
  --report-out <path>   Write JSON report to the specified path
  --include-non-png     Include non-PNG objects in Storage -> Firestore checks
  --help, -h            Show this help`);
}

function uniqueStrings(values) {
  return [
    ...new Set(values.map((value) => String(value).trim()).filter(Boolean)),
  ];
}

function normalizeObjectPath(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\\/g, '/');
}

function fallbackObjectPath(gradeId, imageId) {
  return `original/${gradeId}/${imageId}.png`;
}

function extractImageIdFromObjectPath(objectPath) {
  const normalized = normalizeObjectPath(objectPath);
  if (!normalized) return null;
  const fileName = normalized.split('/').pop();
  if (!fileName) return null;
  const ext = path.posix.extname(fileName);
  return ext ? fileName.slice(0, -ext.length) : fileName;
}

function isPngObjectPath(objectPath) {
  return path.posix.extname(normalizeObjectPath(objectPath)).toLowerCase() === '.png';
}

function buildStorageBucketName(app, projectId) {
  const resolvedProjectId = app?.options?.projectId || projectId;
  if (!resolvedProjectId) {
    throw new Error('Storage 参照には projectId が必要です');
  }

  return `${resolvedProjectId}.firebasestorage.app`;
}

function toImageDoc(snapshot, gradeId) {
  const data = snapshot.data() ?? {};
  const rawObjectPath = normalizeObjectPath(data.objectPath);
  const objectPath = rawObjectPath || fallbackObjectPath(gradeId, snapshot.id);

  return {
    imageId: snapshot.id,
    objectPath,
    hasObjectPath: rawObjectPath.length > 0,
    deleted: data.deleted === true,
    md5Hash: typeof data.md5Hash === 'string' ? data.md5Hash : null,
    size: typeof data.size === 'number' ? data.size : null,
    width: typeof data.width === 'number' ? data.width : null,
    height: typeof data.height === 'number' ? data.height : null,
    updatedAt: data.updatedAt ?? null,
  };
}

async function loadImageDocs({ db, gradeId, imageIds, pageSize }) {
  const collection = db.collection('storageList').doc(gradeId).collection('images');
  const docs = [];
  const missingImageIds = [];

  if (imageIds.length > 0) {
    for (const imageId of imageIds) {
      const snapshot = await collection.doc(imageId).get();
      if (!snapshot.exists) {
        missingImageIds.push(imageId);
        continue;
      }
      docs.push(toImageDoc(snapshot, gradeId));
    }
    return { docs, missingImageIds };
  }

  let query = collection.orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize);

  while (true) {
    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      docs.push(toImageDoc(doc, gradeId));
    }

    const last = snapshot.docs.at(-1);
    if (!last || snapshot.size < pageSize) break;
    query = collection
      .orderBy(admin.firestore.FieldPath.documentId())
      .startAfter(last.id)
      .limit(pageSize);
  }

  return { docs, missingImageIds };
}

async function listStorageObjects({ app, projectId, gradeId, imageIds }) {
  const bucketName = buildStorageBucketName(app, projectId);
  const bucket = admin.storage(app).bucket(bucketName);
  const prefix = `original/${gradeId}/`;
  const imageIdFilter = imageIds.length > 0 ? new Set(imageIds) : null;
  const [files] = await bucket.getFiles({ prefix });
  const objects = [];

  for (const file of files) {
    const objectPath = normalizeObjectPath(file?.name);
    if (!objectPath || objectPath.endsWith('/')) continue;
    const imageId = extractImageIdFromObjectPath(objectPath);
    if (!imageId) continue;
    if (imageIdFilter && !imageIdFilter.has(imageId)) continue;

    objects.push({
      imageId,
      objectPath,
      bucket: bucketName,
    });
  }

  return objects.sort((left, right) =>
    left.objectPath.localeCompare(right.objectPath),
  );
}

function buildStorageIndexes(storageObjects) {
  const objectPathSet = new Set();
  const byImageId = new Map();

  for (const object of storageObjects) {
    objectPathSet.add(object.objectPath);
    const current = byImageId.get(object.imageId) ?? [];
    current.push(object.objectPath);
    byImageId.set(object.imageId, current);
  }

  for (const objectPaths of byImageId.values()) {
    objectPaths.sort();
  }

  return { objectPathSet, byImageId };
}

function buildAuditReport({
  args,
  firestoreDocs,
  missingFirestoreImageIds,
  storageObjects,
}) {
  const firestoreByImageId = new Map(
    firestoreDocs.map((doc) => [doc.imageId, doc]),
  );
  const storageIndexes = buildStorageIndexes(storageObjects);
  const storageObjectsForReverseCheck = args.includeNonPng
    ? storageObjects
    : storageObjects.filter((object) => isPngObjectPath(object.objectPath));
  const shouldCheckFirestoreToStorage =
    args.direction === 'both' || args.direction === 'firestore-to-storage';
  const shouldCheckStorageToFirestore =
    args.direction === 'both' || args.direction === 'storage-to-firestore';

  const missingStorageObjects = [];
  const emptyObjectPathDocs = [];
  const deletedDocWithStorageObjects = [];
  const objectPathImageIdMismatches = [];

  if (shouldCheckFirestoreToStorage) {
    for (const doc of firestoreDocs) {
      if (!doc.hasObjectPath) {
        emptyObjectPathDocs.push({
          imageId: doc.imageId,
          fallbackObjectPath: doc.objectPath,
          deleted: doc.deleted,
        });
      }

      const storageExists = storageIndexes.objectPathSet.has(doc.objectPath);
      if (doc.deleted) {
        if (storageExists) {
          deletedDocWithStorageObjects.push({
            imageId: doc.imageId,
            objectPath: doc.objectPath,
          });
        }
        continue;
      }

      if (!storageExists) {
        missingStorageObjects.push({
          imageId: doc.imageId,
          objectPath: doc.objectPath,
          md5Hash: doc.md5Hash,
          size: doc.size,
          width: doc.width,
          height: doc.height,
        });
      }

      const imageIdFromObjectPath = extractImageIdFromObjectPath(doc.objectPath);
      if (imageIdFromObjectPath && imageIdFromObjectPath !== doc.imageId) {
        objectPathImageIdMismatches.push({
          imageId: doc.imageId,
          objectPath: doc.objectPath,
          imageIdFromObjectPath,
        });
      }
    }
  }

  const storageOnlyObjects = [];
  const duplicateStorageImageIds = [];

  if (shouldCheckStorageToFirestore) {
    for (const object of storageObjectsForReverseCheck) {
      if (!firestoreByImageId.has(object.imageId)) {
        storageOnlyObjects.push(object);
      }
    }

    const reverseIndexes = buildStorageIndexes(storageObjectsForReverseCheck);
    for (const [imageId, objectPaths] of reverseIndexes.byImageId.entries()) {
      if (objectPaths.length > 1) {
        duplicateStorageImageIds.push({ imageId, objectPaths });
      }
    }
  }

  return {
    grade: args.gradeId,
    direction: args.direction,
    projectId: args.projectId || null,
    imageIds: args.imageIds,
    includeNonPng: args.includeNonPng,
    firestoreImageDocCount: firestoreDocs.length,
    requestedMissingFirestoreImageDocCount: missingFirestoreImageIds.length,
    storageObjectCount: storageObjects.length,
    reverseCheckedStorageObjectCount: storageObjectsForReverseCheck.length,
    missingStorageObjectCount: missingStorageObjects.length,
    storageOnlyObjectCount: storageOnlyObjects.length,
    duplicateStorageImageIdCount: duplicateStorageImageIds.length,
    emptyObjectPathDocCount: emptyObjectPathDocs.length,
    deletedDocWithStorageObjectCount: deletedDocWithStorageObjects.length,
    objectPathImageIdMismatchCount: objectPathImageIdMismatches.length,
    requestedMissingFirestoreImageIds: missingFirestoreImageIds,
    missingStorageObjects,
    storageOnlyObjects,
    duplicateStorageImageIds,
    emptyObjectPathDocs,
    deletedDocWithStorageObjects,
    objectPathImageIdMismatches,
  };
}

async function writeReport(reportOut, report) {
  const absolutePath = path.resolve(reportOut);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return absolutePath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (!VALID_GRADES.has(args.gradeId)) {
    throw new Error('--grade must be firstGrade or secondGrade');
  }
  if (!VALID_DIRECTIONS.has(args.direction)) {
    throw new Error('--direction must be both, firestore-to-storage, or storage-to-firestore');
  }

  const app = getAdminApp(args.projectId);
  const db = admin.firestore(app);
  const useEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

  log(
    `mode=${useEmulator ? 'emulator' : 'production'} project=${args.projectId || '(auto)'} grade=${args.gradeId} direction=${args.direction}`,
  );

  const loaded = await loadImageDocs({
    db,
    gradeId: args.gradeId,
    imageIds: args.imageIds,
    pageSize: args.pageSize,
  });
  const storageObjects = await listStorageObjects({
    app,
    projectId: args.projectId,
    gradeId: args.gradeId,
    imageIds: args.imageIds,
  });

  const report = buildAuditReport({
    args,
    firestoreDocs: loaded.docs,
    missingFirestoreImageIds: loaded.missingImageIds,
    storageObjects,
  });

  if (args.reportOut) {
    const reportPath = await writeReport(args.reportOut, report);
    log(`report written: ${reportPath}`);
  }

  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[audit-storage-list-objects] fatal:', error);
    process.exit(1);
  });
}

module.exports = {
  buildAuditReport,
  extractImageIdFromObjectPath,
  fallbackObjectPath,
  main,
  normalizeObjectPath,
};
