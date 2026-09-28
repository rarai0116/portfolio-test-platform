// コマンド共通の実行枠。接続 → 対象解決 → 環境判定 → 安全弁 → 本処理 → 切断 の順を固定する。
// 安全弁を通らない実行経路を作らないため、書き込み系コマンドは必ずこの枠を経由させる。

const {
  classifyEnv,
  connect,
  listPages,
  readEnvMarker,
  resolveTarget,
} = require('./connect.cjs');
const { assertWriteAllowed } = require('./guard.cjs');
const { targetError } = require('./runtime.cjs');

const withTarget = async (command, args, handler) => {
  const { browser } = await connect();
  try {
    const entries = listPages(browser);
    const target = resolveTarget(entries, args.target);
    const marker = await readEnvMarker(target.page);
    const env = classifyEnv(marker);

    assertWriteAllowed({ command, env, allowEnv: args['allow-env'] });

    const result = await handler({
      page: target.page,
      target,
      entries,
      env,
      marker,
    });
    return { env, target: { kind: target.kind, url: target.page.url() }, ...result };
  } finally {
    await browser.close();
  }
};

const SELECTOR_HINT = [
  '--role <role> [--name <name>] / --testid <id> / --selector <css> / --text <text> のいずれか 1 つを指定する',
  'まず snapshot で role と name を確認する',
];

// 要素の指定方法は 1 つだけ受け付ける。曖昧な指定のまま操作させない。
const resolveLocator = async (page, args) => {
  const given = ['role', 'testid', 'selector', 'text'].filter(
    (key) => args[key],
  );
  if (given.length === 0) {
    throw targetError('要素の指定がありません。', SELECTOR_HINT);
  }
  if (given.length > 1) {
    throw targetError(
      `要素の指定が重複しています: ${given.join(', ')}`,
      SELECTOR_HINT,
    );
  }

  let locator;
  let description;
  if (args.role) {
    locator = page.getByRole(args.role, args.name ? { name: args.name } : {});
    description = `role=${args.role}${args.name ? ` name=${args.name}` : ''}`;
  } else if (args.testid) {
    locator = page.getByTestId(args.testid);
    description = `testid=${args.testid}`;
  } else if (args.selector) {
    locator = page.locator(args.selector);
    description = `selector=${args.selector}`;
  } else {
    locator = page.getByText(args.text);
    description = `text=${args.text}`;
  }

  const count = await locator.count();
  if (count === 0) {
    throw targetError(`要素が見つかりませんでした: ${description}`, [
      'snapshot を取り直して現在の画面を確認する',
      '憶測でセレクタを変えて連打しない',
    ]);
  }
  if (count > 1) {
    throw targetError(
      `要素が ${count} 件一致しました: ${description}`,
      ['--selector で一意に絞り込む', 'snapshot で候補を確認する'],
    );
  }

  return { locator, description };
};

module.exports = { resolveLocator, withTarget };
