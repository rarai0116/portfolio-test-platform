import type { TelemetryWindowType } from '@shared/types/telemetry';
import type { BrowserWindow } from 'electron';
import { telemetryService } from './index';

const monitoredWindows = new WeakSet<BrowserWindow>();

export const attachWindowTelemetry = (
  window: BrowserWindow,
  windowType: TelemetryWindowType,
): void => {
  telemetryService.trackWindow(window, windowType);
  if (monitoredWindows.has(window)) return;

  monitoredWindows.add(window);

  window.webContents.on('render-process-gone', (_event, details) => {
    telemetryService.captureWindowEvent({
      windowId: window.id,
      reason: 'render-process-gone',
      errorMessage: JSON.stringify(details),
    });
  });

  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL) => {
      telemetryService.captureWindowEvent({
        windowId: window.id,
        reason: 'did-fail-load',
        errorMessage: JSON.stringify({
          errorCode,
          errorDescription,
          validatedURL,
        }),
      });
    },
  );

  window.on('unresponsive', () => {
    telemetryService.captureWindowEvent({
      windowId: window.id,
      reason: 'unresponsive',
    });
  });
};
