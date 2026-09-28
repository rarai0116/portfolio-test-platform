import type { LoggerPolicy, LoggerRuntime } from '@shared/types/logger';

const readProcessEnv = (key: string): string | undefined => {
  if (typeof process === 'undefined') return undefined;
  return process.env?.[key];
};

const readImportMetaEnv = (key: string): unknown => {
  if (typeof import.meta === 'undefined') return undefined;
  return import.meta.env?.[key];
};

const isProduction =
  readProcessEnv('NODE_ENV') === 'production' ||
  readImportMetaEnv('PROD') === true ||
  readImportMetaEnv('MODE') === 'production' ||
  readImportMetaEnv('MODE') === 'prod';

const isTest =
  readProcessEnv('VITEST') === 'true' || readImportMetaEnv('MODE') === 'test';

const isCi =
  readProcessEnv('CI') === 'true' ||
  readImportMetaEnv('CI') === true ||
  readImportMetaEnv('CI') === 'true';

export const getLoggerPolicy = (runtime: LoggerRuntime): LoggerPolicy => {
  if (isTest || isCi) {
    return {
      minLevel: 'silent',
      overrideConsole: false,
      allowConsoleWarn: false,
      allowConsoleError: false,
    };
  }

  if (isProduction) {
    return {
      minLevel: 'warn',
      overrideConsole: true,
      allowConsoleWarn: true,
      allowConsoleError: true,
    };
  }

  // development
  if (runtime === 'main') {
    return {
      minLevel: 'debug',
      overrideConsole: true,
      allowConsoleWarn: true,
      allowConsoleError: true,
    };
  }

  // renderer / preload は DevTools の元ソース位置を保つため上書きしない
  return {
    minLevel: 'debug',
    overrideConsole: false,
    allowConsoleWarn: true,
    allowConsoleError: true,
  };
};
