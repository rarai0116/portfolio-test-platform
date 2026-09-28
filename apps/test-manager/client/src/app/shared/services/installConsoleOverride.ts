import type { LoggerPolicy } from '@shared/types/logger';

type ConsoleMethod = (...args: unknown[]) => void;

type ConsoleFunctions = Partial<
  Record<'log' | 'info' | 'debug' | 'warn' | 'error', ConsoleMethod>
>;

const noop: ConsoleMethod = () => {};

export const installConsoleOverride = (
  functions: ConsoleFunctions,
  policy: LoggerPolicy,
): void => {
  if (!policy.overrideConsole) return;
  console.log = functions.log ?? noop;
  console.info = functions.info ?? functions.log ?? noop;
  console.debug = functions.debug ?? functions.log ?? noop;
  console.warn = policy.allowConsoleWarn
    ? (functions.warn ?? functions.log ?? noop)
    : noop;
  console.error = policy.allowConsoleError
    ? (functions.error ?? functions.warn ?? functions.log ?? noop)
    : noop;
};
