import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveUserDataPath } from './userDataPath';

describe('resolveUserDataPath', () => {
  it('keeps the existing application data path when measurement is disabled', () => {
    const appDataPath = path.resolve('app-data');
    expect(
      resolveUserDataPath({
        measurementEnabled: false,
        measurementPath: 'invalid-relative-path',
        appDataPath,
      }),
    ).toBe(path.join(appDataPath, 'demoTestManager'));
  });

  it('accepts only an absolute measurement profile path', () => {
    const appDataPath = path.resolve('app-data');
    const profilePath = path.resolve(
      '_tmp',
      'memory-measurement',
      'profiles',
      'before-run-1',
    );
    expect(
      resolveUserDataPath({
        measurementEnabled: true,
        measurementPath: profilePath,
        appDataPath,
      }),
    ).toBe(profilePath);
    expect(() =>
      resolveUserDataPath({
        measurementEnabled: true,
        measurementPath: 'profiles/before-run-1',
        appDataPath,
      }),
    ).toThrow();
    expect(() =>
      resolveUserDataPath({
        measurementEnabled: true,
        measurementPath: path.resolve('outside'),
        appDataPath,
      }),
    ).toThrow();
  });
});
