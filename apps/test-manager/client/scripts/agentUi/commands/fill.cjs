// 入力欄へ値を設定する書き込みコマンド。安全弁は session.withTarget が適用する。

const { AgentUiError, EXIT } = require('../runtime.cjs');
const { resolveLocator, withTarget } = require('../session.cjs');

const run = async (args) => {
  if (typeof args.value !== 'string') {
    throw new AgentUiError(
      'usage',
      EXIT.UNEXPECTED,
      'fill には --value が必要です。',
    );
  }

  return withTarget('fill', args, async ({ page }) => {
    const { locator, description } = await resolveLocator(page, args);
    await locator.fill(
      args.value,
      args['timeout-ms'] ? { timeout: Number(args['timeout-ms']) } : {},
    );
    return { action: 'fill', element: description, url: page.url() };
  });
};

module.exports = { run };
