// アクセシビリティツリーの要約を返す読み取り専用コマンド。
// role と name が分かるため、click / fill の対象指定と対応が取れる。
//
// 画面によっては数 MB になる（例: 一覧が数千件ある開発用画面）。エージェントの
// コンテキストを溢れさせないため既定で切り詰め、切り詰めた事実を必ず出力に載せる。

const { resolveLocator, withTarget } = require('../session.cjs');

const DEFAULT_MAX_CHARS = 20_000;

const run = async (args) =>
  withTarget('snapshot', args, async ({ page }) => {
    const scoped = args.selector || args.role || args.testid || args.text;
    const { locator, description } = scoped
      ? await resolveLocator(page, args)
      : { locator: page.locator('body'), description: 'body' };

    const full = await locator.ariaSnapshot();
    const maxChars = args['max-chars']
      ? Number(args['max-chars'])
      : DEFAULT_MAX_CHARS;
    const truncated = full.length > maxChars;

    return {
      scope: description,
      totalChars: full.length,
      truncated,
      ...(truncated
        ? {
            hint: '--selector で範囲を絞るか --max-chars で上限を変更する。全体を見たと判断しないこと',
          }
        : {}),
      snapshot: truncated ? full.slice(0, maxChars) : full,
    };
  });

module.exports = { run };
