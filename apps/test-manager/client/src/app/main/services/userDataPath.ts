import path from 'node:path';

const APP_DIR_NAME = 'demoTestManager';

export function resolveUserDataPath(options: {
  measurementEnabled: boolean;
  measurementPath: string | undefined;
  appDataPath: string;
}): string {
  if (!options.measurementEnabled) {
    return path.join(options.appDataPath, APP_DIR_NAME);
  }

  if (!options.measurementPath || !path.isAbsolute(options.measurementPath)) {
    throw new Error(
      'MEMORY_PROBE_USER_DATA_DIR must be an absolute path in measurement mode.',
    );
  }
  const resolved = path.resolve(options.measurementPath);
  if (
    path.basename(path.dirname(resolved)) !== 'profiles' ||
    !/^(before|after)-run-[123]$/.test(path.basename(resolved))
  ) {
    throw new Error(`Invalid memory measurement userData path: ${resolved}`);
  }
  return resolved;
}
