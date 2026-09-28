// 要素をクリックする書き込みコマンド。安全弁は session.withTarget が適用する。

const { resolveLocator, withTarget } = require('../session.cjs');

const run = async (args) =>
  withTarget('click', args, async ({ page }) => {
    const { locator, description } = await resolveLocator(page, args);
    const urlBefore = page.url();

    await locator.click(
      args['timeout-ms'] ? { timeout: Number(args['timeout-ms']) } : {},
    );

    // 操作後の画面は snapshot を取り直して確認する。ここでは遷移有無のみ返す。
    return {
      action: 'click',
      element: description,
      urlBefore,
      urlAfter: page.url(),
    };
  });

module.exports = { run };
