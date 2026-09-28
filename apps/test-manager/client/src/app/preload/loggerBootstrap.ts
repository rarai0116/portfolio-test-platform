import { installConsoleOverride } from '@shared/services/installConsoleOverride';
import { getLoggerPolicy } from '@shared/services/logPolicy';
import { preloadLog } from './loggerCore';

const policy = getLoggerPolicy('preload');

installConsoleOverride(preloadLog.functions, policy);
