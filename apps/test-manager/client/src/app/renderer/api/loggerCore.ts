import { getLoggerPolicy } from '@shared/services/logPolicy';
import log from 'electron-log/renderer.js';

const policy = getLoggerPolicy('renderer');

log.transports.console.level =
  policy.minLevel === 'silent' ? false : policy.minLevel;

// renderer のログを main に転送
log.transports.ipc.level =
  policy.minLevel === 'silent' ? false : policy.minLevel;

export const rendererLog = log;
export const getRendererScope = (scope: string) => log.scope(scope);
