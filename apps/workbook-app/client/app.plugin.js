const fs = require('node:fs');
const path = require('node:path');
const {withDangerousMod} = require('expo/config-plugins');

module.exports = function withPodfileUpdate(config) {
  return withDangerousMod(config, [
    'ios',
    async (c) => {
      const podfilePath = path.join(
        c.modRequest.platformProjectRoot,
        'Podfile',
      );
      let contents = fs.readFileSync(podfilePath, 'utf8');

      // Hermes 強制
      const HERMES_ENV_LINE = "ENV['USE_HERMES'] = '1'";
      if (!contents.includes(HERMES_ENV_LINE)) {
        const platformLineRegex = /^\s*platform\s*:ios[^\n]*\n/m;
        if (platformLineRegex.test(contents)) {
          contents = contents.replace(
            platformLineRegex,
            (m) => `${m}${HERMES_ENV_LINE}\n`,
          );
        } else {
          const requireBlockRegex = /^(?:require .*\n)+/m;
          contents = requireBlockRegex.test(contents)
            ? contents.replace(
                requireBlockRegex,
                (m) => `${m}${HERMES_ENV_LINE}\n`,
              )
            : `${HERMES_ENV_LINE}\n${contents}`;
        }
      }

      // :hermes_enabled を true に強制
      contents = contents.replace(
        /(:hermes_enabled\s*=>\s*)([^,\n]+)(\s*,)/,
        (_m, p1, _p2, p3) => `${p1}true${p3}`,
      );

      // NOTE: 非推奨の non-modular include 設定は挿入しない

      fs.writeFileSync(podfilePath, contents);
      return c;
    },
  ]);
};
