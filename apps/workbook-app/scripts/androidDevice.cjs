#!/usr/bin/env node
'use strict';

/*
 * `pnpm dev` の一発起動のうち、Android 側を受け持つ。
 *
 * ここが面倒を見るのは次の 4 つで、いずれも Windows / WSL の差を吸収する。
 *   1. Android エミュレータが居なければ AVD から起動する
 *   2. dev-client の APK が入っていなければ入れる
 *   3. Metro が listen するまで待つ
 *   4. deep link で dev-client の接続先を指定して起動する
 *
 * 4 が要るのは、dev-client ビルドの APK が JS バンドルを内蔵しておらず、
 * 「どの開発サーバから取るか」を実行時に教える必要があるため。ランチャーから
 * 起動すると expo-dev-launcher の接続先選択画面で止まる。
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');

const IS_WINDOWS = process.platform === 'win32';

/**
 * 接続先は adb reverse ではなく 10.0.2.2 を使う。
 *
 * 10.0.2.2 は Android エミュレータがホストの loopback に割り当てる固定エイリアスで、
 * クライアントが Firebase Emulator へ繋ぐのに既に使っているもの（app.config.ts の
 * FIREBASE_EMULATOR_HOST 既定値）。Metro も同じ経路に載せれば `adb reverse` が要らず、
 * 手順とスクリプトから 1 ステップ落とせる。実機を繋ぐ場合はこの前提が崩れるため、
 * そのときだけ --host で上書きする（別途 adb reverse も必要）。
 */
const EMULATOR_HOST_ALIAS = '10.0.2.2';
const DEFAULT_METRO_PORT = 8081;

function sdkRoot() {
  const fromEnvironment = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (fromEnvironment) return fromEnvironment;
  const home = os.homedir();
  if (IS_WINDOWS) {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    return path.join(localAppData, 'Android', 'Sdk');
  }
  if (process.platform === 'darwin') return path.join(home, 'Library', 'Android', 'sdk');
  return path.join(home, 'Android', 'Sdk');
}

// SDK 直下に無ければ PATH へ委ねる。名前だけ返せば spawn が PATH を辿る。
function sdkTool(subdirectory, name) {
  const executable = IS_WINDOWS ? `${name}.exe` : name;
  const candidate = path.join(sdkRoot(), subdirectory, executable);
  return fs.existsSync(candidate) ? candidate : executable;
}

const adbPath = () => sdkTool('platform-tools', 'adb');
const emulatorPath = () => sdkTool('emulator', 'emulator');

function adb(args, { allowFailure = false, timeout = 30_000 } = {}) {
  try {
    return execFileSync(adbPath(), args, { encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    if (allowFailure) return '';
    const detail = (error.stderr || error.message || '').trim();
    throw new Error(`adb ${args.join(' ')} に失敗しました: ${detail}`);
  }
}

const delay = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** `adb devices` から、offline や unauthorized を除いた使える端末だけを返す。 */
function onlineDevices() {
  const output = adb(['devices'], { allowFailure: true });
  return output.split('\n').slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter((columns) => columns.length >= 2 && columns[1] === 'device')
    .map((columns) => columns[0]);
}

function listAvds() {
  try {
    return execFileSync(emulatorPath(), ['-list-avds'], { encoding: 'utf8', timeout: 30_000 })
      .split('\n').map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * AVD 名は明示が最優先。未指定で候補が 1 つならそれを使い、複数あるなら選ばせる。
 * 黙って先頭を選ぶと、別プロジェクト用の AVD が起動していても気付けない。
 */
function resolveAvd(requested) {
  const available = listAvds();
  if (requested) {
    if (available.length > 0 && !available.includes(requested)) {
      throw new Error(`AVD "${requested}" がありません。存在するのは: ${available.join(' / ') || '(なし)'}`);
    }
    return requested;
  }
  if (available.length === 1) return available[0];
  if (available.length === 0) {
    throw new Error(
      'AVD が 1 つもありません。手順書「初回セットアップ」の AVD 作成を実施してください。\n'
      + `  探した場所: ${sdkRoot()}`,
    );
  }
  throw new Error(
    `AVD が複数あります: ${available.join(' / ')}\n`
    + '  --avd <name> か WORKBOOK_AVD で指定してください。',
  );
}

/**
 * エミュレータは親から切り離して起動する。ターミナルやこのスクリプトの寿命に
 * 紐付けると、Ctrl-C のたびに落ちて起動し直し（1 分弱）になる。
 */
function spawnEmulator(avd) {
  const environment = { ...process.env };
  // WSLg へ出すために DISPLAY が要る。非対話シェルは ~/.bashrc を読まないため
  // 継承できていないことがあり、その場合だけ既定値を補う。
  if (!IS_WINDOWS && process.platform === 'linux' && !environment.DISPLAY) environment.DISPLAY = ':0';
  const child = spawn(emulatorPath(), ['-avd', avd], {
    detached: true, stdio: 'ignore', env: environment, shell: false,
  });
  child.unref();
}

async function waitForBoot({ timeoutMs = 240_000, log = () => {} } = {}) {
  const deadline = Date.now() + timeoutMs;
  let announced = false;
  while (Date.now() < deadline) {
    if (onlineDevices().length > 0) {
      const booted = adb(['shell', 'getprop', 'sys.boot_completed'], { allowFailure: true }).trim();
      if (booted === '1') return;
      if (!announced) { log('端末を認識。起動完了を待っています'); announced = true; }
    }
    await delay(2000);
  }
  throw new Error(`エミュレータが ${Math.round(timeoutMs / 1000)} 秒以内に起動しませんでした`);
}

async function ensureEmulator({ avd, log = () => {} } = {}) {
  if (onlineDevices().length > 0) {
    log('既存の端末を使います');
    await waitForBoot({ log });
    return { started: false };
  }
  const name = resolveAvd(avd);
  log(`AVD "${name}" を起動します`);
  spawnEmulator(name);
  await waitForBoot({ log });
  return { started: true, avd: name };
}

/**
 * scheme を解決できる = その scheme を持つ APK が入っている。
 * パッケージ名をここから引くことで、app.config.ts の bundleIdentifier を
 * スクリプト側に写し取らずに済む（二重管理は必ずずれる）。
 */
function resolveInstalledPackage(scheme) {
  const output = adb(
    ['shell', 'cmd', 'package', 'resolve-activity', '-a', 'android.intent.action.VIEW', '-d', `${scheme}://expo-development-client/`],
    { allowFailure: true },
  );
  const match = output.match(/^\s*packageName=(\S+)/m);
  return match ? match[1] : '';
}

async function ensureInstalled({ scheme, apkPath, log = () => {} }) {
  const installed = resolveInstalledPackage(scheme);
  if (installed) return installed;
  if (!apkPath || !fs.existsSync(apkPath)) {
    throw new Error(
      `dev-client の APK が端末に入っておらず、代わりに入れる APK も見つかりません。\n`
      + `  探した場所: ${apkPath || '(未指定)'}\n`
      + '  手順書「APK のビルド」を実施してから再実行してください。',
    );
  }
  log(`APK をインストールします: ${apkPath}`);
  adb(['install', '-r', apkPath], { timeout: 600_000 });
  const afterInstall = resolveInstalledPackage(scheme);
  if (!afterInstall) {
    throw new Error(`APK を入れても ${scheme} を処理するアプリがありません。APK の scheme を確認してください`);
  }
  return afterInstall;
}

async function waitForMetro({ port = DEFAULT_METRO_PORT, timeoutMs = 240_000, isAlive = () => true } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // 起動に失敗した子を待ち続けない。タイムアウトまで黙って固まるのが一番困る。
    if (!isAlive()) throw new Error('Metro の起動を待っている間に開発サーバが終了しました');
    try {
      const response = await fetch(`http://127.0.0.1:${port}/status`, { signal: AbortSignal.timeout(2000) });
      if (response.ok && (await response.text()).includes('packager-status:running')) return;
    } catch {
      // まだ listen していない
    }
    await delay(1000);
  }
  throw new Error(`Metro が ${Math.round(timeoutMs / 1000)} 秒以内に :${port} で応答しませんでした`);
}

/**
 * dumpsys の出力から前面のパッケージ名を取り出す。行の形は
 *   topResumedActivity=ActivityRecord{248233992 u0 dev.demoApp.demoworkbook/.MainActivity t17}
 * 列を数えず、ActivityRecord{...} の中の `<package>/<activity>` だけを見る。
 */
function parseForegroundPackage(dumpsysOutput) {
  const match = dumpsysOutput.match(/topResumedActivity=ActivityRecord\{[^}]*?\s(\S+)\/\S+/);
  return match ? match[1] : '';
}

function foregroundPackage() {
  return parseForegroundPackage(adb(['shell', 'dumpsys', 'activity', 'activities'], { allowFailure: true }));
}

function isProcessAlive(packageName) {
  return adb(['shell', 'pidof', packageName], { allowFailure: true }).trim() !== '';
}

/**
 * 「前面に出た」だけでは足りない。前面に出てから数秒のうちに死ぬ経路がある
 * （下の launchApp のコメント参照）ので、出たあと居座ることまで確かめる。
 */
async function waitUntilSettled(packageName, { appearMs = 45_000, settleMs = 6000 } = {}) {
  const appearDeadline = Date.now() + appearMs;
  while (Date.now() < appearDeadline) {
    if (foregroundPackage() === packageName) break;
    await delay(1000);
  }
  if (foregroundPackage() !== packageName) return false;

  const settleDeadline = Date.now() + settleMs;
  while (Date.now() < settleDeadline) {
    await delay(1000);
    if (!isProcessAlive(packageName)) return false;
  }
  return true;
}

/**
 * deep link で接続先を直接指定して起動する。
 *
 * URL は percent encoding しなくても通る（実測）。素の形のほうが手順書に載せたとき
 * 読めるので、そのまま渡す。ただし device 側の sh に素通しされるため、`?` が glob
 * として解釈されないよう単一引用符で包んでから渡す。
 *
 * **成否を確かめてやり直す。** am start は intent を投げた時点で成功を返すので、
 * そのあとアプリが死んでも分からない。実際、Quickboot のスナップショットから
 * 復元した直後は sys.boot_completed が最初から 1 のため待ちが素通りし、システムが
 * 復元しきる前に起動したアプリが数秒で落ちる（実測）。復元の完了を表す確実な
 * プロパティが見当たらないので、結果を見てやり直すほうを採る。
 */
async function launchApp({ scheme, packageName, url, attempts = 3, log = () => {} }) {
  const uri = `${scheme}://expo-development-client/?url=${url}`;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    adb(['shell', 'am', 'force-stop', packageName], { allowFailure: true });
    await delay(500);
    const output = adb(['shell', `am start -a android.intent.action.VIEW -d '${uri}'`]);
    if (/Error:/.test(output)) throw new Error(`アプリの起動に失敗しました: ${output.trim()}`);
    if (await waitUntilSettled(packageName)) {
      log(`起動しました: ${uri}`);
      return;
    }
    log(`アプリが起動直後に終了しました（${attempt}/${attempts}）。やり直します`);
  }
  throw new Error(
    `アプリが ${attempts} 回とも起動直後に終了しました。\n`
    + `  deep link: ${uri}\n`
    + '  adb logcat で FATAL / has died を確認してください。',
  );
}

/**
 * deep link の scheme。app.json に scheme があればそれ、無ければ Expo の既定 `exp+<slug>`。
 * APK の AndroidManifest に登録されるのと同じ規則。
 */
function resolveScheme(appJsonPath) {
  if (!fs.existsSync(appJsonPath)) throw new Error(`app.json が見つかりません: ${appJsonPath}`);
  const raw = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const expo = raw.expo || raw;
  if (typeof expo.scheme === 'string' && expo.scheme) return expo.scheme;
  if (typeof expo.slug === 'string' && expo.slug) return `exp+${expo.slug}`;
  throw new Error(`app.json に scheme も slug もありません: ${appJsonPath}`);
}

module.exports = {
  EMULATOR_HOST_ALIAS,
  DEFAULT_METRO_PORT,
  adbPath,
  emulatorPath,
  ensureEmulator,
  ensureInstalled,
  foregroundPackage,
  launchApp,
  parseForegroundPackage,
  listAvds,
  onlineDevices,
  resolveAvd,
  resolveInstalledPackage,
  resolveScheme,
  sdkRoot,
  waitForBoot,
  waitForMetro,
  waitUntilSettled,
};
