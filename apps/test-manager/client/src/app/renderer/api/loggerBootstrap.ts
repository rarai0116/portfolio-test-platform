import { installConsoleOverride } from '@shared/services/installConsoleOverride';
import { getLoggerPolicy } from '@shared/services/logPolicy';
import { rendererLog } from './loggerCore';

const policy = getLoggerPolicy('renderer');

installConsoleOverride(rendererLog.functions, policy);
