type EmulatorSettings = {
  APP_ENV?: unknown;
  USE_FIREBASE_EMULATOR?: unknown;
  FIREBASE_EMULATOR_HOST?: unknown;
};

/** ADB経由のローカル接続で、StorageがAndroid向けに変換したホストを戻す。 */
export const normalizeAssetDownloadUrl = (
  uri: string,
  settings: EmulatorSettings,
): string => {
  if (
    settings.APP_ENV !== 'local' ||
    settings.USE_FIREBASE_EMULATOR !== true ||
    settings.FIREBASE_EMULATOR_HOST !== '127.0.0.1'
  ) {
    return uri;
  }
  return uri.replace(
    /^http:\/\/10\.0\.2\.2:9699(?=\/v0\/b\/)/,
    'http://127.0.0.1:9699',
  );
};
