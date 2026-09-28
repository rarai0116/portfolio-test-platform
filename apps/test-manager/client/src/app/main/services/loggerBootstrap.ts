import { installConsoleOverride } from '@shared/services/installConsoleOverride';
import { getLoggerPolicy } from '@shared/services/logPolicy';
import { mainLog } from './loggerCore';

const policy = getLoggerPolicy('main');

installConsoleOverride(mainLog.functions, policy);

// main の致命的エラーはログに残す
mainLog.errorHandler.startCatching();
