import { describe, expect, it } from 'vitest';
import { shouldUseLocalAuthEmulator } from './authRuntimePolicy';

describe('shouldUseLocalAuthEmulator', () => {
  it('enables local authentication only for an unpackaged emulator process', () => {
    expect(
      shouldUseLocalAuthEmulator({
        isPackaged: false,
        useFirebaseEmulator: 'true',
      }),
    ).toBe(true);
  });

  it.each([
    { isPackaged: true, useFirebaseEmulator: 'true' },
    { isPackaged: false, useFirebaseEmulator: 'false' },
    { isPackaged: false, useFirebaseEmulator: undefined },
  ])('disables local authentication for %o', (input) => {
    expect(shouldUseLocalAuthEmulator(input)).toBe(false);
  });
});
