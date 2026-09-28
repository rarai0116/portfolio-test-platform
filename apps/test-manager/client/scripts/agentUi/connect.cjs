// CDP 接続と操作対象ウィンドウの解決。
// 起動済み Electron へアタッチするだけで、アプリの起動や停止は行わない。

const {
  START_APP_ACTIONS,
  preconditionError,
  resolveEndpoint,
  targetError,
} = require('./runtime.cjs');

const AGENT_ENV_MARKER_KEY = '__demo_AGENT_ENV__';

async function importPlaywright() {
  try {
    return await import('playwright');
  } catch (error) {
    try {
      return await import('@playwright/test');
    } catch (fallbackError) {
      throw preconditionError(
        [
          'playwright を読み込めませんでした。apps/client で依存関係が利用できる状態か確認してください。',
          `playwright: ${error.message}`,
          `@playwright/test: ${fallbackError.message}`,
        ].join('\n'),
      );
    }
  }
}

async function connect() {
  const endpoint = resolveEndpoint();
  const { chromium } = await importPlaywright();
  try {
    const browser = await chromium.connectOverCDP(endpoint);
    return { browser, endpoint };
  } catch (error) {
    throw preconditionError(
      `CDP エンドポイントへ接続できませんでした (${endpoint}): ${error.message}`,
      START_APP_ACTIONS,
    );
  }
}

// URL からウィンドウ種別を判定する。判定できないものは main 扱いにせず other とする。
const classifyPage = (url) => {
  if (url.includes('createPdfPreviewWindow')) return 'preview';
  if (url.includes('#/auth')) return 'auth';
  if (url.startsWith('devtools://') || url === 'about:blank') return 'internal';
  if (url.startsWith('http') || url.startsWith('file://')) return 'main';
  return 'other';
};

const listPages = (browser) =>
  browser
    .contexts()
    .flatMap((context) => context.pages())
    .map((page) => ({ page, url: page.url(), kind: classifyPage(page.url()) }))
    .filter((entry) => entry.kind !== 'internal');

const resolveTarget = (entries, target) => {
  const spec = target ?? 'main';
  const matched = spec.startsWith('url:')
    ? entries.filter((entry) => entry.url.includes(spec.slice('url:'.length)))
    : entries.filter((entry) => entry.kind === spec);

  if (matched.length === 0) {
    throw targetError(
      `対象ウィンドウが見つかりませんでした: ${spec}`,
      [
        `検出したウィンドウ: ${entries.map((e) => `${e.kind}(${e.url})`).join(', ') || '(none)'}`,
        '対象の画面を開いた状態で再実行する',
      ],
    );
  }
  if (matched.length > 1) {
    throw targetError(
      `対象ウィンドウが複数一致しました: ${spec}`,
      [`候補: ${matched.map((e) => e.url).join(', ')}`, 'url: 指定で絞り込む'],
    );
  }
  return matched[0];
};

// preload が公開する読み取り専用マーカー。取得できない場合は null（unknown 扱い）。
const readEnvMarker = async (page) =>
  page
    .evaluate((key) => globalThis[key] ?? null, AGENT_ENV_MARKER_KEY)
    .catch(() => null);

// Step 1 では emulator かどうかまでを判定する。
// staging と production の区別は projectId との対応表が必要なため Step 2 で確定させる。
const classifyEnv = (marker) => {
  if (!marker) return 'unknown';
  return marker.useFirebaseEmulator ? 'emulator' : 'non-emulator';
};

module.exports = {
  AGENT_ENV_MARKER_KEY,
  classifyEnv,
  classifyPage,
  connect,
  listPages,
  readEnvMarker,
  resolveTarget,
};
