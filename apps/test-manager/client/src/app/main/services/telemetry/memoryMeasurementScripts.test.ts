import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  assertDirectChild,
  getMeasurementPaths,
  parseMeasurementArgs,
} = require('../../../../../scripts/memoryMeasurementPaths.cjs');
const {
  prepareMeasurement,
} = require('../../../../../scripts/prepareMemoryMeasurement.cjs');
const {
  createAttemptDirectory,
  createMeasurementEnvironment,
} = require('../../../../../scripts/runMemoryMeasurement.cjs');

describe('memory measurement scripts', () => {
  it('accepts only the fixed phase and run arguments', () => {
    expect(parseMeasurementArgs(['--phase', 'before', '--run', '2'])).toEqual({
      phase: 'before',
      run: '2',
    });
    expect(() =>
      parseMeasurementArgs(['--phase', 'other', '--run', '2']),
    ).toThrow();
    expect(() =>
      parseMeasurementArgs(['--phase', 'before', '--run', '4']),
    ).toThrow();
    expect(() =>
      parseMeasurementArgs(['--phase', 'before', '--run', '../1']),
    ).toThrow();
  });

  it('rejects paths that are not the named direct child', () => {
    const root = path.resolve('measurement-root');
    expect(
      assertDirectChild(root, path.join(root, 'before-run-1'), 'before-run-1'),
    ).toBe(path.join(root, 'before-run-1'));
    expect(() =>
      assertDirectChild(root, path.join(root, '..', 'outside'), 'outside'),
    ).toThrow();
    expect(() =>
      assertDirectChild(
        root,
        path.join(root, 'nested', 'before-run-1'),
        'before-run-1',
      ),
    ).toThrow();
  });

  it('prepares only the selected run profile', () => {
    const fakeFs = {
      rmSync: vi.fn(),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
    };
    const selected = getMeasurementPaths('after', '3');

    prepareMeasurement(['--phase', 'after', '--run', '3'], fakeFs);

    expect(fakeFs.rmSync).toHaveBeenCalledOnce();
    expect(fakeFs.rmSync).toHaveBeenCalledWith(selected.profileDir, {
      recursive: true,
      force: true,
    });
    expect(fakeFs.mkdirSync).toHaveBeenCalledWith(selected.profileDir, {
      recursive: true,
    });
  });

  it('assigns different profile and result roots to each run', () => {
    const first = getMeasurementPaths('before', '1');
    const second = getMeasurementPaths('before', '2');
    expect(first.profileDir).not.toBe(second.profileDir);
    expect(first.runResultsRoot).not.toBe(second.runResultsRoot);
  });

  it('never overwrites an existing result attempt', () => {
    const runResultsRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'memory-measurement-test-'),
    );
    const timestamp = new Date('2026-07-29T00:00:00.000Z');
    try {
      createAttemptDirectory(runResultsRoot, timestamp);
      expect(() => createAttemptDirectory(runResultsRoot, timestamp)).toThrow();
    } finally {
      fs.rmSync(runResultsRoot, { recursive: true, force: true });
    }
  });

  it('always disables the UI agent port for measurement launches', () => {
    const paths = getMeasurementPaths('after', '1');
    const env = createMeasurementEnvironment(
      { ...paths, attemptDir: path.join(paths.runResultsRoot, 'attempt-test') },
      'after',
      '1',
      'measurement-commit',
      {
        demo_UI_AGENT_PORT: '9222',
        demo_UI_AGENT_ACTIVE: '1',
      },
    );

    expect(env.demo_UI_AGENT_PORT).toBe('');
    expect(env.demo_UI_AGENT_ACTIVE).toBe('');
    expect(env.MEMORY_PROBE_COMMIT).toBe('measurement-commit');
  });
});
