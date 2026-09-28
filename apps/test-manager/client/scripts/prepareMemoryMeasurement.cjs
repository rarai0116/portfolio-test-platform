const fs = require('node:fs');
const {
  getMeasurementPaths,
  parseMeasurementArgs,
} = require('./memoryMeasurementPaths.cjs');

function prepareMeasurement(argv, fileSystem = fs) {
  const { phase, run } = parseMeasurementArgs(argv);
  const paths = getMeasurementPaths(phase, run);

  // 削除対象は検証済みの profiles 直下1ディレクトリだけに限定する。
  fileSystem.rmSync(paths.profileDir, { recursive: true, force: true });
  fileSystem.mkdirSync(paths.profileDir, { recursive: true });
  fileSystem.writeFileSync(
    `${paths.profileDir}/.memory-measurement-profile.json`,
    `${JSON.stringify({ phase, run }, null, 2)}\n`,
    'utf8',
  );

  return paths;
}

if (require.main === module) {
  try {
    const paths = prepareMeasurement(process.argv.slice(2));
    console.log(`Prepared measurement profile: ${paths.profileDir}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = { prepareMeasurement };
