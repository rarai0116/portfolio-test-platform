import type { TelemetryRendererReportPayload } from '@shared/types/telemetry';

const normalizeRoute = () => {
  const hash = window.location.hash || '#/';
  return hash.startsWith('#') ? hash : `#${hash}`;
};

const toRendererPayload = (
  reason: TelemetryRendererReportPayload['reason'],
  errorLike: unknown,
  fallbackMessage?: string,
): TelemetryRendererReportPayload => {
  if (errorLike instanceof Error) {
    return {
      reason,
      errorName: errorLike.name,
      errorMessage: errorLike.message,
      stack: errorLike.stack,
    };
  }

  return {
    reason,
    errorMessage:
      typeof errorLike === 'string'
        ? errorLike
        : (fallbackMessage ?? String(errorLike)),
  };
};

const installHistoryRouteHooks = (syncRoute: () => void) => {
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = ((...args) => {
    originalPushState(...args);
    syncRoute();
  }) as History['pushState'];

  history.replaceState = ((...args) => {
    originalReplaceState(...args);
    syncRoute();
  }) as History['replaceState'];
};

export const installRendererTelemetry = (): void => {
  const telemetry = window.telemetry;
  if (!telemetry) return;

  const syncRoute = () => {
    const route = normalizeRoute();
    void telemetry.setRoute({ route });
  };

  syncRoute();
  installHistoryRouteHooks(syncRoute);
  window.addEventListener('hashchange', syncRoute);
  window.addEventListener('popstate', syncRoute);

  window.addEventListener('error', (event) => {
    const payload = toRendererPayload(
      'renderer-error',
      event.error,
      event.message,
    );
    void telemetry.reportError(payload);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const payload = toRendererPayload(
      'renderer-unhandledrejection',
      event.reason,
    );
    void telemetry.reportError(payload);
  });
};
