module.exports = function(api) {
  // console 除去の有無で結果が変わるため、env をキャッシュキーに含める
  // (従来の api.cache(true) だと環境を切り替えても再評価されない)
  api.cache.using(
    () => `${process.env.NODE_ENV}:${process.env.STRIP_CONSOLE}`,
  );

  // 開発時の重要イベントは常時表示する。開発中の抑制はappConsoleで行う。
  // 本番のlog/info除去は維持し、error/warnは残す。
  const stripConsole = process.env.NODE_ENV === 'production';

  const plugins = [
    'react-native-worklets/plugin',
    '@babel/plugin-transform-export-namespace-from',
    ['module-resolver', {
      root: ['./'],
      alias: {
        '@': './',
        '@assets': './assets',
        '@components': './components',
        '@pages': './components/pages',
        '@views': './components/views',
        '@organisms': './components/organisms',
        '@parts': './components/parts',
        '@identities': './components/identities',
        '@hooks': './components/hooks',
        '@functionals': './components/functionals',
      }
    }],
  ];

  if (stripConsole) {
    // error/warn は残す(Crashlytics等の手掛かり保持)
    plugins.push(['transform-remove-console', {exclude: ['error', 'warn']}]);
  }

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
