/** biome-ignore-all lint/style/useNodejsImportProtocol: backend utility script */

const fs = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline');

const admin = require('firebase-admin');

function parseArgs(argv) {
  const out = {
    projectId:
      process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '',
    gradeId: '',
    sourceDir: '',
    dryRun: false,
    yes: false,
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

    if (arg === '--source-dir') {
      out.sourceDir = argv[index + 1] || '';
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
    }
  }

  return out;
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/uploadMissingImages.cjs --project <id> --grade <firstGrade|secondGrade> --source-dir <path> [--dry-run] [--yes]

Options:
  --project <id>      Firebase project id
  --grade <id>        Upload target: firstGrade | secondGrade
  --source-dir <path> Local directory containing PNG files (top-level only)
  --dry-run           Show upload targets without uploading
  --yes               Skip confirmation prompt
  --help, -h          Show this help`);
}

function log(...args) {
  console.log('[upload-missing-images]', ...args);
}

async function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function ensureGradeId(gradeId) {
  if (gradeId !== 'firstGrade' && gradeId !== 'secondGrade') {
    throw new Error('--grade must be firstGrade or secondGrade');
  }
}

function initializeStorageApp(projectId) {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  if (!projectId) {
    throw new Error('--project is required');
  }

  const useStorageEmulator = Boolean(
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ||
      process.env.STORAGE_EMULATOR_HOST,
  );

  const options = {
    projectId,
    storageBucket: `${projectId}.firebasestorage.app`,
  };

  if (useStorageEmulator) {
    return admin.initializeApp(options);
  }

  return admin.initializeApp({
    ...options,
    credential: admin.credential.applicationDefault(),
  });
}

async function listLocalPngFiles(sourceDir) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    if (path.extname(entry.name).toLowerCase() !== '.png') {
      continue;
    }

    files.push({
      fileName: entry.name,
      localPath: path.join(sourceDir, entry.name),
    });
  }

  return files.sort((left, right) => left.fileName.localeCompare(right.fileName));
}

async function listRemoteObjectNames(bucket, prefix) {
  const [files] = await bucket.getFiles({ prefix });
  return new Set(files.map((file) => file.name).filter(Boolean));
}

function buildUploadTargets(localFiles, remoteObjectNames, gradeId) {
  return localFiles
    .map((file) => ({
      ...file,
      destination: `original/${gradeId}/${file.fileName}`,
    }))
    .filter((file) => !remoteObjectNames.has(file.destination));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  ensureGradeId(args.gradeId);

  if (!args.sourceDir) {
    throw new Error('--source-dir is required');
  }

  const sourceDir = path.resolve(args.sourceDir);
  const sourceStat = await fs.stat(sourceDir).catch(() => null);
  if (!sourceStat?.isDirectory()) {
    throw new Error(`source directory does not exist: ${sourceDir}`);
  }

  const app = initializeStorageApp(args.projectId);
  const bucket = admin.storage(app).bucket();
  const prefix = `original/${args.gradeId}/`;

  log('sourceDir =', sourceDir);
  log('bucket =', bucket.name);
  log('prefix =', prefix);

  const localFiles = await listLocalPngFiles(sourceDir);
  const remoteObjectNames = await listRemoteObjectNames(bucket, prefix);
  const uploadTargets = buildUploadTargets(
    localFiles,
    remoteObjectNames,
    args.gradeId,
  );

  log(`local png count = ${localFiles.length}`);
  log(`existing storage object count = ${remoteObjectNames.size}`);
  log(`upload target count = ${uploadTargets.length}`);

  if (uploadTargets.length === 0) {
    log('no missing images found');
    return;
  }

  for (const target of uploadTargets.slice(0, 20)) {
    log(`plan: ${target.localPath} -> ${target.destination}`);
  }
  if (uploadTargets.length > 20) {
    log(`... ${uploadTargets.length - 20} more`);
  }

  if (args.dryRun) {
    log('dry-run completed');
    return;
  }

  if (!args.yes) {
    const answer = await askQuestion(
      '不足画像のアップロードを開始します。よろしいですか？ (yes/no): ',
    );
    if (String(answer).trim().toLowerCase() !== 'yes') {
      log('cancelled');
      return;
    }
  }

  let successCount = 0;
  const failedTargets = [];

  for (const target of uploadTargets) {
    try {
      await bucket.upload(target.localPath, {
        destination: target.destination,
        metadata: {
          contentType: 'image/png',
        },
      });
      successCount += 1;
      log(`uploaded: ${target.destination}`);
    } catch (error) {
      failedTargets.push({
        destination: target.destination,
        message: error instanceof Error ? error.message : String(error),
      });
      console.error('[upload-missing-images] upload failed', {
        localPath: target.localPath,
        destination: target.destination,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  log(`upload completed success=${successCount} failed=${failedTargets.length}`);
  log(
    'Firestore の storageList / cacheIndex 反映は onStorageFinalize に依存します。Emulator では Functions も起動してください。',
  );

  if (failedTargets.length > 0) {
    console.log(JSON.stringify({ failedTargets }, null, 2));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[upload-missing-images] fatal:', error);
  process.exit(1);
});