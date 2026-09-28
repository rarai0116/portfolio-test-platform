/* cross-platform emulator launcher:
   - import from ./_data (if exists)
   - 既定: export-on-exit to ./_data_next
   - --persist: export-on-exit を ./_data に直接行う（in-place）。外部リネーム不要で永続化する。
                起動先頭で ./_data をスナップショット退避し、旧方式の ./_data_next が残っていれば
                ./_data へ昇格する（emulator 未起動＝ロックの無い瞬間に実施）。
 */
/** biome-ignore-all lint/style/useNodejsImportProtocol: スクリプトで厳密にしなくてもいい */

const fssync = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const backendDir = path.resolve(__dirname, '..');
const importDir = path.join(backendDir, '_data');
const legacyExportDir = path.join(backendDir, '_data_next');
const BACKUPS_TO_KEEP = 2; // 本体側は容量がかさむため2世代のみ保持

const log = (...args) => console.log('[emulators-start]', ...args);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function timestamp() {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
}

// Windows のハンドル遅延解放/AV/インデクサ由来の一時ロックに強い削除
async function robustRemove(dir) {
  for (let i = 0; i < 5; i += 1) {
    try {
      if (fssync.existsSync(dir)) {
        fssync.rmSync(dir, { recursive: true, force: true });
      }
      return;
    } catch (e) {
      if (i === 4) throw e;
      await sleep(300 * (i + 1));
    }
  }
}

// rename を優先し、ロックで失敗する場合は copy+remove にフォールバック
async function robustMove(src, dst) {
  await robustRemove(dst);
  for (let i = 0; i < 5; i += 1) {
    try {
      fssync.renameSync(src, dst);
      return;
    } catch (e) {
      if (i < 4) {
        await sleep(300 * (i + 1));
        continue;
      }
      // 最終手段: コピーしてから元を削除
      fssync.cpSync(src, dst, { recursive: true });
      await robustRemove(src);
      return;
    }
  }
}

function pruneBackups() {
  const prefix = path.basename(importDir) + '.backup.';
  const entries = fssync
    .readdirSync(backendDir)
    .filter((n) => n.startsWith(prefix))
    .sort(); // 名前が日時なので昇順 = 古い順
  while (entries.length > BACKUPS_TO_KEEP) {
    const old = entries.shift();
    try {
      fssync.rmSync(path.join(backendDir, old), {
        recursive: true,
        force: true,
      });
      log('pruned old backup →', old);
    } catch {}
  }
}

// 永続化モードの起動前処理（emulator 未起動＝ロックの無い時点で安全に実施）
async function preparePersist() {
  // 1) 現 ./_data をスナップショット退避（破損 export への保険）
  if (fssync.existsSync(importDir)) {
    const bak = `${importDir}.backup.${timestamp()}`;
    log('step: backup ./_data →', path.basename(bak));
    fssync.cpSync(importDir, bak, { recursive: true });
    pruneBackups();
  }
  // 2) 旧方式の ./_data_next が残っていれば ./_data へ昇格（旧フローの実体を引き継ぐ）
  if (fssync.existsSync(legacyExportDir)) {
    log('step: promote ./_data_next → ./_data');
    await robustMove(legacyExportDir, importDir);
  }
}

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      cwd: options.cwd || process.cwd(),
      shell: process.platform === 'win32', // to resolve pnpm/cmd shims on Windows
    });

    const onSignal = (sig) => {
      // forward to child; let emulator handle clean export
      try {
        child.kill(sig);
      } catch {}
    };
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);

    child.on('exit', (code, signal) => {
      process.off('SIGINT', onSignal);
      process.off('SIGTERM', onSignal);
      if (signal) return resolve({ code: 128, signal });
      resolve({ code });
    });
    child.on('error', reject);
  });
}

async function main() {
  const noImport = process.argv.includes('--no-import');
  const persist = process.argv.includes('--persist');

  log('cwd =', backendDir, persist ? '(persist: export-on-exit → ./_data)' : '');

  if (persist) {
    await preparePersist();
  } else if (fssync.existsSync(legacyExportDir)) {
    // 非 persist は従来どおり古い _data_next を掃除
    log('step: remove stale export dir → ./_data_next');
    await robustRemove(legacyExportDir);
  }

  log('step: build functions');
  {
    const { code } = await run('pnpm', ['run', 'build:functions'], {
      cwd: backendDir,
    });
    if (code !== 0) process.exit(code);
  }

  const exportArg = persist ? './_data' : './_data_next';
  const firebaseArgs = [
    'exec',
    'firebase',
    'emulators:start',
    '--export-on-exit',
    exportArg,
  ];
  if (!noImport && fssync.existsSync(importDir)) {
    firebaseArgs.push('--import', './_data');
  }

  log('step: start firebase emulators →', firebaseArgs.join(' '));
  if (persist) {
    log('停止は必ず Ctrl+C（クリーン終了）で行ってください。./_data に in-place export されます');
  }
  const { code } = await run('pnpm', firebaseArgs, { cwd: backendDir });
  process.exit(code || 0);
}

main().catch((e) => {
  console.error('[emulators-start] fatal:', e);
  process.exit(1);
});
