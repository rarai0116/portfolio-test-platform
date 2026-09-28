// 対象ウィンドウの現在状態を返す読み取り専用コマンド。アプリの状態は変更しない。

const {
  classifyEnv,
  connect,
  listPages,
  readEnvMarker,
  resolveTarget,
} = require('../connect.cjs');

// ログイン有無のみを返す。メールアドレスや uid などの個人情報は取得しない。
const readAuthState = async (page) =>
  page
    .evaluate(() => {
      const auth = globalThis.__FIREBASE_AUTH__;
      if (!auth) return { available: false, signedIn: null };
      return { available: true, signedIn: Boolean(auth.currentUser) };
    })
    .catch(() => ({ available: false, signedIn: null }));

const run = async (args) => {
  const { browser } = await connect();
  try {
    const entries = listPages(browser);
    const target = resolveTarget(entries, args.target);
    const marker = await readEnvMarker(target.page);
    const url = target.page.url();
    const hashIndex = url.indexOf('#');

    return {
      env: classifyEnv(marker),
      projectId: marker?.projectId ?? null,
      target: {
        kind: target.kind,
        url,
        route: hashIndex >= 0 ? url.slice(hashIndex) : null,
        title: await target.page.title().catch(() => null),
      },
      auth: await readAuthState(target.page),
      windows: entries.map(({ kind, url: pageUrl }) => ({ kind, url: pageUrl })),
    };
  } finally {
    await browser.close();
  }
};

module.exports = { run };
