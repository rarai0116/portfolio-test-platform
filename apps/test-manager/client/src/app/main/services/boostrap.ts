import { mkdirSync } from 'node:fs';
import { resolveUserDataPath } from '@main/services/userDataPath';
import { app } from 'electron';

const APP_DIR_NAME = 'demoTestManager';

// 表示名（任意）
app.setName(APP_DIR_NAME);

// userData を固定（重要）
app.setPath(
  'userData',
  resolveUserDataPath({
    measurementEnabled: process.env.MEMORY_PROBE === '1',
    measurementPath: process.env.MEMORY_PROBE_USER_DATA_DIR,
    appDataPath: app.getPath('appData'),
  }),
);

// 親ディレクトリを作成
mkdirSync(app.getPath('userData'), { recursive: true });
