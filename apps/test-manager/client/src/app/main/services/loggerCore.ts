import path from 'node:path';
import { getLoggerPolicy } from '@shared/services/logPolicy';
import { app } from 'electron';
import log from 'electron-log/main.js';

const policy = getLoggerPolicy('main');

log.initialize();

log.transports.file.resolvePathFn = () =>
  path.join(app.getPath('userData'), 'logs', 'main.log');

log.transports.file.level =
  policy.minLevel === 'silent' ? false : policy.minLevel;

log.transports.console.level =
  policy.minLevel === 'silent' ? false : policy.minLevel;

// main から renderer 側へ逆流させない
log.transports.ipc.level = false;

export const mainLog = log;
export const getMainScope = (scope: string) => log.scope(scope);
