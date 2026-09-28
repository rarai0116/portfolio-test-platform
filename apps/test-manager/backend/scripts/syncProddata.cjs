/* sync prod data to emulator export format */
/* このスクリプトはローカルの _data ディレクトリに本番データを保存します。実行前に必ずバックアップを取ってください。 */

const fs = require('fs/promises');
const fssync = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

const backendDir = path.resolve(__dirname, '..');
const dataDir = path.join(backendDir, '_data');
const tmpDir = path.join(backendDir, '_tmp', 'prod_sync');
const storageSyncPrefix = 'original';

const log = (...args) => console.log('[sync-prod-data]', ...args);

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function safeRmDir(dir) {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (e) {
    log(`warn: remove failed for ${dir}:`, e.message);
  }
}

async function safeRenameOrCopy(src, dest) {
  try {
    await fs.rename(src, dest);
    return;
  } catch (e) {
    if (e && (e.code === 'EXDEV' || e.code === 'EPERM' || e.code === 'EACCES')) {
      await fs.cp(src, dest, { recursive: true });
      await safeRmDir(src);
      return;
    }
    throw e;
  }
}

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      cwd: options.cwd || process.cwd(),
      shell: process.platform === 'win32',
    });
    child.on('exit', (code) => resolve({ code }));
    child.on('error', reject);
  });
}

function runCapture(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: options.cwd || process.cwd(),
      shell: process.platform === 'win32',
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString('utf8')));
    child.stderr.on('data', (d) => (stderr += d.toString('utf8')));

    child.on('exit', (code) => resolve({ code, stdout, stderr }));
    child.on('error', reject);
  });
}

async function promptYesNo(question) {
  return new Promise((resolve) => {
    process.stdout.write(`${question} [y/N]: `);
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (data) => {
      const v = (data || '').trim().toLowerCase();
      process.stdin.pause();
      resolve(v === 'y' || v === 'yes');
    });
  });
}

function parseArgs(argv) {
  let projectId = '';
  const buckets = [];
  let firestoreExportUri = '';
  let yes = false;
  let dryRun = false;
  let forceExportClean = false;
  let refreshFirestoreExport = false;
  let skipStorageDownload = false;
  let firestoreOnly = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project') {
      projectId = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--bucket') {
      const v = argv[i + 1] || '';
      if (v) buckets.push(v);
      i += 1;
      continue;
    }
    if (arg === '--buckets') {
      const v = argv[i + 1] || '';
      v.split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => buckets.push(s));
      i += 1;
      continue;
    }
    if (arg === '--firestore-export-uri') {
      firestoreExportUri = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--yes') {
      yes = true;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--force-export-clean') {
      forceExportClean = true;
      continue;
    }
    if (arg === '--refresh-firestore-export') {
      refreshFirestoreExport = true;
      continue;
    }
    if (arg === '--skip-storage-download') {
      skipStorageDownload = true;
      continue;
    }
    if (arg === '--firestore-only') {
      firestoreOnly = true;
      continue;
    }
  }

  const normalizedBuckets = buckets
    .map((value) => {
      const v = value.trim();
      if (!v) return '';
      if (!v.startsWith('gs://')) return v;
      const withoutScheme = v.slice('gs://'.length);
      return withoutScheme.split('/')[0] || '';
    })
    .filter(Boolean);

  return {
    projectId,
    buckets: Array.from(new Set(normalizedBuckets)),
    firestoreExportUri,
    yes,
    dryRun,
    forceExportClean,
    refreshFirestoreExport,
    skipStorageDownload,
    firestoreOnly,
  };
}

function stripUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function isMissing(value) {
  return value === undefined || value === null || value === '';
}

function parseGcloudListJson(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fallthrough
  }
  throw new Error('gcloud list json parse failed');
}

function crc32cBase64ToDecimalString(base64) {
  if (!base64) return undefined;
  const buf = Buffer.from(base64, 'base64');
  if (buf.length !== 4) return undefined;
  return String(buf.readUInt32BE(0));
}

function makeCrc32cTable() {
  const table = new Uint32Array(256);
  const poly = 0x1edc6f41;
  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let j = 0; j < 8; j += 1) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ poly;
      } else {
        crc >>>= 1;
      }
    }
    table[i] = crc >>> 0;
  }
  return table;
}

const CRC32C_TABLE = makeCrc32cTable();

function updateCrc32c(crc, buf) {
  let c = crc ^ 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    const byte = buf[i];
    c = CRC32C_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return c ^ 0xffffffff;
}

async function computeHashes(filePath) {
  return new Promise((resolve, reject) => {
    const md5 = crypto.createHash('md5');
    let crc = 0;

    const stream = fssync.createReadStream(filePath);
    stream.on('data', (chunk) => {
      md5.update(chunk);
      crc = updateCrc32c(crc, chunk);
    });
    stream.on('error', reject);
    stream.on('end', () => {
      resolve({
        md5Hash: md5.digest('base64'),
        crc32c: String(crc >>> 0),
      });
    });
  });
}

function normalizeFirestoreExportUri(rawUri, ts, refresh = false) {
  if (!rawUri) return '';
  const trimmed = rawUri.trim();
  if (!trimmed.startsWith('gs://')) return '';
  if (trimmed === 'gs://') return '';
  const normalized = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
  const rest = normalized.slice('gs://'.length);
  if (!rest) return '';
  if (!rest.includes('/')) {
    const baseUri = `${normalized}/firestore_export`;
    return refresh ? `${baseUri}_${ts}` : baseUri;
  }
  return refresh ? `${normalized}_${ts}` : normalized;
}

function buildStorageMetadata(meta, objectPath, bucket) {
  const custom = { ...(meta.metadata || {}) };
  const tokenRaw = custom.firebaseStorageDownloadTokens || '';
  if (tokenRaw) {
    delete custom.firebaseStorageDownloadTokens;
  }

  const tokens = tokenRaw
    ? tokenRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : [crypto.randomUUID()];

  return stripUndefined({
    name: objectPath,
    bucket,
    metageneration: Number(meta.metageneration),
    generation: Number(meta.generation),
    contentType: meta.contentType,
    storageClass: meta.storageClass,
    contentDisposition: meta.contentDisposition,
    downloadTokens: tokens,
    etag: meta.etag,
    customMetadata: custom,
    timeCreated: meta.timeCreated,
    updated: meta.updated,
    size: Number(meta.size),
    md5Hash: meta.md5Hash,
    crc32c: crc32cBase64ToDecimalString(meta.crc32c),
  });
}

function normalizeObjectPath(name, bucket) {
  if (!name) return '';
  const text = String(name);
  if (text.startsWith('gs://')) {
    const prefix = `gs://${bucket}/`;
    if (text.startsWith(prefix)) return text.slice(prefix.length);
    return text.slice('gs://'.length).split('/').slice(1).join('/');
  }
  return text;
}

function buildStorageObjectKey(bucket, objectPath) {
  return `${bucket}\n${objectPath}`;
}

function buildStorageSyncUri(bucket) {
  return `gs://${bucket}/${storageSyncPrefix}`;
}

function buildStorageSyncListUri(bucket) {
  return `${buildStorageSyncUri(bucket)}/**`;
}

async function normalizeFirestoreOverallMetadataFile(dir) {
  const entries = await fs.readdir(dir);
  const metadataFiles = entries.filter((name) => name.endsWith('.overall_export_metadata'));

  if (metadataFiles.length === 0) {
    throw new Error(`overall export metadata file not found in ${dir}`);
  }

  const canonicalName = 'firestore_export.overall_export_metadata';
  const canonicalPath = path.join(dir, canonicalName);
  const sourceName = metadataFiles.includes(canonicalName) ? canonicalName : metadataFiles[0];
  const sourcePath = path.join(dir, sourceName);

  if (sourceName !== canonicalName) {
    await safeRmFile(canonicalPath);
    await fs.copyFile(sourcePath, canonicalPath);
    await safeRmFile(sourcePath);
  }

  for (const fileName of metadataFiles) {
    if (fileName === canonicalName || fileName === sourceName) continue;
    await safeRmFile(path.join(dir, fileName));
  }
}

async function readJsonFile(filePath) {
  const text = await fs.readFile(filePath, 'utf8');
  return JSON.parse(text);
}

async function safeRmFile(filePath) {
  try {
    await fs.rm(filePath, { force: true });
  } catch (e) {
    log(`warn: remove failed for ${filePath}:`, e.message);
  }
}

async function loadExistingStorageEntryIndex(metadataDir, blobsDir) {
  const index = new Map();
  if (!(await exists(metadataDir))) {
    return index;
  }

  const files = await fs.readdir(metadataDir);
  for (const fileName of files) {
    if (!fileName.endsWith('.json')) continue;

    const uuid = path.basename(fileName, '.json');
    const metaPath = path.join(metadataDir, fileName);
    try {
      const metadata = await readJsonFile(metaPath);
      if (!metadata || !metadata.bucket || !metadata.name) continue;
      index.set(buildStorageObjectKey(metadata.bucket, metadata.name), {
        uuid,
        metadata,
        metaPath,
        blobPath: path.join(blobsDir, uuid),
      });
    } catch (e) {
      log(`warn: failed to read existing storage metadata: ${metaPath}:`, e.message);
    }
  }

  return index;
}

function areJsonEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isStorageEntryChanged(existingEntry, mapped, blobExists) {
  if (!existingEntry || !blobExists) {
    return true;
  }

  const current = existingEntry.metadata || {};
  const comparableKeys = [
    'name',
    'bucket',
    'metageneration',
    'generation',
    'contentType',
    'storageClass',
    'contentDisposition',
    'downloadTokens',
    'etag',
    'customMetadata',
    'timeCreated',
    'updated',
    'size',
    'md5Hash',
    'crc32c',
  ];

  for (const key of comparableKeys) {
    if (!areJsonEqual(current[key], mapped[key])) {
      return true;
    }
  }

  return false;
}

async function buildDryRunSummary({
  buckets,
  comparisonStorageMetadataDir,
  comparisonStorageBlobsDir,
  firestoreOnly,
  forceExportClean,
  refreshFirestoreExport,
  firestoreExportUri,
  projectId,
  skipStorageDownload,
  ts,
}) {
  const summary = {
    mode: 'dry-run',
    firestore: {
      projectId,
      exportUri: '',
      action: 'reuse-existing-export',
      willReplaceLocalImport: true,
    },
    storage: firestoreOnly
      ? {
          skipped: true,
          reason: 'firestore-only',
        }
      : {
          skipped: false,
          forceRebuild: forceExportClean,
          skipStorageDownloadRequested: skipStorageDownload,
          buckets: [],
          totalRemoteObjectCount: 0,
          addCount: 0,
          updateCount: 0,
          deleteCount: 0,
          unchangedCount: 0,
        },
  };

  const exportUri = normalizeFirestoreExportUri(firestoreExportUri, ts, refreshFirestoreExport);
  if (!exportUri) {
    throw new Error('invalid --firestore-export-uri (must be gs://bucket/path)');
  }
  summary.firestore.exportUri = exportUri;

  const { code: existsCode } = refreshFirestoreExport ? { code: 1 } : await runCapture('gsutil', ['ls', exportUri]);
  if (forceExportClean) {
    summary.firestore.action = 'clean-and-export';
  } else if (refreshFirestoreExport) {
    summary.firestore.action = 'export-new';
  } else if (existsCode === 0) {
    summary.firestore.action = 'reuse-existing-export';
  } else {
    summary.firestore.action = 'export-missing-path';
  }

  if (firestoreOnly) {
    return summary;
  }

  const existingStorageEntries = await loadExistingStorageEntryIndex(
    comparisonStorageMetadataDir,
    comparisonStorageBlobsDir,
  );

  for (const bucket of buckets) {
    const { code, stdout, stderr } = await runCapture('gcloud', [
      'storage',
      'objects',
      'list',
      buildStorageSyncListUri(bucket),
      '--format=json',
    ]);
    if (code !== 0) {
      throw new Error(stderr || `gcloud storage objects list failed for ${bucket}`);
    }

    const bucketSummary = {
      bucket,
      remoteObjectCount: 0,
      addCount: 0,
      updateCount: 0,
      deleteCount: 0,
      unchangedCount: 0,
    };

    const objects = parseGcloudListJson(stdout)
      .filter((item) => item && item.name)
      .filter((item) => !String(item.name || '').endsWith('/'));

    bucketSummary.remoteObjectCount = objects.length;
    summary.storage.totalRemoteObjectCount += objects.length;

    for (const meta of objects) {
      const objectPath = normalizeObjectPath(meta.name, bucket);
      if (!objectPath) continue;

      const storageKey = buildStorageObjectKey(bucket, objectPath);
      const existingEntry = existingStorageEntries.get(storageKey);
      const blobExists = existingEntry ? await exists(existingEntry.blobPath) : false;

      const mapped = buildStorageMetadata(meta, objectPath, bucket);
      if (
        existingEntry
        && !meta.metadata?.firebaseStorageDownloadTokens
        && Array.isArray(existingEntry.metadata?.downloadTokens)
        && existingEntry.metadata.downloadTokens.length > 0
      ) {
        mapped.downloadTokens = existingEntry.metadata.downloadTokens;
      }

      if (!existingEntry) {
        bucketSummary.addCount += 1;
        summary.storage.addCount += 1;
      } else if (isStorageEntryChanged(existingEntry, mapped, blobExists)) {
        bucketSummary.updateCount += 1;
        summary.storage.updateCount += 1;
      } else {
        bucketSummary.unchangedCount += 1;
        summary.storage.unchangedCount += 1;
      }

      existingStorageEntries.delete(storageKey);
    }

    summary.storage.buckets.push(bucketSummary);
  }

  for (const entry of existingStorageEntries.values()) {
    const bucketSummary = summary.storage.buckets.find((item) => item.bucket === entry.metadata?.bucket);
    if (bucketSummary) {
      bucketSummary.deleteCount += 1;
    }
    summary.storage.deleteCount += 1;
  }

  return summary;
}

async function main() {
  const {
    projectId,
    buckets,
    firestoreExportUri,
    yes,
    dryRun,
    forceExportClean,
    refreshFirestoreExport,
    skipStorageDownload,
    firestoreOnly,
  } = parseArgs(process.argv.slice(2));
  if (!projectId || buckets.length === 0 || !firestoreExportUri) {
    console.log('usage: node <script> --project <id> --buckets <bucket1,bucket2> --firestore-export-uri <gs://bucket/path> [--yes] [--dry-run] [--force-export-clean] [--refresh-firestore-export] [--skip-storage-download] [--firestore-only]');
    process.exit(2);
  }

  if (!dryRun && !yes) {
    const ok = await promptYesNo('本番データを取得してローカルに保存します。実行しますか？');
    if (!ok) process.exit(0);
  }
  

  const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
  const backupDir = path.join(backendDir, `_data_${ts}`);
  const firestoreExportDir = path.join(tmpDir, 'firestore_export');
  const storageExportDir = path.join(tmpDir, 'storage_export');
  const storageMetadataDir = path.join(storageExportDir, 'metadata');
  const storageBlobsDir = path.join(storageExportDir, 'blobs');
  const storageMirrorRoot = path.join(tmpDir, 'storage_mirror');
  const fullStorageRebuild = forceExportClean;
  const storageTargetDir = path.join(dataDir, 'storage_export');
  const activeStorageExportDir = fullStorageRebuild ? storageExportDir : storageTargetDir;
  const activeStorageMetadataDir = path.join(activeStorageExportDir, 'metadata');
  const activeStorageBlobsDir = path.join(activeStorageExportDir, 'blobs');
  const firestoreTargetDir = path.join(dataDir, 'firestore_export');
  const exportMetaPath = path.join(dataDir, 'firebase-export-metadata.json');
  const backupMetaPath = path.join(backupDir, 'firebase-export-metadata.json');
  const comparisonStorageMetadataDir = path.join(storageTargetDir, 'metadata');
  const comparisonStorageBlobsDir = path.join(storageTargetDir, 'blobs');

  if (dryRun) {
    const summary = await buildDryRunSummary({
      buckets,
      comparisonStorageMetadataDir,
      comparisonStorageBlobsDir,
      firestoreOnly,
      forceExportClean,
      refreshFirestoreExport,
      firestoreExportUri,
      projectId,
      skipStorageDownload,
      ts,
    });
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  }

  log('step: prepare temp');
  await fs.mkdir(tmpDir, { recursive: true });
  await safeRmDir(firestoreExportDir);
  if (fullStorageRebuild) {
    await safeRmDir(storageExportDir);
  }
  if (!skipStorageDownload && fullStorageRebuild) {
    await safeRmDir(storageMirrorRoot);
  }

  log('step: firestore export');
  {
    const exportUri = normalizeFirestoreExportUri(firestoreExportUri, ts, refreshFirestoreExport);
    if (!exportUri) {
      console.error('invalid --firestore-export-uri (must be gs://bucket/path)');
      process.exit(2);
    }

    const { code: existsCode } = refreshFirestoreExport ? { code: 1 } : await runCapture('gsutil', ['ls', exportUri]);

    if (existsCode === 0 && forceExportClean) {
      log('step: remove existing firestore export path');
      const { code: rmCode } = await run('gsutil', ['-m', 'rm', '-r', exportUri]);
      if (rmCode !== 0) process.exit(rmCode);
    }

    if (refreshFirestoreExport || existsCode !== 0 || forceExportClean) {
      const { code } = await run('gcloud', ['firestore', 'export', exportUri, '--project', projectId]);
      if (code !== 0) process.exit(code);
    } else {
      log('step: reuse existing firestore export path');
    }

    await fs.mkdir(firestoreExportDir, { recursive: true });
    const { code: pullCode } = await run('gsutil', ['-m', 'rsync', '-r', exportUri, firestoreExportDir]);
    if (pullCode !== 0) process.exit(pullCode);
    await normalizeFirestoreOverallMetadataFile(firestoreExportDir);
  }

  if (!firestoreOnly) {
    log('step: storage export');
    await fs.mkdir(activeStorageExportDir, { recursive: true });
    await fs.mkdir(activeStorageMetadataDir, { recursive: true });
    await fs.mkdir(activeStorageBlobsDir, { recursive: true });

    const existingStorageEntries = fullStorageRebuild
      ? new Map()
      : await loadExistingStorageEntryIndex(activeStorageMetadataDir, activeStorageBlobsDir);

    for (const bucket of buckets) {
      const mirrorDir = path.join(storageMirrorRoot, bucket);
      const mirrorSyncDir = path.join(mirrorDir, storageSyncPrefix);
      log(`bucket: ${bucket}`);

      if (skipStorageDownload) {
        if (!(await exists(mirrorSyncDir))) {
          console.error(`storage mirror not found: ${mirrorSyncDir}`);
          process.exit(2);
        }
      } else {
        await fs.mkdir(mirrorSyncDir, { recursive: true });
        const syncArgs = ['-m', 'rsync', '-r'];
        if (!fullStorageRebuild) {
          syncArgs.push('-d');
        }
        syncArgs.push(buildStorageSyncUri(bucket), mirrorSyncDir);
        const { code: syncCode } = await run('gsutil', syncArgs);
        if (syncCode !== 0) process.exit(syncCode);
      }

      const { code, stdout, stderr } = await runCapture('gcloud', [
        'storage',
        'objects',
        'list',
        buildStorageSyncListUri(bucket),
        '--format=json',
      ]);
      if (code !== 0) {
        console.error(stderr);
        process.exit(code);
      }

      const objects = parseGcloudListJson(stdout)
        .filter((item) => item && item.name)
        .filter((item) => !String(item.name || '').endsWith('/'));
      for (let i = 0; i < objects.length; i += 1) {
        const meta = objects[i];
        const objectPath = normalizeObjectPath(meta.name, bucket);
        if (!objectPath) continue;

        if (i % 200 === 0) {
          log(`metadata: ${i + 1}/${objects.length}`);
        }

        const storageKey = buildStorageObjectKey(bucket, objectPath);
        const existingEntry = existingStorageEntries.get(storageKey);
        const uuid = existingEntry ? existingEntry.uuid : crypto.randomUUID();
        const srcPath = path.join(mirrorDir, objectPath);
        const blobPath = path.join(activeStorageBlobsDir, uuid);
        const metaPath = path.join(activeStorageMetadataDir, `${uuid}.json`);

        let stats;
        try {
          stats = await fs.stat(srcPath);
        } catch {
          log(`warn: missing source file: ${srcPath}`);
          continue;
        }
        if (!stats.isFile()) {
          continue;
        }

        const mapped = buildStorageMetadata(meta, objectPath, bucket);
        if (
          existingEntry
          && !meta.metadata?.firebaseStorageDownloadTokens
          && Array.isArray(existingEntry.metadata?.downloadTokens)
          && existingEntry.metadata.downloadTokens.length > 0
        ) {
          mapped.downloadTokens = existingEntry.metadata.downloadTokens;
        }
        const needSize = isMissing(mapped.size);
        const needMd5 = isMissing(mapped.md5Hash);
        const needCrc = isMissing(mapped.crc32c);
        if (needSize) {
          mapped.size = stats.size;
        }
        if (needMd5 || needCrc) {
          const hashes = await computeHashes(srcPath);
          if (needMd5) mapped.md5Hash = hashes.md5Hash;
          if (needCrc) mapped.crc32c = hashes.crc32c;
        }
        await fs.copyFile(srcPath, blobPath);
        await fs.writeFile(metaPath, JSON.stringify(mapped, null, 2), 'utf8');
        existingStorageEntries.delete(storageKey);
      }
    }

    if (!fullStorageRebuild) {
      for (const entry of existingStorageEntries.values()) {
        await safeRmFile(entry.metaPath);
        await safeRmFile(entry.blobPath);
      }
    }

    const bucketsJsonPath = path.join(activeStorageExportDir, 'buckets.json');
    const bucketsJson = { buckets: buckets.map((id) => ({ id })) };
    await fs.writeFile(bucketsJsonPath, JSON.stringify(bucketsJson, null, 2), 'utf8');
  }

  log('step: backup replaced data');
  let backupCreated = false;
  if (await exists(firestoreTargetDir)) {
    await fs.mkdir(backupDir, { recursive: true });
    await safeRenameOrCopy(firestoreTargetDir, path.join(backupDir, 'firestore_export'));
    backupCreated = true;
  }
  if (fullStorageRebuild && !firestoreOnly && (await exists(storageTargetDir))) {
    await fs.mkdir(backupDir, { recursive: true });
    await safeRenameOrCopy(storageTargetDir, path.join(backupDir, 'storage_export'));
    backupCreated = true;
  }
  if (await exists(exportMetaPath)) {
    await fs.mkdir(backupDir, { recursive: true });
    await fs.copyFile(exportMetaPath, backupMetaPath);
    backupCreated = true;
  }

  log('step: write new _data');
  await fs.mkdir(dataDir, { recursive: true });
  await safeRenameOrCopy(firestoreExportDir, firestoreTargetDir);
  if (!firestoreOnly && fullStorageRebuild) {
    await safeRenameOrCopy(storageExportDir, storageTargetDir);
  }

  let exportMeta = {
    version: 'unknown',
    firestore: {
      version: 'unknown',
      path: 'firestore_export',
      metadata_file: 'firestore_export/firestore_export.overall_export_metadata',
    },
    storage: {
      version: 'unknown',
      path: 'storage_export',
    },
  };

  if (await exists(backupMetaPath)) {
    try {
      const parsed = await readJsonFile(backupMetaPath);
      exportMeta = {
        ...parsed,
        firestore: {
          ...(parsed.firestore || {}),
          path: 'firestore_export',
          metadata_file: 'firestore_export/firestore_export.overall_export_metadata',
        },
        storage: {
          ...(parsed.storage || {}),
          path: 'storage_export',
        },
      };
    } catch {
      // keep fallback
    }
  }

  await fs.writeFile(exportMetaPath, JSON.stringify(exportMeta, null, 2), 'utf8');

  if (!skipStorageDownload && !firestoreOnly) {
    await safeRmDir(storageMirrorRoot);
  }

  log('done');
  log('backup:', backupCreated ? backupDir : '(none)');
  process.exit(0);
}

main().catch((e) => {
  console.error('[sync-prod-data] fatal:', e);
  process.exit(1);
});