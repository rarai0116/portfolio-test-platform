const path = require('node:path');

const CLIENT_ROOT = path.resolve(__dirname, '..');
const MEASUREMENT_ROOT = path.join(
  CLIENT_ROOT,
  '_tmp',
  'memory-measurement',
);
const PROFILES_ROOT = path.join(MEASUREMENT_ROOT, 'profiles');
const RESULTS_ROOT = path.join(MEASUREMENT_ROOT, 'results');

function parseMeasurementArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith('--') || value === undefined) {
      throw new Error(
        'Usage: --phase before|after --run 1|2|3',
      );
    }
    values.set(name.slice(2), value);
  }

  const phase = values.get('phase');
  const run = values.get('run');
  if (
    values.size !== 2 ||
    !['before', 'after'].includes(phase) ||
    !['1', '2', '3'].includes(run)
  ) {
    throw new Error(
      'Usage: --phase before|after --run 1|2|3',
    );
  }

  return { phase, run };
}

function assertDirectChild(root, target, expectedName) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (
    path.dirname(resolvedTarget) !== resolvedRoot ||
    path.basename(resolvedTarget) !== expectedName
  ) {
    throw new Error(`Unsafe measurement path: ${resolvedTarget}`);
  }
  return resolvedTarget;
}

function getMeasurementPaths(phase, run) {
  const runName = `${phase}-run-${run}`;
  const profileDir = assertDirectChild(
    PROFILES_ROOT,
    path.join(PROFILES_ROOT, runName),
    runName,
  );
  const phaseResultsRoot = assertDirectChild(
    RESULTS_ROOT,
    path.join(RESULTS_ROOT, phase),
    phase,
  );
  const runResultsRoot = assertDirectChild(
    phaseResultsRoot,
    path.join(phaseResultsRoot, `run-${run}`),
    `run-${run}`,
  );
  return {
    clientRoot: CLIENT_ROOT,
    measurementRoot: MEASUREMENT_ROOT,
    profilesRoot: PROFILES_ROOT,
    resultsRoot: RESULTS_ROOT,
    profileDir,
    phaseResultsRoot,
    runResultsRoot,
    runName,
  };
}

module.exports = {
  assertDirectChild,
  getMeasurementPaths,
  parseMeasurementArgs,
};
