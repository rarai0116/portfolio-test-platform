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
const { extractImageIdsFromHtml } = require('./syncImageUsageMetadata.cjs');

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

function log(...args) {
  console.log('[delete-unused-images]', ...args);
}

function parseArgs(argv) {
  const out = {
    projectId:
      process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '',
    gradeId: '',
    reportIn: '',
    reportOut: '',
    pageSize: 500,
    imageIds: [],
    dryRun: false,
    force: false,
    yes: false,
    verifyCurrentUnused: true,
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

    if (arg === '--report-in') {
      out.reportIn = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--report-out') {
      out.reportOut = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--image-id') {
      const value = argv[index + 1] || '';
      if (value) {
        out.imageIds.push(value);
      }
      index += 1;
      continue;
    }

    if (arg === '--image-ids') {
      const value = argv[index + 1] || '';
      if (value) {
        out.imageIds.push(...value.split(','));
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

    if (arg === '--dry-run') {
      out.dryRun = true;
      continue;
    }

    if (arg === '--force') {
      out.force = true;
      continue;
    }

    if (arg === '--yes') {
      out.yes = true;
      continue;
    }

    if (arg === '--no-verify-current-unused') {
      out.verifyCurrentUnused = false;
      continue;
    }

    if (arg === '--verify-current-unused') {
      out.verifyCurrentUnused = true;
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
  node ./scripts/deleteUnusedImages.cjs --project <id> --grade <firstGrade|secondGrade> [--report-in <path>] [--image-id <id>] [--report-out <path>] [--dry-run] [--force] [--yes]

Options:
  --project <id>                   Firebase project id
  --grade <id>                    Target grade: firstGrade | secondGrade
  --report-in <path>              syncImageUsageMetadata の JSON report を入力として使う
  --image-id <id>                 Additional image id to delete. Repeatable
  --image-ids <a,b,c>             Additional image ids as comma separated list
  --page-size <number>            Page size when verifying current question references. Default: 500
  --report-out <path>             Write JSON report to the specified path
  --dry-run                       Analyze without deleting Firestore or Storage
  --force                         usedIds が残っていても削除を継続する
  --yes                           Skip confirmation prompt
  --no-verify-current-unused      Disable question scan that verifies the target is still unused
  --verify-current-unused         Enable verification scan explicitly
  --help, -h                      Show this help`);
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueStrings(value.filter((item) => typeof item === 'string'));
}

async function loadDeleteReport(reportIn) {
  const absolutePath = path.resolve(reportIn);
  const text = await fs.readFile(absolutePath, 'utf8');
  const parsed = JSON.parse(text);

  if (!isPlainObject(parsed)) {
    throw new Error('report-in must be a JSON object');
  }

  return {
    absolutePath,
    report: parsed,
  };
}

function buildCandidates({ report, explicitImageIds }) {
  const sourcesByImageId = new Map();

  const addSource = (imageId, source) => {
    const current = sourcesByImageId.get(imageId) ?? new Set();
    current.add(source);
    sourcesByImageId.set(imageId, current);
  };

  const reportUnusedImageIds = Array.isArray(report?.unusedImageIds)
    ? report.unusedImageIds.filter((value) => typeof value === 'string')
    : [];

  for (const imageId of reportUnusedImageIds) {
    addSource(imageId, 'report');
  }

  for (const imageId of explicitImageIds) {
    addSource(imageId, 'explicit');
  }

  return {
    imageIds: [...sourcesByImageId.keys()].sort((left, right) =>
      left.localeCompare(right, undefined, {
        numeric: true,
        sensitivity: 'base',
      }),
    ),
    sourcesByImageId,
    reportUnusedImageIds: uniqueStrings(reportUnusedImageIds),
  };
}

async function confirmProceed({ candidateCount, gradeId, force }) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(
      `${gradeId} の画像 ${candidateCount} 件を削除対象として処理します${force ? '（force 有効）' : ''}。続行しますか？ [y/N] `,
    );
    return /^y(?:es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

async function scanCurrentQuestionReferences({
  db,
  gradeId,
  targetImageIds,
  pageSize,
}) {
  const targetSet = new Set(targetImageIds);
  const referencesByImageId = new Map();
  let scannedQuestionCount = 0;

  let lastDocId = null;

  while (true) {
    let query = db.collection(gradeId).orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize);
    if (lastDocId !== null) {
      query = query.startAfter(lastDocId);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      break;
    }

    scannedQuestionCount += snapshot.docs.length;

    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      if (!isPlainObject(data)) {
        continue;
      }

      const matchedImageIds = new Set();
      for (const field of HTML_FIELDS) {
        for (const imageId of extractImageIdsFromHtml(data[field])) {
          if (targetSet.has(imageId)) {
            matchedImageIds.add(imageId);
          }
        }
      }

      if (matchedImageIds.size === 0) {
        continue;
      }

      const questionNo = typeof data.no === 'number' ? data.no : null;
      for (const imageId of matchedImageIds) {
        const current = referencesByImageId.get(imageId) ?? [];
        current.push({
          questionDocId: docSnapshot.id,
          questionNo,
        });
        referencesByImageId.set(imageId, current);
      }
    }

    lastDocId = snapshot.docs.at(-1)?.id ?? null;
    if (snapshot.size < pageSize) {
      break;
    }
  }

  for (const references of referencesByImageId.values()) {
    references.sort((left, right) => {
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
    });
  }

  return {
    referencesByImageId,
    scannedQuestionCount,
  };
}

async function checkStorageObjectExists(file) {
  const [exists] = await file.exists();
  return exists;
}

async function markFirestoreDeleted({ db, definition, gradeId, imageId }) {
  const imageRef = db.collection('storageList').doc(gradeId).collection('images').doc(imageId);
  const snapshot = await imageRef.get();

  if (!snapshot.exists) {
    return {
      status: 'missing',
      objectPath: `original/${gradeId}/${imageId}.png`,
      usedIds: [],
    };
  }

  const currentData = isPlainObject(snapshot.data()) ? snapshot.data() : {};
  const objectPath =
    typeof currentData.objectPath === 'string' && currentData.objectPath.trim().length > 0
      ? currentData.objectPath.trim()
      : `original/${gradeId}/${imageId}.png`;
  const usedIds = normalizeStringArray(currentData.usedIds);
  const shardSuffix = toShardSuffix(imageId, definition.shardCount);
  const indexDocId = buildIndexDocId(definition, shardSuffix);
  const indexRef = db.collection(definition.indexCollectionPath).doc(indexDocId);

  const outcome = await db.runTransaction(async (tx) => {
    const indexSnapshot = await tx.get(indexRef);
    const indexData = indexSnapshot.exists && isPlainObject(indexSnapshot.data())
      ? indexSnapshot.data()
      : {};
    const currentItems = isPlainObject(indexData.items) ? { ...indexData.items } : {};
    const currentItem = isPlainObject(currentItems[imageId]) ? currentItems[imageId] : {};
    const needsDocWrite = currentData.deleted !== true;
    const needsIndexWrite = currentItem.deleted !== true;

    if (!needsDocWrite && !needsIndexWrite) {
      return 'already-deleted';
    }

    const now = admin.firestore.Timestamp.now();

    tx.set(
      imageRef,
      {
        deleted: true,
        updatedAt: now,
      },
      { merge: true },
    );

    currentItems[imageId] = {
      updatedAt: now,
      deleted: true,
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

    return 'deleted';
  });

  return {
    status: outcome,
    objectPath,
    usedIds,
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
    return { exitCode: 0 };
  }

  let reportInput;
  if (args.reportIn) {
    reportInput = await loadDeleteReport(args.reportIn);
  }

  const reportGradeId =
    reportInput && typeof reportInput.report.grade === 'string'
      ? reportInput.report.grade
      : '';
  const gradeId = args.gradeId || reportGradeId;

  if (!QUESTION_COLLECTIONS.has(gradeId)) {
    throw new Error('--grade must be firstGrade or secondGrade');
  }

  if (args.gradeId && reportGradeId && args.gradeId !== reportGradeId) {
    throw new Error('--grade and report-in grade do not match');
  }

  const explicitImageIds = uniqueStrings(args.imageIds);
  const candidateInfo = buildCandidates({
    report: reportInput?.report,
    explicitImageIds,
  });

  if (candidateInfo.imageIds.length === 0) {
    throw new Error('削除対象がありません。--report-in または --image-id を指定してください');
  }

  const imageCollectionPath = `storageList/${gradeId}/images`;
  const definition = getCollectionDefinition(imageCollectionPath);
  if (!definition) {
    throw new Error(`missing collection definition: ${imageCollectionPath}`);
  }

  const app = getAdminApp(args.projectId);
  const db = admin.firestore(app);
  const bucket = admin.storage(app).bucket(`${app.options.projectId || args.projectId}.firebasestorage.app`);
  const useEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

  log(
    `mode=${useEmulator ? 'emulator' : 'production'} project=${args.projectId || '(auto)'} grade=${gradeId} dryRun=${args.dryRun} force=${args.force} verifyCurrentUnused=${args.verifyCurrentUnused}`,
  );

  if (!args.dryRun && !args.yes) {
    const confirmed = await confirmProceed({
      candidateCount: candidateInfo.imageIds.length,
      gradeId,
      force: args.force,
    });
    if (!confirmed) {
      throw new Error('ユーザー確認により中断しました');
    }
  }

  const verificationResult = args.verifyCurrentUnused
    ? await scanCurrentQuestionReferences({
        db,
        gradeId,
        targetImageIds: candidateInfo.imageIds,
        pageSize: args.pageSize,
      })
    : {
        referencesByImageId: new Map(),
        scannedQuestionCount: 0,
      };

  const report = {
    grade: gradeId,
    dryRun: args.dryRun,
    force: args.force,
    verifyCurrentUnused: args.verifyCurrentUnused,
    reportIn: reportInput?.absolutePath,
    scannedQuestionCount: verificationResult.scannedQuestionCount,
    candidateImageCount: candidateInfo.imageIds.length,
    reportUnusedImageCount: candidateInfo.reportUnusedImageIds.length,
    explicitImageCount: explicitImageIds.length,
    skippedReferencedImageCount: 0,
    skippedUsedIdsImageCount: 0,
    firestoreDeletedCount: 0,
    firestoreAlreadyDeletedCount: 0,
    firestoreMissingCount: 0,
    storageDeletedCount: 0,
    storageMissingCount: 0,
    deletedImageCount: 0,
    failedImageCount: 0,
    partialSuccessCount: 0,
    skippedImages: [],
    deletedImages: [],
    failedImages: [],
  };

  for (const imageId of candidateInfo.imageIds) {
    const sources = [...(candidateInfo.sourcesByImageId.get(imageId) ?? new Set())].sort();
    const currentReferences = verificationResult.referencesByImageId.get(imageId) ?? [];

    if (currentReferences.length > 0) {
      report.skippedReferencedImageCount += 1;
      report.skippedImages.push({
        imageId,
        sources,
        reason: 'currently-referenced',
        questionDocIds: currentReferences.map((item) => item.questionDocId),
        questionNos: currentReferences
          .map((item) => item.questionNo)
          .filter((value) => typeof value === 'number'),
      });
      continue;
    }

    let firestoreStatus = 'missing';
    let storageStatus = 'missing';
    let objectPath = `original/${gradeId}/${imageId}.png`;

    try {
      const imageRef = db.collection('storageList').doc(gradeId).collection('images').doc(imageId);
      const snapshot = await imageRef.get();
      const currentData = snapshot.exists && isPlainObject(snapshot.data()) ? snapshot.data() : {};
      const usedIds = normalizeStringArray(currentData.usedIds);
      objectPath =
        snapshot.exists && typeof currentData.objectPath === 'string' && currentData.objectPath.trim().length > 0
          ? currentData.objectPath.trim()
          : `original/${gradeId}/${imageId}.png`;

      if (!args.force && usedIds.length > 0) {
        report.skippedUsedIdsImageCount += 1;
        report.skippedImages.push({
          imageId,
          sources,
          reason: 'used-ids-present',
          usedIds,
        });
        continue;
      }

      const storageFile = bucket.file(objectPath);
      const storageExists = await checkStorageObjectExists(storageFile);

      if (args.dryRun) {
        if (snapshot.exists) {
          firestoreStatus = currentData.deleted === true ? 'already-deleted' : 'would-delete';
        }
      } else {
        const firestoreResult = await markFirestoreDeleted({
          db,
          definition,
          gradeId,
          imageId,
        });
        firestoreStatus = firestoreResult.status;
      }

      if (storageExists) {
        if (args.dryRun) {
          storageStatus = 'would-delete';
        } else {
          await storageFile.delete();
          storageStatus = 'deleted';
        }
      }

      if (firestoreStatus === 'deleted') {
        report.firestoreDeletedCount += 1;
      } else if (firestoreStatus === 'already-deleted') {
        report.firestoreAlreadyDeletedCount += 1;
      } else {
        report.firestoreMissingCount += 1;
      }

      if (storageStatus === 'deleted' || storageStatus === 'would-delete') {
        report.storageDeletedCount += 1;
      } else {
        report.storageMissingCount += 1;
      }

      report.deletedImageCount += 1;
      report.deletedImages.push({
        imageId,
        sources,
        firestoreStatus,
        storageStatus,
        objectPath,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const partialSuccess =
        firestoreStatus === 'deleted' ||
        firestoreStatus === 'already-deleted' ||
        storageStatus === 'deleted';
      const failure = {
        imageId,
        sources,
        partialSuccess,
        firestoreStatus,
        storageStatus,
        objectPath,
        message,
      };
      report.failedImageCount += 1;
      if (partialSuccess) {
        report.partialSuccessCount += 1;
      }
      report.failedImages.push(failure);
      console.error('[delete-unused-images] image delete failed', JSON.stringify(failure));
    }
  }

  let reportPath;
  if (args.reportOut) {
    reportPath = await writeReport(args.reportOut, report);
    log(`report written: ${reportPath}`);
  }

  console.log(JSON.stringify(report, null, 2));

  return {
    exitCode: report.failedImageCount > 0 ? 2 : 0,
    report,
    reportPath,
  };
}

if (require.main === module) {
  main()
    .then((result) => {
      process.exitCode = result?.exitCode ?? 0;
    })
    .catch((error) => {
      console.error('[delete-unused-images] fatal:', error);
      process.exit(1);
    });
}

module.exports = {
  buildCandidates,
  main,
  scanCurrentQuestionReferences,
};