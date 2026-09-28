// 画像アセットのカスタムプロトコル配信（demo-asset://）における
// Chromium HTTP cache と protocol handler 到達の事前確認スパイク。手動実行専用。
// ビルド・CI には含めない。
//
// 正本: docs/.ai-works/画像アセット_カスタムプロトコル配信移行_実装設計書_整理版.html
//   - 3.4 Cache-Control / 3.5 登録位置 / 11.1 事前スパイク / 14.4 実機確認
//
// 確認したいこと（14.4）:
//   - 同一URLを別ウィンドウから再読込したときに handler へ再到達するか（cache hit有無だけでは合否にしない）
//   - r（recoveryToken）を変えたURLで handler へ到達するか        … 必須条件
//   - session.clearCache() 後に handler へ到達するか              … 必須条件
//
// 2026-07-30 の実測（Electron 41.7.1 / Chrome 146.0.7680.216 / win32 x64）と、それに対する人の判断:
//   session.defaultSession.clearCache() では、既に同一URLを読み込んだ renderer プロセス内の
//   リソースcacheが残るため handler へ再到達しない。reload() / reloadIgnoringCache() でも消えない。
//   再到達するのは renderer プロセスが新しくなった場合（新規window・アプリ再起動）とURLが変わった場合。
//   URLは v（md5 / updated_at_ms）でキー付けされるので、残留cacheから返るのは常に同一versionであり
//   誤内容表示は起きない。r 方式は clearCache 直後でも確実に到達する。
//   → 「clearCache後に既存windowが同一versionの画像を表示し続ける」ことは残余リスクとして受容する、
//      という判断のもとで本体実装を継続した。したがって必須条件は
//      「r変更後の到達」と「新しい renderer プロセスでの clearCache 後の到達」で判定し、
//      同一document内の残留は既知挙動として記録するだけにする。
//
// 製品profile・Firebase・ログインには依存しない。一時 userData と非表示ウィンドウだけで完結する。
const { app, BrowserWindow, nativeImage, protocol, session } = require('electron');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { Readable } = require('stream');

const GRADE = 'firstGrade';
const KEY = 'spikeAsset0001';
const VERSION = 'v1SpikeVersion';

// 設計3.5 の privileges。ready前に同期登録し、失敗はトップレベルで捕捉する。
const PRIMARY_SCHEME = 'demo-asset';
// 主scheme で Chromium が URL を解釈できなかった場合にだけ使う比較用（standard 付き）。
// 製品実装の候補ではなく、原因切り分けのための観測専用。
const FALLBACK_SCHEME = 'demo-asset-std';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-asset-protocol-verify-'));
const userDataDir = path.join(tempRoot, 'userData');
fs.mkdirSync(userDataDir, { recursive: true });
// 製品profileを汚さないため、ready前に userData を一時ディレクトリへ向ける。
app.setPath('userData', userDataDir);

const assetsRoot = path.join(userDataDir, 'assets');
const assetFilePath = path.join(assetsRoot, GRADE, `${KEY}.png`);

let preReadyStartupError = null;
try {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: PRIMARY_SCHEME,
      privileges: { secure: true, stream: true, supportFetchAPI: true },
    },
    {
      scheme: FALLBACK_SCHEME,
      privileges: { secure: true, stream: true, supportFetchAPI: true, standard: true },
    },
  ]);
} catch (e) {
  preReadyStartupError = e;
}

/** handler 到達記録。scheme+url 単位で回数を数える。 */
const hits = [];
const hitLog = [];

function countHits(scheme) {
  return hits.filter((h) => h.scheme === scheme).length;
}

function buildUrl(scheme, { version, recoveryToken } = {}) {
  const query = [];
  if (version) query.push(`v=${version}`);
  if (recoveryToken) query.push(`r=${recoveryToken}`);
  const suffix = query.length > 0 ? `?${query.join('&')}` : '';
  return `${scheme}://images/${GRADE}/${KEY}.png${suffix}`;
}

// 設計3.4 の Cache-Control 規則。
function cacheControlFor({ version, recoveryToken }) {
  if (version || recoveryToken) {
    return 'public, max-age=31536000, immutable';
  }
  return 'no-cache';
}

function registerHandler(scheme) {
  protocol.handle(scheme, async (request) => {
    let parsed;
    try {
      parsed = new URL(request.url);
    } catch {
      hits.push({ scheme, url: request.url, status: 400 });
      return new Response('bad url', { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const version = parsed.searchParams.get('v') ?? undefined;
    const recoveryToken = parsed.searchParams.get('r') ?? undefined;
    const record = {
      scheme,
      url: request.url,
      host: parsed.host,
      pathname: parsed.pathname,
      version,
      recoveryToken,
      at: Date.now(),
    };

    let stat;
    try {
      stat = await fsp.stat(assetFilePath);
    } catch {
      stat = null;
    }

    if (!stat || !stat.isFile()) {
      record.status = 404;
      hits.push(record);
      hitLog.push(record);
      return new Response('not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    record.status = 200;
    record.cacheControl = cacheControlFor({ version, recoveryToken });
    hits.push(record);
    hitLog.push(record);

    // 本実装と同じく stream で返す（Buffer全読み込みにしない）。
    return new Response(Readable.toWeb(fs.createReadStream(assetFilePath)), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(stat.size),
        'Cache-Control': record.cacheControl,
      },
    });
  });
}

function createTestPng() {
  // nativeImage 経由で確実に妥当なPNGを生成する（スパイク用のダミー画像）。
  const width = 64;
  const height = 64;
  const bitmap = Buffer.alloc(width * height * 4);
  for (let i = 0; i < bitmap.length; i += 4) {
    bitmap[i] = 0x20; // B
    bitmap[i + 1] = 0x60; // G
    bitmap[i + 2] = 0xe0; // R
    bitmap[i + 3] = 0xff; // A
  }
  return nativeImage.createFromBitmap(bitmap, { width, height }).toPNG();
}

const PAGE_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>asset protocol spike</title></head>
<body><div id="host"></div></body></html>`;

async function createHiddenWindow(pagePath, label) {
  const win = new BrowserWindow({
    show: false,
    width: 400,
    height: 300,
    webPreferences: {
      // 非表示ウィンドウでの読み込み抑制を避ける。
      backgroundThrottling: false,
      sandbox: false,
      contextIsolation: true,
    },
  });
  win.setTitle(label);
  await new Promise((resolve, reject) => {
    win.webContents.once('did-finish-load', resolve);
    win.webContents.once('did-fail-load', (_e, code, desc) =>
      reject(new Error(`load failed (${label}): ${code} ${desc}`)),
    );
    win.loadFile(pagePath);
  });
  return win;
}

async function loadImgInWindow(win, url) {
  return win.webContents.executeJavaScript(
    `new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ ok: true, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ ok: false });
      img.src = ${JSON.stringify(url)};
      document.getElementById('host').appendChild(img);
    })`,
    true,
  );
}

async function fetchInWindow(win, url) {
  return win.webContents.executeJavaScript(
    `fetch(${JSON.stringify(url)})
      .then(async (res) => ({
        ok: res.ok,
        status: res.status,
        cacheControl: res.headers.get('cache-control'),
        bytes: (await res.arrayBuffer()).byteLength,
      }))
      .catch((e) => ({ ok: false, error: String(e && e.message ? e.message : e) }))`,
    true,
  );
}

/** 1 scheme 分の確認シーケンス。戻り値は観測結果とNG判定。 */
async function runSequence(scheme, pagePath) {
  const steps = [];
  const win1 = await createHiddenWindow(pagePath, `${scheme}-win1`);
  const win2 = await createHiddenWindow(pagePath, `${scheme}-win2`);

  const record = async (name, note, fn) => {
    const before = countHits(scheme);
    const result = await fn();
    const delta = countHits(scheme) - before;
    steps.push({ name, note, handlerHits: delta, result });
    return { delta, result };
  };

  const versionedUrl = buildUrl(scheme, { version: VERSION });
  const plainUrl = buildUrl(scheme);

  // 1. コールド: 初回 img 読み込み
  const cold = await record('cold-img-win1', 'v付きURLの初回読み込み', () =>
    loadImgInWindow(win1, versionedUrl),
  );

  // 2. 同一ウィンドウで同一URLを再読込
  await record('same-url-img-win1', '同一window・同一URLの再読込', () =>
    loadImgInWindow(win1, versionedUrl),
  );

  // 3. 別ウィンドウから同一URLを再読込（14.4）
  await record('same-url-img-win2', '別window・同一URLの再読込', () =>
    loadImgInWindow(win2, versionedUrl),
  );

  // 4. 別ウィンドウから fetch で同一URL（14.4）
  await record('same-url-fetch-win2', '別window・同一URLのfetch', () =>
    fetchInWindow(win2, versionedUrl),
  );

  // 5. r を変えたURL（必須条件）
  const token1 = crypto.randomBytes(16).toString('base64url');
  const recovery1 = await record('changed-r-img-win1', 'r付きURL（1回目）', () =>
    loadImgInWindow(win1, buildUrl(scheme, { version: VERSION, recoveryToken: token1 })),
  );

  const token2 = crypto.randomBytes(16).toString('base64url');
  const recovery2 = await record('changed-r-again-img-win1', 'r付きURL（別トークン）', () =>
    loadImgInWindow(win1, buildUrl(scheme, { version: VERSION, recoveryToken: token2 })),
  );

  // 6. clearCache 後の同一URL（必須条件）
  const afterClear = await record('after-clear-cache-img-win1', 'clearCache後の同一v付きURL', async () => {
    await session.defaultSession.clearCache();
    return loadImgInWindow(win1, versionedUrl);
  });

  // 7. 参考: query なし（Cache-Control: no-cache）の再読込
  await record('no-query-img-win1-first', 'queryなしURLの初回', () => loadImgInWindow(win1, plainUrl));
  await record('no-query-img-win1-second', 'queryなしURLの再読込', () =>
    loadImgInWindow(win1, plainUrl),
  );

  win2.destroy();

  return {
    scheme,
    steps,
    // clearCache後の切り分け診断で再利用するため win1 は破棄しない。
    win1,
    coldOk: cold.delta >= 1 && cold.result?.ok === true,
    requiredChecks: [
      {
        name: 'r変更後にhandlerへ到達する',
        ok: recovery1.delta >= 1 && recovery2.delta >= 1,
        detail: `1回目 hits=${recovery1.delta} ok=${recovery1.result?.ok}, 2回目 hits=${recovery2.delta} ok=${recovery2.result?.ok}`,
      },
      {
        // 同一document内では renderer のリソースcacheが残るため到達しないことが既知（先頭コメント参照）。
        // 到達可否の判定は runPostClearDiagnostics の新規window結果で行う。
        name: 'clearCache後にhandlerへ到達する（同一document・既知挙動のため参考）',
        ok: true,
        detail: `hits=${afterClear.delta} ok=${afterClear.result?.ok}（既存windowでの残留は受容済み）`,
      },
    ],
  };
}

/**
 * clearCache 後に handler へ到達しなかった場合の切り分け。
 * session.clearCache() はネットワーク層のcacheを消すが、既に同一URLを読み込んだ
 * renderer プロセス内のメモリcacheまで消えるとは限らないため、
 * 「同一document」「同一windowの再読込後」「新規window」を分けて観測する。
 * さらに clearCache と同時にローカルファイルを消した状態で、
 * 古い画像が表示され続けるのか 404 になるのかも記録する。
 */
async function runPostClearDiagnostics(scheme, pagePath, win1) {
  const steps = [];
  const versionedUrl = buildUrl(scheme, { version: VERSION });

  const record = async (name, note, fn) => {
    const before = countHits(scheme);
    const result = await fn();
    const delta = countHits(scheme) - before;
    steps.push({ name, note, handlerHits: delta, result });
    return { delta, result };
  };

  // 設計7.2 と同じ順序: ローカルファイル削除 → session.clearCache()
  await fsp.rm(assetFilePath, { force: true });
  await session.defaultSession.clearCache();

  const sameDocument = await record(
    'post-clear-same-document',
    'ファイル削除+clearCache後、同一documentで同一URL',
    () => loadImgInWindow(win1, versionedUrl),
  );

  const afterReload = await record(
    'post-clear-after-reload',
    'documentを再読込してから同一URL',
    async () => {
      await new Promise((resolve, reject) => {
        win1.webContents.once('did-finish-load', resolve);
        win1.webContents.once('did-fail-load', (_e, code, desc) =>
          reject(new Error(`reload failed: ${code} ${desc}`)),
        );
        win1.reload();
      });
      return loadImgInWindow(win1, versionedUrl);
    },
  );

  const afterHardReload = await record(
    'post-clear-after-reload-ignoring-cache',
    'reloadIgnoringCache後に同一URL',
    async () => {
      await new Promise((resolve, reject) => {
        win1.webContents.once('did-finish-load', resolve);
        win1.webContents.once('did-fail-load', (_e, code, desc) =>
          reject(new Error(`reload failed: ${code} ${desc}`)),
        );
        win1.webContents.reloadIgnoringCache();
      });
      return loadImgInWindow(win1, versionedUrl);
    },
  );

  const win3 = await createHiddenWindow(pagePath, `${scheme}-win3`);
  const freshWindow = await record(
    'post-clear-fresh-window',
    '新規windowで同一URL（ファイルなし）',
    () => loadImgInWindow(win3, versionedUrl),
  );

  // ファイルを復元し、r付きURL（表示回復経路）で取り直せるか
  fs.writeFileSync(assetFilePath, createTestPng());
  const recoveryAfterClear = await record(
    'post-clear-recovery-with-r',
    'ファイル復元後、r付きURLで再取得',
    () =>
      loadImgInWindow(win3, buildUrl(scheme, {
        version: VERSION,
        recoveryToken: crypto.randomBytes(16).toString('base64url'),
      })),
  );

  win3.destroy();

  return {
    steps,
    findings: [
      {
        name: '新規windowはclearCache後にhandlerへ到達する',
        required: true,
        ok: freshWindow.delta >= 1,
        detail: `hits=${freshWindow.delta} imgOk=${freshWindow.result?.ok}（ファイル削除済みなので404=imgOk:false が期待値）`,
      },
      {
        name: 'clearCache後もr付きURLで再取得できる',
        required: true,
        ok: recoveryAfterClear.delta >= 1 && recoveryAfterClear.result?.ok === true,
        detail: `hits=${recoveryAfterClear.delta} imgOk=${recoveryAfterClear.result?.ok}`,
      },
      {
        name: '参考: document再読込後はhandlerへ到達するか',
        required: false,
        ok: afterReload.delta >= 1,
        detail: `hits=${afterReload.delta} imgOk=${afterReload.result?.ok}`,
      },
      {
        name: '参考: reloadIgnoringCache後はhandlerへ到達するか',
        required: false,
        ok: afterHardReload.delta >= 1,
        detail: `hits=${afterHardReload.delta} imgOk=${afterHardReload.result?.ok}`,
      },
      {
        name: '参考: 同一documentでは古い画像が残るか（受容済みの既知挙動）',
        required: false,
        ok: sameDocument.delta === 0 && sameDocument.result?.ok === true,
        detail: `hits=${sameDocument.delta} imgOk=${sameDocument.result?.ok}`,
      },
    ],
  };
}

app.on('window-all-closed', () => {});

app
  .whenReady()
  .then(async () => {
    if (preReadyStartupError) {
      // 設計3.5 と同じく、ready前の登録失敗は保持して ready 直後に扱う。
      throw preReadyStartupError;
    }

    const lines = [];
    const print = (line) => {
      lines.push(line);
      console.log(line);
    };

    fs.mkdirSync(path.join(assetsRoot, GRADE), { recursive: true });
    fs.writeFileSync(assetFilePath, createTestPng());
    const pagePath = path.join(tempRoot, 'spike.html');
    fs.writeFileSync(pagePath, PAGE_HTML);

    registerHandler(PRIMARY_SCHEME);
    registerHandler(FALLBACK_SCHEME);

    const results = [await runSequence(PRIMARY_SCHEME, pagePath)];

    // 主schemeでURLを解釈できなかった場合だけ、standard付きで原因を切り分ける。
    if (!results[0].coldOk) {
      results.push(await runSequence(FALLBACK_SCHEME, pagePath));
    }

    // clearCache 後の到達判定は renderer プロセス単位で分かれるため、常に切り分けまで行う。
    for (const result of results) {
      result.postClear = await runPostClearDiagnostics(
        result.scheme,
        pagePath,
        result.win1,
      );
      result.win1.destroy();
      delete result.win1;
    }

    print('=== 環境 ===');
    print(`  electron: ${process.versions.electron}`);
    print(`  chrome:   ${process.versions.chrome}`);
    print(`  node:     ${process.versions.node}`);
    print(`  platform: ${process.platform} ${process.arch}`);
    print(`  userData: ${userDataDir}`);

    let hasFailure = false;
    for (const result of results) {
      print(`\n=== scheme: ${result.scheme}:// ===`);
      for (const step of result.steps) {
        const detail =
          step.result && typeof step.result === 'object'
            ? JSON.stringify(step.result)
            : String(step.result);
        print(`  handler到達=${step.handlerHits}  ${step.name} (${step.note})`);
        print(`      result: ${detail}`);
      }
      print(`  --- 必須条件 (${result.scheme}) ---`);
      for (const check of result.requiredChecks) {
        const mark = check.ok ? 'PASS' : 'FAIL';
        // 主scheme が使えず fallback で確認した場合も、主scheme側のFAILは失敗として扱う。
        if (!check.ok) hasFailure = true;
        print(`  [${mark}] ${check.name}: ${check.detail}`);
      }
      if (!result.coldOk) {
        hasFailure = true;
        print(`  [FAIL] コールド初回読み込み: ${JSON.stringify(result.steps[0]?.result)}`);
      }

      if (result.postClear) {
        print(`  --- clearCache後の切り分け (${result.scheme}) ---`);
        for (const step of result.postClear.steps) {
          print(`  handler到達=${step.handlerHits}  ${step.name} (${step.note})`);
          print(`      result: ${JSON.stringify(step.result)}`);
        }
        for (const finding of result.postClear.findings) {
          if (finding.required) {
            if (!finding.ok) hasFailure = true;
            print(`  [${finding.ok ? 'PASS' : 'FAIL'}] ${finding.name}: ${finding.detail}`);
          } else {
            print(`  [${finding.ok ? 'YES ' : 'NO  '}] ${finding.name}: ${finding.detail}`);
          }
        }
      }
    }

    print(`\nhandler到達ログ件数: ${hitLog.length}`);
    print(hasFailure ? '\n結果: FAIL（本体実装を止めて要判断）' : '\n結果: PASS');

    const summaryPath = path.join(tempRoot, 'summary.txt');
    const jsonPath = path.join(tempRoot, 'result.json');
    fs.writeFileSync(summaryPath, `${lines.join('\n')}\n`);
    fs.writeFileSync(
      jsonPath,
      `${JSON.stringify(
        {
          versions: {
            electron: process.versions.electron,
            chrome: process.versions.chrome,
            node: process.versions.node,
          },
          platform: `${process.platform} ${process.arch}`,
          results,
          hitLog,
        },
        null,
        2,
      )}\n`,
    );
    console.log(`\nsummary: ${summaryPath}`);
    console.log(`json:    ${jsonPath}`);

    setTimeout(() => app.exit(hasFailure ? 1 : 0), 50);
  })
  .catch((e) => {
    console.error(e);
    app.exit(1);
  });
