import { afterEach, beforeEach, vi } from 'vitest';

const unexpectedErrors: string[] = [];

export const installConsolePolicy = () => {
  beforeEach(() => {
    unexpectedErrors.length = 0;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      unexpectedErrors.push(args.map(String).join(' '));
    });
  });

  afterEach(() => {
    if (unexpectedErrors.length > 0) {
      throw new Error(
        ['Unexpected console.error detected:', ...unexpectedErrors].join('\n'),
      );
    }
  });
};
