// apps/backend/scripts/fixStorageMetadata.cjs 変更点: 新規スクリプト作成
const fs = require('fs/promises');
const fssync = require('fs');
const path = require('path');
const crypto = require('crypto');

function parseArgs(argv) {
  let dataDir = '';
  let metadataDir = '';
  let blobsDir = '';
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--data-dir') {
      dataDir = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--metadata-dir') {
      metadataDir = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--blobs-dir') {
      blobsDir = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
  }

  return { dataDir, metadataDir, blobsDir, dryRun };
}

function isMissing(value) {
  return value === undefined || value === null || value === '';
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

async function main() {
  const { dataDir, metadataDir, blobsDir, dryRun } = parseArgs(process.argv.slice(2));

  const backendDir = path.resolve(__dirname, '..');
  const baseDataDir = dataDir || path.join(backendDir, '_data');
  const baseMetadataDir = metadataDir || path.join(baseDataDir, 'storage_export', 'metadata');
  const baseBlobsDir = blobsDir || path.join(baseDataDir, 'storage_export', 'blobs');

  const files = await fs.readdir(baseMetadataDir);
  const jsonFiles = files.filter((name) => name.endsWith('.json'));

  let updated = 0;
  let skipped = 0;
  let missingBlob = 0;

  for (const filename of jsonFiles) {
    const metaPath = path.join(baseMetadataDir, filename);
    const blobId = filename.replace(/\.json$/u, '');
    const blobPath = path.join(baseBlobsDir, blobId);

    let meta;
    try {
      meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    } catch {
      skipped += 1;
      continue;
    }

    const needSize = isMissing(meta.size);
    const needMd5 = isMissing(meta.md5Hash);
    const needCrc = isMissing(meta.crc32c);

    if (!needSize && !needMd5 && !needCrc) {
      continue;
    }

    let stats;
    try {
      stats = await fs.stat(blobPath);
    } catch {
      missingBlob += 1;
      continue;
    }

    if (!stats.isFile()) {
      skipped += 1;
      continue;
    }

    if (needSize) {
      meta.size = stats.size;
    }

    if (needMd5 || needCrc) {
      const hashes = await computeHashes(blobPath);
      if (needMd5) meta.md5Hash = hashes.md5Hash;
      if (needCrc) meta.crc32c = hashes.crc32c;
    }

    if (!dryRun) {
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');
    }
    updated += 1;
  }

  console.log('[fix-storage-metadata] updated:', updated);
  console.log('[fix-storage-metadata] missingBlob:', missingBlob);
  console.log('[fix-storage-metadata] skipped:', skipped);
}

main().catch((e) => {
  console.error('[fix-storage-metadata] fatal:', e);
  process.exit(1);
});