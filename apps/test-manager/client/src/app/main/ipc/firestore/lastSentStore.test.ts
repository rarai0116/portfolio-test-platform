import { describe, expect, it } from 'vitest';
import { LastSentStore } from './lastSentStore';

describe('LastSentStore', () => {
  it('shouldSend works with increasing versions', () => {
    const store = new LastSentStore();
    const win = 1;
    const path = 'a/b';

    expect(store.shouldSend(win, path, { seconds: 1, nanos: 0 })).toBe(true);
    // older
    expect(store.shouldSend(win, path, { seconds: 0, nanos: 999 })).toBe(false);
    // same
    expect(store.shouldSend(win, path, { seconds: 1, nanos: 0 })).toBe(false);
    // newer nanos
    expect(store.shouldSend(win, path, { seconds: 1, nanos: 1 })).toBe(true);
  });

  it('clearWindow clears cache', () => {
    const store = new LastSentStore();
    const win = 2;
    const path = 'c/d';
    expect(store.shouldSend(win, path, { seconds: 1, nanos: 0 })).toBe(true);
    store.clearWindow(win);
    // クリア後は再び送れる
    expect(store.shouldSend(win, path, { seconds: 1, nanos: 0 })).toBe(true);
  });
});
