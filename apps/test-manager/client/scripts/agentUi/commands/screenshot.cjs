// 画面キャプチャを保存する読み取り専用コマンド。
// 出力には問題データが写るため、保存先は gitignore 済みの _tmp 配下を既定とする。
/** biome-ignore-all lint/style/useNodejsImportProtocol: 既存 scripts の記法に合わせる */

const path = require('path');

const { ensureOutDir } = require('../runtime.cjs');
const { resolveLocator, withTarget } = require('../session.cjs');

// ファイル名の衝突を避けつつ、実行のたびに増え続けないよう対象種別で固定する。
const buildFileName = (target, scoped) =>
  `${target.kind}${scoped ? '-scoped' : ''}.png`;

const run = async (args) =>
  withTarget('screenshot', args, async ({ page, target }) => {
    const outDir = ensureOutDir(args.out);
    const scoped = Boolean(
      args.selector || args.role || args.testid || args.text,
    );
    const filePath = path.join(outDir, buildFileName(target, scoped));

    if (scoped) {
      const { locator, description } = await resolveLocator(page, args);
      await locator.screenshot({ path: filePath });
      return { scope: description, path: filePath };
    }

    await page.screenshot({ path: filePath, fullPage: Boolean(args['full-page']) });
    return {
      scope: args['full-page'] ? 'full-page' : 'viewport',
      path: filePath,
    };
  });

module.exports = { run };
