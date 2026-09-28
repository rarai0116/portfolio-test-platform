/**
 * ファイル: apps/backend/scripts/releaseUpdate.cjs
 *
 * 目的:
 * - apps/client を build:win
 * - dist/latest.yml から version と path(exe名) を取得
 * - UUID(v4) を 32桁大文字HEXに整形して updates/<UUID>/ を作成
 * - latest.yml / exe / exe.blockmap(あれば) を apps/backend/hosting/updates/<UUID>/ にコピー
 * - hosting deploy
 * - Firestore update-config/global を update-config:set で更新
 *
 * 必要な環境変数:
 * - K_ENC_B64
 * - K_SIG_B64
 * - GOOGLE_APPLICATION_CREDENTIALS（相対パスなら apps/backend 基準で解決）
 *
 * 実行例:
 * - cd apps/backend
 * - pnpm release:update:local
 */

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const dotenv = require('dotenv');

const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function parseArgs(argv) {
  const out = {
    projectId: '',
    origin: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--project') {
      out.projectId = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (a === '--origin') {
      out.origin = argv[i + 1] || '';
      i += 1;
      continue;
    }
  }
  return out;
}

function stripQuotes(v) {
  const s = String(v || '').trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function pickYamlScalar(text, key) {
  // 超シンプルに `key: value` の1行だけ拾う（electron-builderのlatest.yml想定）
  const re = new RegExp(`^${key}:\\s*(.+)\\s*$`, 'm');
  const m = text.match(re);
  if (!m) return '';
  return stripQuotes(m[1]);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function run(cmd, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      windowsHide: true,
      ...options,
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 0));
  });
}

function makeUpdateId() {
  // UUIDv4 -> "-"除去 -> 大文字（32桁HEX）
  const id = crypto.randomUUID().replace(/-/g, '').toUpperCase();
  if (!/^[0-9A-F]{32}$/.test(id)) {
    throw new Error(`UUID format error: ${id}`);
  }
  return id;
}

async function main() {
  const backendDir = path.resolve(__dirname, '..');
  const repoRoot = path.resolve(backendDir, '..', '..');
  const clientDir = path.join(repoRoot, 'apps', 'client');
  const clientDistDir = path.join(clientDir, 'dist');

  // dotenv（cross-env で DOTENV_CONFIG_PATH を渡す想定。無ければ .env.local）
  {
    const dotenvConfigPath = process.env.DOTENV_CONFIG_PATH || '.env.local';
    const resolvedDotenvPath = path.isAbsolute(dotenvConfigPath)
      ? dotenvConfigPath
      : path.resolve(backendDir, dotenvConfigPath);

    if (await exists(resolvedDotenvPath)) {
      dotenv.config({ path: resolvedDotenvPath });
      process.env.DOTENV_CONFIG_PATH = resolvedDotenvPath;
    } else if (process.env.DOTENV_CONFIG_PATH) {
      throw new Error(`DOTENV_CONFIG_PATH が指すファイルが存在しません: ${resolvedDotenvPath}`);
    }
  }

  // GOOGLE_APPLICATION_CREDENTIALS が相対パスなら apps/backend 基準で絶対化
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const abs = path.isAbsolute(raw) ? raw : path.resolve(backendDir, raw);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = abs;
  }

  const args = parseArgs(process.argv.slice(2));
  const projectId =
    args.projectId ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    'demo-test-manager';

  const origin = args.origin || `https://${projectId}.web.app`;

  // 必須 env チェック（ここで落ちたら secrets 未設定）
  if (!process.env.K_ENC_B64 || !process.env.K_SIG_B64) {
    throw new Error('K_ENC_B64 / K_SIG_B64 が未設定です（.env.local か Secrets を確認）');
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS が未設定です（service account json のパスが必要）');
  }

  console.log('[release-update] step1: build client (pnpm build:win)');
  {
    const code = await run(pnpmCmd, ['build:win'], {
      cwd: clientDir,
      env: process.env,
    });
    if (code !== 0) process.exit(code);
  }

  console.log('[release-update] step2: read dist/latest.yml');
  const latestSrcPath = path.join(clientDistDir, 'latest.yml');
  if (!(await exists(latestSrcPath))) {
    throw new Error(`latest.yml が見つかりません: ${latestSrcPath}`);
  }
  const latestText = await fs.readFile(latestSrcPath, 'utf8');
  const version = pickYamlScalar(latestText, 'version');
  const exeName = pickYamlScalar(latestText, 'path');

  if (!version) throw new Error('latest.yml から version を取得できません');
  if (!exeName) throw new Error('latest.yml から path(exe名) を取得できません');

  const exeSrcPath = path.join(clientDistDir, exeName);
  if (!(await exists(exeSrcPath))) {
    throw new Error(`exe が見つかりません: ${exeSrcPath}`);
  }

  const blockmapSrcPath = `${exeSrcPath}.blockmap`;
  const hasBlockmap = await exists(blockmapSrcPath);

  console.log('[release-update] step3: generate update id');
  const updateId = makeUpdateId();

  console.log('[release-update] step4: copy artifacts to hosting/updates/<ID>/');
  const destDir = path.join(backendDir, 'hosting', 'updates', updateId);
  if (await exists(destDir)) {
    throw new Error(`既に存在するため中断します: ${destDir}`);
  }
  await fs.mkdir(destDir, { recursive: true });

  const latestDestPath = path.join(destDir, 'latest.yml');
  const exeDestPath = path.join(destDir, path.basename(exeSrcPath));
  await fs.copyFile(latestSrcPath, latestDestPath);
  await fs.copyFile(exeSrcPath, exeDestPath);

  if (hasBlockmap) {
    const blockmapDestPath = path.join(destDir, path.basename(blockmapSrcPath));
    await fs.copyFile(blockmapSrcPath, blockmapDestPath);
  }

  console.log('[release-update] step5: deploy hosting');
  {
    const code = await run(
      pnpmCmd,
      ['exec', 'firebase', 'deploy', '--only', 'hosting', '--project', projectId],
      {
        cwd: backendDir,
        env: process.env,
      },
    );
    if (code !== 0) process.exit(code);
  }

  console.log('[release-update] step6: update Firestore update-config/global');
  const baseUrl = `${origin}/updates/${updateId}/`;
  {
    const code = await run(
      pnpmCmd,
      ['update-config:set', '--', '--project', projectId, '--base-url', baseUrl],
      {
        cwd: backendDir,
        env: process.env,
      },
    );
    if (code !== 0) process.exit(code);
  }

  console.log('[release-update] DONE');
  console.log('  version   :', version);
  console.log('  updateId  :', updateId);
  console.log('  baseUrl   :', baseUrl);
  console.log('  artifacts :', destDir);
  console.log('  blockmap  :', hasBlockmap ? 'copied' : 'not found (ok)');
}

main().catch((e) => {
  console.error('[release-update] ERROR:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});