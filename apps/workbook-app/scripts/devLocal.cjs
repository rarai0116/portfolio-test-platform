#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const device = require('./androidDevice.cjs');

const appDir = path.resolve(__dirname, '..');
const backendDir = path.join(appDir, 'backend');
const dataDir = path.join(backendDir, 'data');
const corepackEntry = path.join(path.dirname(process.execPath), 'node_modules', 'corepack', 'dist', 'corepack.js');
const metroStatePath = path.join(appDir, '..', '..', '.tmp', 'workbook-dev-local', 'metro-inputs.json');

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function inspectExport(root) {
  if (!fs.existsSync(root)) return { exists: false, valid: true, errors: [] };
  const errors = [];
  const metadataPath = path.join(root, 'firebase-export-metadata.json');
  let metadata;
  try {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  } catch (error) {
    errors.push(`firebase-export-metadata.json is invalid: ${error.message}`);
  }
  if (metadata) {
    for (const service of ['auth', 'firestore', 'storage']) {
      const serviceMetadata = metadata[service];
      if (!serviceMetadata) continue;
      if (typeof serviceMetadata.path !== 'string') {
        errors.push(`${service}.path is missing`);
        continue;
      }
      const target = path.resolve(root, serviceMetadata.path);
      const relative = path.relative(root, target);
      if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(target)) {
        errors.push(`${service}.path is invalid`);
      }
    }
  }
  return { exists: true, valid: errors.length === 0, errors };
}

function childEnvironment() {
  const names = [
    'PATH', 'Path', 'PATHEXT', 'SystemRoot', 'COMSPEC', 'TEMP', 'TMP', 'USERPROFILE', 'HOME',
    'APPDATA', 'LOCALAPPDATA', 'PNPM_HOME', 'COREPACK_HOME', 'CI', 'ANDROID_HOME', 'JAVA_HOME',
  ];
  const environment = {};
  for (const name of names) {
    if (process.env[name] !== undefined) environment[name] = process.env[name];
  }
  return environment;
}

// backend/functions は workspace 外なので、ルートの install / build では届かない。
// Firebase の emulator は functions/lib/index.js を読むため、emulator を上げる前に
// ここでビルドする。ポートフォリオ移植は functions/lib/ をビルド成果物として除外する
// ので、移植直後は lib/ が存在しない。
async function buildFunctions() {
  const { code } = await runBackendPnpm(['run', 'build:functions']);
  if (code !== 0) throw new Error(`build:functions failed: code=${code}`);
  const entry = path.join(backendDir, 'functions', 'lib', 'index.js');
  // pnpm は対象 package に届かなくても exit 0 で終わるため、成果物の有無で確かめる
  if (!fs.existsSync(entry)) {
    throw new Error('build:functions produced no output: backend/functions/lib/index.js がありません');
  }
}

// backendDir で pnpm を起動し、子と終了 promise の両方を返す。
// 子を露出するのは、Metro を待つ側が「待っている間に死んでいないか」を見るため。
function startBackendPnpm(args) {
  const command = process.platform === 'win32' ? process.execPath : 'pnpm';
  const commandArgs = process.platform === 'win32' ? [corepackEntry, 'pnpm', ...args] : args;
  const child = spawn(command, commandArgs, {
    cwd: backendDir,
    env: childEnvironment(),
    stdio: 'inherit',
    shell: false,
  });
  const done = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  return { child, done };
}

// backendDir で pnpm を実行して終了を待つ。
function runBackendPnpm(args) {
  return startBackendPnpm(args).done;
}

function promotePending(pendingDir) {
  const backupDir = path.join(backendDir, `data.backup.${timestamp()}`);
  let backedUp = false;
  try {
    if (fs.existsSync(dataDir)) {
      fs.renameSync(dataDir, backupDir);
      backedUp = true;
    }
    fs.renameSync(pendingDir, dataDir);
    if (backedUp) fs.rmSync(backupDir, { recursive: true, force: true });
  } catch (error) {
    if (backedUp && fs.existsSync(backupDir) && !fs.existsSync(dataDir)) {
      fs.renameSync(backupDir, dataDir);
    }
    throw error;
  }
}

/**
 * 解釈できない引数は黙って捨てず、警告して止める。
 *
 * `--import` は本スクリプトが data の有無を見て自分で付けるため指定は要らないが、
 * 黙殺されると「import したつもりでしていなかった」状態に気付けない（実際に起きた）。
 * 置き場所の名前が test-manager 側と食い違う（data / _data）ことも相まって
 * 誤解が繰り返されやすいので、ここで早く落とす。
 */
const FLAGS = new Set(['--persist', '--device', '--no-device']);
const OPTIONS = new Set(['--avd', '--apk', '--metro-port', '--host']);

function parseArgs(argv) {
  const values = {};
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (FLAGS.has(token)) { seen.add(token); continue; }
    if (OPTIONS.has(token)) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`${token} に値がありません`);
      }
      values[token] = value;
      index += 1;
      continue;
    }
    throw new Error(
      `解釈できない引数です: ${token}\n`
      + `  フラグ: ${[...FLAGS].join(' / ')}\n`
      + `  値つき: ${[...OPTIONS].join(' / ')}\n`
      + '  --import は data/ があれば自動で付きます（指定は不要）。\n'
      + '  emulator へ直接引数を渡したい場合は firebase emulators:exec を直接実行してください。',
    );
  }
  // `dev` script は --device を焼き込んでいるので、両方あるのは矛盾ではなく
  // 「利用者があとから打ち消した」状況。--no-device を勝たせないと打ち消せない。
  const metroPort = Number(values['--metro-port'] ?? device.DEFAULT_METRO_PORT);
  if (!Number.isInteger(metroPort) || metroPort < 1 || metroPort > 65_535) {
    throw new Error(`--metro-port が不正です: ${values['--metro-port']}`);
  }
  return {
    persist: seen.has('--persist'),
    device: seen.has('--device') && !seen.has('--no-device'),
    avd: values['--avd'] || process.env.WORKBOOK_AVD || '',
    apk: values['--apk'] || process.env.WORKBOOK_APK || defaultApkPath(),
    metroPort,
    host: values['--host'] || device.EMULATOR_HOST_ALIAS,
  };
}

function defaultApkPath() {
  return path.join(appDir, '..', '..', '.tmp', 'android-native-build', 'artifacts', 'app-debug.apk');
}

/**
 * Metro のポートが既に塞がっていないか、起動する前に見る。
 *
 * 塞がっていると Expo は黙って別のポート（8082 など）を選ぶ。そうなると deep link
 * で渡す URL が実際の Metro と食い違い、「接続できない」だけが見えて原因が分からない。
 * 移植ランナーとの取り合いでも同種の事故が起きているので、ここで早く落とす。
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const finish = (inUse) => { socket.destroy(); resolve(inUse); };
    socket.setTimeout(1500);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

const log = (line) => { console.log(`[workbook-dev-local] ${line}`); };

/**
 * Metro のキャッシュを作り直させるかどうかを、バンドラの入力から決める。
 *
 * Metro のキャッシュはリポジトリの外（os.tmpdir() の metro-cache / metro-file-map-expo-*）
 * にあるため、node_modules を入れ替えても、リポジトリを掃除しても残る。移植で依存が
 * 入れ替わると .pnpm/<pkg>@<ver>_<hash>/ のディレクトリ名が総入れ替えになるので、
 * 古いパスを指したままのキャッシュが解決を壊す。実際に expo 57.0.23 → 57.0.24 の
 * 更新後、tsconfig paths 由来の裸の指定子が解決できず（Unable to resolve module
 * commonUnionType）、端末には無関係に見える HMR の差し替え失敗だけが出た。
 *
 * 消すのではなく --clear で作り直させる。tmpdir のキャッシュは test-manager や
 * 移植元とも共有しており、ディレクトリごと消すと無関係なものを巻き込むため。
 */
const METRO_INPUT_FILES = [
  ['lock', ['pnpm-lock.yaml']],
  ['client-package', ['client', 'package.json']],
  ['babel', ['client', 'babel.config.js']],
  ['metro', ['client', 'metro.config.js']],
  ['tsconfig', ['client', 'tsconfig.json']],
];

function metroInputFingerprint(root = appDir) {
  const hash = crypto.createHash('sha256');
  for (const [name, segments] of METRO_INPUT_FILES) {
    hash.update(`${name}\0`);
    try {
      hash.update(fs.readFileSync(path.join(root, ...segments)));
    } catch {
      // 無い状態も状態として数える。あとから増えたら指紋が変わる。
      hash.update('<missing>');
    }
    hash.update('\0');
  }
  // lockfile が同じでも入れ直しでリンク先が変わることがある。解決が壊れるのは
  // 実体の位置が動いたときなので、expo のリンク先そのものを混ぜる。
  let expoRealPath;
  try {
    expoRealPath = fs.realpathSync(path.join(root, 'client', 'node_modules', 'expo'));
  } catch {
    expoRealPath = '<missing>';
  }
  hash.update(`expo\0${expoRealPath}`);
  return hash.digest('hex');
}

function readMetroInputs(statePath = metroStatePath) {
  try {
    const stored = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return typeof stored.fingerprint === 'string' ? stored.fingerprint : null;
  } catch {
    // 初回も壊れている場合も「前回と違う」でよい。安全側は作り直す方。
    return null;
  }
}

function writeMetroInputs(fingerprint, statePath = metroStatePath) {
  try {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    const body = { fingerprint, at: new Date().toISOString() };
    fs.writeFileSync(statePath, `${JSON.stringify(body, null, 2)}\n`);
    return true;
  } catch (error) {
    // 記録できなくても開発は続く。次回も --clear が付いて遅くなるだけ。
    log(`Metro キャッシュの記録に失敗しました（次回も作り直します）: ${error.message}`);
    return false;
  }
}

/**
 * `pnpm run <script>` へオプションを渡すとき `--` を挟んではいけない。
 * pnpm は `--` をスクリプトの argv に残して渡すため、expo は末尾の `--` を
 * <dir> 引数として受け取り、--clear は効かないまま壊れる（実測で確認）。
 */
function clientCommandFor(clearCache) {
  return `pnpm -C ../client dev:local${clearCache ? ' --clear' : ''}`;
}

/**
 * Metro が立ち上がったら端末でアプリを開く。開発サーバ本体とは独立に走らせ、
 * 失敗しても開発サーバは落とさない（手で deep link を打てば復帰できるため）。
 */
async function attachDevice(options, metroReady) {
  const scheme = device.resolveScheme(path.join(appDir, 'client', 'app.json'));
  const packageName = await device.ensureInstalled({ scheme, apkPath: options.apk, log });
  await metroReady;
  await device.launchApp({
    scheme,
    packageName,
    url: `http://${options.host}:${options.metroPort}`,
    log,
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { persist } = options;
  const pendingDir = path.join(backendDir, `data.pending.${timestamp()}`);
  const metroInputs = metroInputFingerprint();
  const clearCache = metroInputs !== readMetroInputs();
  const clientCommand = clientCommandFor(clearCache);
  const firebaseArgs = [
    'exec',
    'firebase',
    'emulators:exec',
    '--project',
    'demo-workbook-app',
    '--config',
    'firebase.json',
  ];

  if (await isPortInUse(options.metroPort)) {
    throw new Error(
      `ポート ${options.metroPort} が既に使われています。\n`
      + '  別の dev:local が動いていないか確認してください（pgrep -af "expo start"）。\n'
      + '  塞がったまま起動すると Expo が黙って別ポートを選び、アプリの接続先だけがずれます。',
    );
  }

  // エミュレータの起動は 1 分弱かかる。functions のビルドと重ねて待ち時間を隠す。
  const emulatorReady = options.device
    ? device.ensureEmulator({ avd: options.avd, log })
    : Promise.resolve(null);
  // 先に await しないので、ビルドが落ちたときに unhandled rejection にならないよう捕まえておく。
  emulatorReady.catch(() => {});

  await buildFunctions();
  await emulatorReady;

  const baseline = inspectExport(dataDir);
  if (baseline.exists && !baseline.valid) {
    throw new Error(`existing backend/data is invalid: ${baseline.errors.join('; ')}`);
  }
  if (baseline.exists) firebaseArgs.push('--import', './data');
  if (persist) firebaseArgs.push('--export-on-exit', `./${path.basename(pendingDir)}`);
  firebaseArgs.push(clientCommand);

  log(`persist=${persist} device=${options.device}`);
  log(clearCache
    ? 'metro-cache=clear（依存か設定が前回と変わりました。初回のバンドルは遅くなります）'
    : 'metro-cache=reuse');
  const { child, done } = startBackendPnpm(firebaseArgs);
  // Metro の起動待ちは 1 本にまとめる。端末を繋がない場合でも、指紋の記録には
  // 「本当に Metro が応答した」ことの確認が要るため。
  const metroReady = device.waitForMetro({
    port: options.metroPort,
    isAlive: () => child.exitCode === null && !child.killed,
  });
  // 先に await しないので、失敗が unhandled rejection にならないよう捕まえておく。
  metroReady.catch(() => {});
  // 起動する前に記録すると、途中で落ちたときに「作り直していないのに作り直した」
  // ことになり、次回も壊れたキャッシュを使ってしまう。応答を見てから記録する。
  metroReady.then(() => { writeMetroInputs(metroInputs); }, () => {});
  if (options.device) {
    attachDevice(options, metroReady)
      .catch((error) => {
        console.error(`[workbook-dev-local] 端末への接続に失敗しました: ${error.message}`);
        console.error('[workbook-dev-local] 開発サーバは動いています。手順書の deep link を手で実行してください。');
      });
  }
  const result = await done;
  if (result.code !== 0) {
    throw new Error(`emulators:exec failed: code=${result.code} signal=${result.signal || 'none'}`);
  }
  if (!persist) return;

  const pending = inspectExport(pendingDir);
  if (!pending.exists || !pending.valid) {
    throw new Error(`pending export is invalid: ${pending.errors.join('; ') || 'not created'}`);
  }
  promotePending(pendingDir);
  log('persisted validated export to backend/data');
}

module.exports = {
  buildFunctions,
  clientCommandFor,
  inspectExport,
  isPortInUse,
  metroInputFingerprint,
  metroStatePath,
  parseArgs,
  promotePending,
  readMetroInputs,
  writeMetroInputs,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(`[workbook-dev-local] ERROR: ${error.message}`);
    process.exit(1);
  });
}
