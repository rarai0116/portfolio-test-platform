// ネイティブ <select> の選択肢を選ぶ書き込みコマンド。
//
// このアプリは Radix Select や react-select を多用しており、それらは <select> ではないため
// このコマンドでは操作できない。その場合は click でトリガーを開き、click で選択肢を選ぶ。

const { AgentUiError, EXIT } = require('../runtime.cjs');
const { resolveLocator, withTarget } = require('../session.cjs');

const run = async (args) => {
  if (typeof args.value !== 'string') {
    throw new AgentUiError(
      'usage',
      EXIT.UNEXPECTED,
      'select には --value が必要です。',
    );
  }

  return withTarget('select', args, async ({ page }) => {
    const { locator, description } = await resolveLocator(page, args);
    const selected = await locator.selectOption(
      args.value,
      args['timeout-ms'] ? { timeout: Number(args['timeout-ms']) } : {},
    );
    return {
      action: 'select',
      element: description,
      selected,
      url: page.url(),
    };
  });
};

module.exports = { run };
