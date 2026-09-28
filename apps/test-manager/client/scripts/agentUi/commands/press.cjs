// キー入力を送る書き込みコマンド。要素指定は任意で、無い場合はページ全体へ送る。

const { AgentUiError, EXIT } = require('../runtime.cjs');
const { resolveLocator, withTarget } = require('../session.cjs');

const run = async (args) => {
  if (!args.key) {
    throw new AgentUiError(
      'usage',
      EXIT.UNEXPECTED,
      'press には --key が必要です（例: Enter, Escape, Control+S）。',
    );
  }

  return withTarget('press', args, async ({ page }) => {
    const scoped = Boolean(
      args.role || args.testid || args.selector || args.text,
    );
    if (!scoped) {
      await page.keyboard.press(args.key);
      return { action: 'press', key: args.key, element: null, url: page.url() };
    }

    const { locator, description } = await resolveLocator(page, args);
    await locator.press(
      args.key,
      args['timeout-ms'] ? { timeout: Number(args['timeout-ms']) } : {},
    );
    return {
      action: 'press',
      key: args.key,
      element: description,
      url: page.url(),
    };
  });
};

module.exports = { run };
