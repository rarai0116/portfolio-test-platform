export type ConsoleLevel = 'info' | 'warn' | 'error';
type ConsoleOutput = Pick<Console, 'log' | 'info' | 'warn' | 'error'>;
const priorities = {info: 0, warn: 1, error: 2} as const;

// ログの文字列化前に、参照構造と認証情報を出力から除く。
export function summarizeConsoleValue(value: unknown): unknown {
  const redact = (text: string) =>
    text
      .replace(
        /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]*)?/g,
        '[token]',
      )
      .replace(/([?&]token=)[^\s&#]+/gi, '$1[redacted]')
      .slice(0, 4000);
  if (typeof value === 'string') return redact(value);
  if (value instanceof Error) {
    return redact(`${value.name}: ${value.message}\n${value.stack ?? ''}`);
  }
  if (Array.isArray(value)) return `件数=${value.length}`;
  if (value instanceof Map || value instanceof Set) return `件数=${value.size}`;
  if (value !== null && typeof value === 'object')
    return `キー数=${Object.keys(value).length}`;
  if (typeof value === 'function') return '[function]';
  return value;
}

export function createConsoleController(
  output: ConsoleOutput,
  importantEventsEnabled = true,
) {
  let level: ConsoleLevel = 'info';
  const filtered =
    (method: keyof ConsoleOutput) =>
    (...args: unknown[]) => {
      if (
        method === 'log'
          ? !importantEventsEnabled
          : priorities[method] < priorities[level]
      )
        return;
      output[method](...args.map(summarizeConsoleValue));
    };
  return {
    console: {
      log: filtered('log'),
      info: filtered('info'),
      warn: filtered('warn'),
      error: filtered('error'),
    },
    getLevel: () => level,
    setLevel(next: ConsoleLevel) {
      if (!Object.hasOwn(priorities, next))
        throw new Error('表示レベルはinfo / warn / errorを指定してください');
      level = next;
    },
  };
}
