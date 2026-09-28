/** biome-ignore-all lint/style/useNodejsImportProtocol: backend utility script */

const fs = require('node:fs/promises');
const path = require('node:path');

const {
  admin,
  buildIndexDocId,
  getAdminApp,
  getCollectionDefinition,
  toShardSuffix,
} = require('./testDataImportShared.cjs');

const QUESTION_COLLECTIONS = new Set(['firstGrade', 'secondGrade']);
const HTML_FIELDS = [
  'text',
  'ch1',
  'ch2',
  'ch3',
  'ch4',
  'ch5',
  'answerText',
  'answerText1',
  'answerText2',
  'answerText3',
  'answerText4',
  'answerText5',
];
const IMG_TAG_RE = /<img\b[^>]*>/gi;
const EMPTY_SENTINEL = '未設定';
const INVALID_IMAGE_ID_LITERALS = new Set([
  'undefined',
  'null',
  '[object object]',
  'nan',
]);

function log(...args) {
  console.log('[sync-image-usage-metadata]', ...args);
}

function parseArgs(argv) {
  const out = {
    projectId:
      process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '',
    gradeId: '',
    pageSize: 500,
    dryRun: false,
    includeUnusedImages: false,
    reportOut: '',
    docIds: [],
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

    if (arg === '--doc-id') {
      const value = argv[index + 1] || '';
      if (value) {
        out.docIds.push(value);
      }
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

    if (arg === '--dry-run') {
      out.dryRun = true;
      continue;
    }

    if (arg === '--include-unused-images') {
      out.includeUnusedImages = true;
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
  node ./scripts/syncImageUsageMetadata.cjs --project <id> --grade <firstGrade|secondGrade> [--doc-id <id>] [--include-unused-images] [--report-out <path>] [--dry-run]

Options:
  --project <id>             Firebase project id
  --grade <id>              Target question collection: firstGrade | secondGrade
  --doc-id <id>             Restrict to specific question doc ids. Repeatable
  --page-size <number>      Page size for full scan. Default: 500
  --include-unused-images   Include unused image ids in report when scanning the entire grade
  --report-out <path>       Write JSON report to the specified path
  --dry-run                 Analyze without writing image docs or cacheIndex
  --help, -h                Show this help`);
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function decodeHtmlEntities(value) {
  if (!value || !value.includes('&')) return value;
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function extractAltFromImgTag(tag) {
  const match = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(
    tag,
  );
  const raw = match ? match[1] ?? match[2] ?? match[3] ?? '' : '';
  const value = decodeHtmlEntities(raw).trim();
  return value || null;
}

function extractImageIdsFromHtml(html) {
  if (typeof html !== 'string' || html.length === 0) {
    return [];
  }

  const ids = new Set();
  IMG_TAG_RE.lastIndex = 0;

  let match = IMG_TAG_RE.exec(html);
  while (match !== null) {
    const alt = extractAltFromImgTag(match[0]);
    if (alt) {
      ids.add(alt);
    }
    match = IMG_TAG_RE.exec(html);
  }

  return [...ids];
}

function isEmptyValue(value) {
  if (value === undefined || value === null) return true;
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed === EMPTY_SENTINEL;
}

function normalizeNonEmptyString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === EMPTY_SENTINEL) {
    return null;
  }
  return trimmed;
}

function formatUsedId(gradeId, questionDocId) {
  return `${gradeId === 'firstGrade' ? '0' : '1'}_${questionDocId}`;
}

function isInvalidImageId(value) {
  if (typeof value !== 'string') {
    return true;
  }

  return INVALID_IMAGE_ID_LITERALS.has(value.trim().toLowerCase());
}

function compareQuestionOrder(left, right) {
  const leftNo =
    typeof left.questionNo === 'number' ? left.questionNo : Number.POSITIVE_INFINITY;
  const rightNo =
    typeof right.questionNo === 'number' ? right.questionNo : Number.POSITIVE_INFINITY;

  if (leftNo !== rightNo) {
    return leftNo - rightNo;
  }

  return String(left.questionDocId).localeCompare(String(right.questionDocId), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function sortQuestionNos(questionNos) {
  return [...questionNos].sort((left, right) => left - right);
}

function buildStorageBucketName(app, projectId) {
  const resolvedProjectId = app?.options?.projectId || projectId;
  if (!resolvedProjectId) {
    throw new Error('Storage 参照には projectId が必要です');
  }

  return `${resolvedProjectId}.firebasestorage.app`;
}

function extractImageIdFromObjectPath(objectPath) {
  if (typeof objectPath !== 'string' || objectPath.length === 0) {
    return null;
  }

  const normalized = objectPath.replace(/\\/g, '/');
  const fileName = normalized.split('/').pop();
  if (!fileName) {
    return null;
  }

  const ext = path.posix.extname(fileName);
  return ext ? fileName.slice(0, -ext.length) : fileName;
}

async function listStorageObjectPathsByImageId({ app, projectId, gradeId }) {
  const bucketName = buildStorageBucketName(app, projectId);
  const bucket = admin.storage(app).bucket(bucketName);
  const prefix = `original/${gradeId}/`;
  const [files] = await bucket.getFiles({ prefix });
  const objectPathsByImageId = new Map();

  for (const file of files) {
    if (!file?.name || file.name.endsWith('/')) {
      continue;
    }

    const imageId = extractImageIdFromObjectPath(file.name);
    if (!imageId) {
      continue;
    }

    const current = objectPathsByImageId.get(imageId) ?? [];
    current.push(file.name);
    objectPathsByImageId.set(imageId, current);
  }

  for (const objectPaths of objectPathsByImageId.values()) {
    objectPaths.sort();
  }

  return objectPathsByImageId;
}

function createAggregate(imageId) {
  return {
    imageId,
    questionDocIds: new Set(),
    questionNos: new Set(),
    references: [],
    metadataCandidates: [],
    usedIds: new Set(),
    subjectCandidates: new Set(),
    categoryCandidates: new Map(),
  };
}

function collectReferencedImages(questionDocs, gradeId) {
  const aggregates = new Map();
  const referencedImageIds = new Set();
  const invalidReferences = [];

  for (const snapshot of questionDocs) {
    const data = snapshot.data();
    if (!isPlainObject(data)) {
      continue;
    }

    const questionNo = typeof data.no === 'number' ? data.no : null;
    const imageIds = new Set();
    const invalidImageIds = new Set();

    for (const field of HTML_FIELDS) {
      for (const imageId of extractImageIdsFromHtml(data[field])) {
        if (isInvalidImageId(imageId)) {
          invalidImageIds.add(imageId);
          continue;
        }

        imageIds.add(imageId);
      }
    }

    for (const imageId of invalidImageIds) {
      invalidReferences.push({
        questionDocId: snapshot.id,
        questionNo,
        imageId,
      });
    }

    if (imageIds.size === 0) {
      continue;
    }

    const usedId = formatUsedId(gradeId, snapshot.id);
    const subject = normalizeNonEmptyString(data.subject);
    const bigCategoryTag = normalizeNonEmptyString(data.bigCategoryTag);
    const smallCategoryTag = normalizeNonEmptyString(data.smallCategoryTag);

    for (const imageId of imageIds) {
      referencedImageIds.add(imageId);

      const aggregate = aggregates.get(imageId) ?? createAggregate(imageId);
      aggregate.questionDocIds.add(snapshot.id);
      if (questionNo !== null) {
        aggregate.questionNos.add(questionNo);
      }
      aggregate.usedIds.add(usedId);
      aggregate.references.push({
        questionDocId: snapshot.id,
        questionNo,
        imageId,
      });
      aggregate.metadataCandidates.push({
        questionDocId: snapshot.id,
        questionNo,
        subject,
        bigCategoryTag,
        smallCategoryTag,
      });

      if (subject) {
        aggregate.subjectCandidates.add(subject);
      }
      if (bigCategoryTag && smallCategoryTag) {
        aggregate.categoryCandidates.set(
          `${bigCategoryTag}\u0000${smallCategoryTag}`,
          {
            bigCategoryTag,
            smallCategoryTag,
          },
        );
      }

      aggregates.set(imageId, aggregate);
    }
  }

  return {
    aggregates,
    referencedImageIds,
    invalidReferences,
  };
}

function resolveSingleCandidate(candidates) {
  if (candidates.size === 0) {
    return { kind: 'none' };
  }

  if (candidates.size === 1) {
    return { kind: 'value', value: [...candidates][0] };
  }

  return { kind: 'conflict', values: [...candidates].sort() };
}

function resolveCategoryCandidate(categoryCandidates) {
  if (categoryCandidates.size === 0) {
    return { kind: 'none' };
  }

  if (categoryCandidates.size === 1) {
    return { kind: 'value', value: [...categoryCandidates.values()][0] };
  }

  return {
    kind: 'conflict',
    values: [...categoryCandidates.values()].sort((left, right) => {
      const a = `${left.bigCategoryTag}\u0000${left.smallCategoryTag}`;
      const b = `${right.bigCategoryTag}\u0000${right.smallCategoryTag}`;
      return a.localeCompare(b);
    }),
  };
}

function buildNextUsedIds(currentUsedIds, aggregateUsedIds) {
  const next = new Set(
    Array.isArray(currentUsedIds)
      ? currentUsedIds
          .filter((value) => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean)
      : [],
  );

  for (const usedId of aggregateUsedIds) {
    next.add(usedId);
  }

  return [...next].sort();
}

function buildSubjectDecision(currentData, aggregate) {
  const allEntries = aggregate.metadataCandidates
    .filter((candidate) => candidate.subject)
    .sort(compareQuestionOrder);
  const allCandidates = uniqueStrings(allEntries.map((candidate) => candidate.subject));

  if (allCandidates.length === 0) {
    return {
      conflicted: false,
      candidates: [],
      selected: null,
      selectedBy: null,
    };
  }

  const currentSubject = normalizeNonEmptyString(currentData.subject);
  if (currentSubject) {
    return {
      conflicted: allCandidates.length > 1,
      candidates: allCandidates,
      selected: currentSubject,
      selectedBy: 'existing-value',
    };
  }

  let narrowedEntries = allEntries;
  let selectedBy = allCandidates.length === 1 ? 'single-candidate' : 'lowest-question-no';

  const currentBigCategoryTag = normalizeNonEmptyString(currentData.bigCategoryTag);
  const currentSmallCategoryTag = normalizeNonEmptyString(currentData.smallCategoryTag);
  if (currentBigCategoryTag && currentSmallCategoryTag) {
    const filteredEntries = allEntries.filter(
      (candidate) =>
        candidate.bigCategoryTag === currentBigCategoryTag &&
        candidate.smallCategoryTag === currentSmallCategoryTag,
    );
    if (filteredEntries.length > 0) {
      narrowedEntries = filteredEntries;
      selectedBy = 'existing-category';
    }
  }

  const narrowedCandidates = uniqueStrings(
    narrowedEntries.map((candidate) => candidate.subject),
  );
  if (narrowedCandidates.length === 1) {
    return {
      conflicted: allCandidates.length > 1,
      candidates: allCandidates,
      selected: narrowedCandidates[0],
      selectedBy,
    };
  }

  return {
    conflicted: allCandidates.length > 1,
    candidates: allCandidates,
    selected: narrowedEntries[0]?.subject ?? null,
    selectedBy:
      selectedBy === 'existing-category'
        ? 'existing-category+lowest-question-no'
        : 'lowest-question-no',
  };
}

function buildCategoryDecision(currentData, aggregate) {
  const allEntries = aggregate.metadataCandidates
    .filter(
      (candidate) => candidate.bigCategoryTag && candidate.smallCategoryTag,
    )
    .sort(compareQuestionOrder);
  const allCategoryCandidates = new Map();
  for (const candidate of allEntries) {
    allCategoryCandidates.set(
      `${candidate.bigCategoryTag}\u0000${candidate.smallCategoryTag}`,
      {
        bigCategoryTag: candidate.bigCategoryTag,
        smallCategoryTag: candidate.smallCategoryTag,
      },
    );
  }
  const allCandidates = [...allCategoryCandidates.values()].sort((left, right) => {
    const a = `${left.bigCategoryTag}\u0000${left.smallCategoryTag}`;
    const b = `${right.bigCategoryTag}\u0000${right.smallCategoryTag}`;
    return a.localeCompare(b);
  });

  if (allCandidates.length === 0) {
    return {
      conflicted: false,
      candidates: [],
      selected: null,
      selectedBy: null,
    };
  }

  const currentBigCategoryTag = normalizeNonEmptyString(currentData.bigCategoryTag);
  const currentSmallCategoryTag = normalizeNonEmptyString(currentData.smallCategoryTag);
  if (currentBigCategoryTag && currentSmallCategoryTag) {
    return {
      conflicted: allCandidates.length > 1,
      candidates: allCandidates,
      selected: {
        bigCategoryTag: currentBigCategoryTag,
        smallCategoryTag: currentSmallCategoryTag,
      },
      selectedBy: 'existing-value',
    };
  }

  let narrowedEntries = allEntries;
  let selectedBy = allCandidates.length === 1 ? 'single-candidate' : 'lowest-question-no';

  const currentSubject = normalizeNonEmptyString(currentData.subject);
  if (currentSubject) {
    const filteredEntries = allEntries.filter(
      (candidate) => candidate.subject === currentSubject,
    );
    if (filteredEntries.length > 0) {
      narrowedEntries = filteredEntries;
      selectedBy = 'existing-subject';
    }
  }

  const narrowedCategoryCandidates = new Map();
  for (const candidate of narrowedEntries) {
    narrowedCategoryCandidates.set(
      `${candidate.bigCategoryTag}\u0000${candidate.smallCategoryTag}`,
      {
        bigCategoryTag: candidate.bigCategoryTag,
        smallCategoryTag: candidate.smallCategoryTag,
      },
    );
  }
  const narrowedCandidates = [...narrowedCategoryCandidates.values()].sort((left, right) => {
    const a = `${left.bigCategoryTag}\u0000${left.smallCategoryTag}`;
    const b = `${right.bigCategoryTag}\u0000${right.smallCategoryTag}`;
    return a.localeCompare(b);
  });

  if (narrowedCandidates.length === 1) {
    return {
      conflicted: allCandidates.length > 1,
      candidates: allCandidates,
      selected: narrowedCandidates[0],
      selectedBy,
    };
  }

  const firstCandidate = narrowedEntries[0];
  return {
    conflicted: allCandidates.length > 1,
    candidates: allCandidates,
    selected: firstCandidate
      ? {
          bigCategoryTag: firstCandidate.bigCategoryTag,
          smallCategoryTag: firstCandidate.smallCategoryTag,
        }
      : null,
    selectedBy:
      selectedBy === 'existing-subject'
        ? 'existing-subject+lowest-question-no'
        : 'lowest-question-no',
  };
}

function buildImagePatch(currentData, aggregate) {
  const patch = {};
  const conflicts = [];

  const nextUsedIds = buildNextUsedIds(currentData.usedIds, aggregate.usedIds);
  const currentUsedIds = buildNextUsedIds(currentData.usedIds, []);
  if (JSON.stringify(currentUsedIds) !== JSON.stringify(nextUsedIds)) {
    patch.usedIds = nextUsedIds;
  }

  const subjectDecision = buildSubjectDecision(currentData, aggregate);
  if (subjectDecision.conflicted) {
    conflicts.push({
      type: 'subject',
      candidates: subjectDecision.candidates,
      selected: subjectDecision.selected,
      selectedBy: subjectDecision.selectedBy,
    });
  }
  if (isEmptyValue(currentData.subject) && subjectDecision.selected) {
    patch.subject = subjectDecision.selected;
  }

  const categoryDecision = buildCategoryDecision(currentData, aggregate);
  if (categoryDecision.conflicted) {
    conflicts.push({
      type: 'category',
      candidates: categoryDecision.candidates,
      selected: categoryDecision.selected,
      selectedBy: categoryDecision.selectedBy,
    });
  }
  if (
    isEmptyValue(currentData.bigCategoryTag) &&
    isEmptyValue(currentData.smallCategoryTag) &&
    categoryDecision.selected
  ) {
    patch.bigCategoryTag = categoryDecision.selected.bigCategoryTag;
    patch.smallCategoryTag = categoryDecision.selected.smallCategoryTag;
  }

  return {
    patch,
    changedKeys: Object.keys(patch),
    conflicts,
  };
}

async function loadQuestionDocs(db, gradeId, docIds, pageSize) {
  const collectionRef = db.collection(gradeId);

  if (docIds.length > 0) {
    const uniqueDocIds = uniqueStrings(docIds);
    const docs = [];
    const missingDocIds = [];

    for (let index = 0; index < uniqueDocIds.length; index += 200) {
      const chunk = uniqueDocIds.slice(index, index + 200);
      const refs = chunk.map((docId) => collectionRef.doc(docId));
      const snapshots = await db.getAll(...refs);

      for (const snapshot of snapshots) {
        if (snapshot.exists) {
          docs.push(snapshot);
        } else {
          missingDocIds.push(snapshot.id);
        }
      }
    }

    return {
      docs,
      requestedDocIds: uniqueDocIds,
      missingDocIds,
    };
  }

  const docs = [];
  let lastDoc = null;
  const orderByDocId = admin.firestore.FieldPath.documentId();

  while (true) {
    let query = collectionRef.orderBy(orderByDocId).limit(pageSize);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      break;
    }

    docs.push(...snapshot.docs);
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  return {
    docs,
    requestedDocIds: [],
    missingDocIds: [],
  };
}

async function listUnusedImageIds(db, gradeId, referencedImageIds, pageSize) {
  const collectionRef = db
    .collection('storageList')
    .doc(gradeId)
    .collection('images');
  const unusedImageIds = [];
  const firestoreImageIds = new Set();
  let lastDoc = null;
  const orderByDocId = admin.firestore.FieldPath.documentId();

  while (true) {
    let query = collectionRef.orderBy(orderByDocId).limit(pageSize);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      break;
    }

    for (const doc of snapshot.docs) {
      firestoreImageIds.add(doc.id);
      if (!referencedImageIds.has(doc.id)) {
        unusedImageIds.push(doc.id);
      }
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  return unusedImageIds.sort();
}

async function listImageDocIdsAndUnusedImageIds(db, gradeId, referencedImageIds, pageSize) {
  const collectionRef = db
    .collection('storageList')
    .doc(gradeId)
    .collection('images');
  const firestoreImageIds = new Set();
  const unusedImageIds = [];
  let lastDoc = null;
  const orderByDocId = admin.firestore.FieldPath.documentId();

  while (true) {
    let query = collectionRef.orderBy(orderByDocId).limit(pageSize);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      break;
    }

    for (const doc of snapshot.docs) {
      firestoreImageIds.add(doc.id);
      if (!referencedImageIds.has(doc.id)) {
        unusedImageIds.push(doc.id);
      }
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  return {
    firestoreImageIds,
    unusedImageIds: unusedImageIds.sort(),
  };
}

function splitMissingReferencesByStorage(missingReferences, storageObjectPathsByImageId) {
  const missingImageReferences = [];
  const storageOnlyImageReferences = [];

  for (const reference of missingReferences) {
    const objectPaths = storageObjectPathsByImageId.get(reference.imageId);
    if (objectPaths && objectPaths.length > 0) {
      storageOnlyImageReferences.push({
        ...reference,
        objectPaths,
      });
      continue;
    }

    missingImageReferences.push(reference);
  }

  return {
    missingImageReferences,
    storageOnlyImageReferences,
  };
}

function buildStorageOnlyUnusedImages({
  storageObjectPathsByImageId,
  firestoreImageIds,
  referencedImageIds,
}) {
  const storageOnlyUnusedImages = [];

  for (const [imageId, objectPaths] of storageObjectPathsByImageId.entries()) {
    if (firestoreImageIds.has(imageId)) {
      continue;
    }
    if (referencedImageIds.has(imageId)) {
      continue;
    }

    storageOnlyUnusedImages.push({
      imageId,
      objectPaths,
    });
  }

  storageOnlyUnusedImages.sort((left, right) =>
    left.imageId.localeCompare(right.imageId, undefined, {
      numeric: true,
      sensitivity: 'base',
    }),
  );

  return storageOnlyUnusedImages;
}

async function processImageAggregate({
  db,
  gradeId,
  definition,
  aggregate,
  dryRun,
}) {
  const imageCollectionRef = db
    .collection('storageList')
    .doc(gradeId)
    .collection('images');
  const imageRef = imageCollectionRef.doc(aggregate.imageId);

  const snapshot = await imageRef.get();
  if (!snapshot.exists) {
    return {
      status: 'missing-image',
      references: aggregate.references,
    };
  }

  const currentData = isPlainObject(snapshot.data()) ? snapshot.data() : {};
  const evaluated = buildImagePatch(currentData, aggregate);
  const shardSuffix = toShardSuffix(aggregate.imageId, definition.shardCount);

  if (evaluated.changedKeys.length === 0) {
    return {
      status: 'unchanged',
      conflicts: evaluated.conflicts,
      shardSuffix,
    };
  }

  if (dryRun) {
    return {
      status: 'updated',
      changedKeys: evaluated.changedKeys,
      conflicts: evaluated.conflicts,
      shardSuffix,
    };
  }

  const now = admin.firestore.Timestamp.now();
  const indexDocId = buildIndexDocId(definition, shardSuffix);
  const indexRef = db.collection(definition.indexCollectionPath).doc(indexDocId);

  await db.runTransaction(async (tx) => {
    const indexSnapshot = await tx.get(indexRef);
    const indexData = indexSnapshot.exists && isPlainObject(indexSnapshot.data())
      ? indexSnapshot.data()
      : {};
    const currentItems =
      isPlainObject(indexData.items) ? { ...indexData.items } : {};

    tx.set(
      imageRef,
      {
        ...evaluated.patch,
        updatedAt: now,
      },
      { merge: true },
    );

    currentItems[aggregate.imageId] = {
      updatedAt: now,
      deleted: currentData.deleted === true,
    };

    tx.set(
      indexRef,
      {
        collectionPath: definition.collectionPath,
        shard: shardSuffix,
        updatedAt: now,
        items: currentItems,
      },
      { merge: true },
    );
  });

  return {
    status: 'updated',
    changedKeys: evaluated.changedKeys,
    conflicts: evaluated.conflicts,
    shardSuffix,
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

  if (!QUESTION_COLLECTIONS.has(args.gradeId)) {
    throw new Error('--grade must be firstGrade or secondGrade');
  }

  const imageCollectionPath = `storageList/${args.gradeId}/images`;
  const definition = getCollectionDefinition(imageCollectionPath);
  if (!definition) {
    throw new Error(`missing collection definition: ${imageCollectionPath}`);
  }

  const app = getAdminApp(args.projectId);
  const db = admin.firestore(app);
  const useEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

  log(
    `mode=${useEmulator ? 'emulator' : 'production'} project=${args.projectId || '(auto)'} grade=${args.gradeId} dryRun=${args.dryRun}`,
  );

  const loaded = await loadQuestionDocs(
    db,
    args.gradeId,
    args.docIds,
    args.pageSize,
  );
  const collected = collectReferencedImages(loaded.docs, args.gradeId);

  const report = {
    grade: args.gradeId,
    dryRun: args.dryRun,
    scannedQuestionCount: loaded.docs.length,
    requestedQuestionDocCount: loaded.requestedDocIds.length,
    missingQuestionDocCount: loaded.missingDocIds.length,
    missingQuestionDocIds: loaded.missingDocIds,
    referencedImageCount: collected.referencedImageIds.size,
    updatedImageCount: 0,
    unchangedImageCount: 0,
    invalidImageReferenceCount: collected.invalidReferences.length,
    missingImageReferenceCount: 0,
    storageOnlyImageReferenceCount: 0,
    failedImageCount: 0,
    metadataConflictImageCount: 0,
    cacheIndexUpdatedEntryCount: 0,
    cacheIndexTouchedShardCount: 0,
    invalidImageReferences: collected.invalidReferences,
    missingImageReferences: [],
    storageOnlyImageReferences: [],
    failedImages: [],
    conflictedImages: [],
    unusedImageIds: undefined,
    unusedImageCount: 0,
    storageOnlyUnusedImages: undefined,
    storageOnlyUnusedImageCount: 0,
    unusedImagesSkippedReason: undefined,
    storageOnlyUnusedImagesSkippedReason: undefined,
  };

  const touchedShards = new Set();

  for (const aggregate of collected.aggregates.values()) {
    try {
      const result = await processImageAggregate({
        db,
        gradeId: args.gradeId,
        definition,
        aggregate,
        dryRun: args.dryRun,
      });

      if (result.conflicts && result.conflicts.length > 0) {
        report.metadataConflictImageCount += 1;
        report.conflictedImages.push({
          imageId: aggregate.imageId,
          questionDocIds: [...aggregate.questionDocIds].sort(),
          questionNos: sortQuestionNos(aggregate.questionNos),
          conflicts: result.conflicts,
        });
      }

      if (result.status === 'missing-image') {
        report.missingImageReferenceCount += result.references.length;
        report.missingImageReferences.push(...result.references);
        continue;
      }

      if (result.status === 'unchanged') {
        report.unchangedImageCount += 1;
        continue;
      }

      if (result.status === 'updated') {
        report.updatedImageCount += 1;
        report.cacheIndexUpdatedEntryCount += 1;
        touchedShards.add(result.shardSuffix);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.failedImageCount += 1;
      report.failedImages.push({
        imageId: aggregate.imageId,
        questionDocIds: [...aggregate.questionDocIds].sort(),
        questionNos: sortQuestionNos(aggregate.questionNos),
        message,
      });
      console.error(
        '[sync-image-usage-metadata] image update failed',
        JSON.stringify({ imageId: aggregate.imageId, message }),
      );
    }
  }

  report.cacheIndexTouchedShardCount = touchedShards.size;

  const needsStorageScan =
    report.missingImageReferences.length > 0 ||
    (args.includeUnusedImages && args.docIds.length === 0);

  let storageObjectPathsByImageId;
  if (needsStorageScan) {
    storageObjectPathsByImageId = await listStorageObjectPathsByImageId({
      app,
      projectId: args.projectId,
      gradeId: args.gradeId,
    });
  }

  if (report.missingImageReferences.length > 0 && storageObjectPathsByImageId) {
    const split = splitMissingReferencesByStorage(
      report.missingImageReferences,
      storageObjectPathsByImageId,
    );
    report.missingImageReferences = split.missingImageReferences;
    report.missingImageReferenceCount = split.missingImageReferences.length;
    report.storageOnlyImageReferences = split.storageOnlyImageReferences;
    report.storageOnlyImageReferenceCount =
      split.storageOnlyImageReferences.length;
  }

  if (args.includeUnusedImages && args.docIds.length === 0) {
    const imageInventory = await listImageDocIdsAndUnusedImageIds(
      db,
      args.gradeId,
      collected.referencedImageIds,
      args.pageSize,
    );
    report.unusedImageIds = imageInventory.unusedImageIds;
    report.unusedImageCount = report.unusedImageIds.length;

    if (storageObjectPathsByImageId) {
      report.storageOnlyUnusedImages = buildStorageOnlyUnusedImages({
        storageObjectPathsByImageId,
        firestoreImageIds: imageInventory.firestoreImageIds,
        referencedImageIds: collected.referencedImageIds,
      });
      report.storageOnlyUnusedImageCount =
        report.storageOnlyUnusedImages.length;
    }
  } else if (args.includeUnusedImages) {
    report.unusedImagesSkippedReason =
      '--doc-id を指定した部分実行では grade 全体の未使用画像を判定できないため、unusedImageIds は出力しません';
    report.storageOnlyUnusedImagesSkippedReason =
      '--doc-id を指定した部分実行では grade 全体の Storage only 未使用画像を判定できないため、storageOnlyUnusedImages は出力しません';
  }

  let reportPath;
  if (args.reportOut) {
    reportPath = await writeReport(args.reportOut, report);
    log(`report written: ${reportPath}`);
  }

  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[sync-image-usage-metadata] fatal:', error);
    process.exit(1);
  });
}

module.exports = {
  buildImagePatch,
  collectReferencedImages,
  extractImageIdsFromHtml,
  isEmptyValue,
  isInvalidImageId,
  listStorageObjectPathsByImageId,
  main,
};