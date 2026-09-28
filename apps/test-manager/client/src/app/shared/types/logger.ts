export type AppLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type AppLogContext = Record<string, unknown>;

export type AppLogger = {
  debug: (message: string, context?: AppLogContext) => void;
  info: (message: string, context?: AppLogContext) => void;
  warn: (message: string, context?: AppLogContext) => void;
  error: (message: string, context?: AppLogContext) => void;
  child: (scope: string) => AppLogger;
};

export type LoggerRuntime = 'main' | 'renderer' | 'preload' | 'test';

export type LoggerPolicy = {
  minLevel: AppLogLevel | 'silent';
  overrideConsole: boolean;
  allowConsoleWarn: boolean;
  allowConsoleError: boolean;
};
