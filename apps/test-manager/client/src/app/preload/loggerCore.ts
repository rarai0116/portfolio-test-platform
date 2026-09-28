import { getLoggerPolicy } from '@shared/services/logPolicy';
import log from 'electron-log/renderer.js';

const policy = getLoggerPolicy('preload');

log.transports.console.level =
  policy.minLevel === 'silent' ? false : policy.minLevel;

log.transports.ipc.level =
  policy.minLevel === 'silent' ? false : policy.minLevel;

export const preloadLog = log;
export const getPreloadScope = (scope: string) => log.scope(scope);
