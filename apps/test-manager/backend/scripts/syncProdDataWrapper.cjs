const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');

const backendDir = path.resolve(__dirname, '..');
const credPath = path.join(backendDir, 'credentials', 'service_accounts.json');
const syncScript = path.join(backendDir, 'scripts', 'syncProddata.cjs');

async function readProjectId() {
  const text = await fs.readFile(credPath, 'utf8');
  const json = JSON.parse(text);
  if (!json.project_id) throw new Error('project_id not found in service_accounts.json');
  return json.project_id;
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

async function main() {
  const projectId = await readProjectId();
  const bucket = `${projectId}.firebasestorage.app`;
  const exportUri = `gs://${bucket}/firestore_export`;

  const args = [
    syncScript,
    '--project', projectId,
    '--buckets', bucket,
    '--firestore-export-uri', exportUri,
  ];

  if (process.argv.includes('--force-export-clean')) {
    args.push('--force-export-clean');
  }

  if (process.argv.includes('--refresh-firestore-export')) {
    args.push('--refresh-firestore-export');
  }

  if (process.argv.includes('--dry-run')) {
    args.push('--dry-run');
  }

  if (process.argv.includes('--skip-storage-download')) {
    args.push('--skip-storage-download');
  }

  if (process.argv.includes('--firestore-only')) {
    args.push('--firestore-only');
  }

  const { code } = await run('node', args, { cwd: backendDir });
  process.exit(code || 0);
}

main().catch((e) => {
  console.error('[sync-prod-wrapper] fatal:', e);
  process.exit(1);
});