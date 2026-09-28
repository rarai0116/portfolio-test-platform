const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const {
  assertDirectChild,
  getMeasurementPaths,
  parseMeasurementArgs,
} = require('./memoryMeasurementPaths.cjs');

function createAttemptDirectory(runResultsRoot, now = new Date()) {
  const timestamp = now.toISOString().replaceAll(/[:.]/g, '-');
  const name = `attempt-${timestamp}`;
  const attemptDir = assertDirectChild(
    runResultsRoot,
    path.join(runResultsRoot, name),
    name,
  );
  fs.mkdirSync(attemptDir, { recursive: false });
  return attemptDir;
}

function createMeasurementEnvironment(
  paths,
  phase,
  run,
  commit,
  baseEnv = process.env,
) {
  return {
    ...baseEnv,
    NODE_ENV: 'production',
    DOTENV_CONFIG_PATH: path.join(paths.clientRoot, '.env'),
    USE_FIREBASE_EMULATOR: 'true',
    MEMORY_PROBE: '1',
    MEMORY_PROBE_PHASE: phase,
    MEMORY_PROBE_RUN: run,
    MEMORY_PROBE_COMMIT: commit,
    MEMORY_PROBE_USER_DATA_DIR: paths.profileDir,
    MEMORY_PROBE_OUTPUT_DIR: paths.attemptDir,
    // 空値を残し、Electron 側の dotenv 読み込みでも .env の設定を復活させない。
    demo_UI_AGENT_PORT: '',
    demo_UI_AGENT_ACTIVE: '',
  };
}

function runMeasurement(argv) {
  const { phase, run } = parseMeasurementArgs(argv);
  const paths = getMeasurementPaths(phase, run);
  const markerPath = path.join(
    paths.profileDir,
    '.memory-measurement-profile.json',
  );
  const builtMain = path.join(paths.clientRoot, 'out', 'main', 'index.js');

  if (!fs.existsSync(markerPath)) {
    throw new Error(
      `Measurement profile is not prepared. Run measure:prepare first: ${paths.profileDir}`,
    );
  }
  if (!fs.existsSync(builtMain)) {
    throw new Error(
      'Optimized build is missing. Run pnpm measure:build first.',
    );
  }

  fs.mkdirSync(paths.runResultsRoot, { recursive: true });
  const attemptDir = createAttemptDirectory(paths.runResultsRoot);
  const commitResult = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: paths.clientRoot,
    encoding: 'utf8',
  });
  const commit =
    commitResult.status === 0 ? commitResult.stdout.trim() : 'unknown';
  const electronPath = require('electron');
  const env = createMeasurementEnvironment(
    { ...paths, attemptDir },
    phase,
    run,
    commit,
  );
  delete env.ELECTRON_RUN_AS_NODE;

  console.log(`Measurement results: ${attemptDir}`);
  const child = spawn(electronPath, ['.', '--no-sandbox'], {
    cwd: paths.clientRoot,
    env,
    stdio: 'inherit',
  });
  child.once('error', (error) => {
    console.error(error);
    process.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    if (signal) {
      console.error(`Electron exited by signal: ${signal}`);
      process.exitCode = 1;
      return;
    }
    process.exitCode = code ?? 1;
  });
  return { attemptDir, child };
}

if (require.main === module) {
  try {
    runMeasurement(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = {
  createAttemptDirectory,
  createMeasurementEnvironment,
  runMeasurement,
};
