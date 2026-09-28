import { randomUUID } from 'node:crypto';
import {
  type TelemetryBreadcrumb,
  TelemetryChannels,
  type TelemetryEvent,
  type TelemetryIpcResult,
  type TelemetryPreviewImageDimensionFallbackPayload,
  type TelemetryProcessType,
  type TelemetryPushBreadcrumbPayload,
  type TelemetryReason,
  type TelemetryRendererReportPayload,
  type TelemetryRuntimeMode,
  type TelemetrySanitizerReportPayload,
  type TelemetrySetRoutePayload,
  type TelemetryWindowType,
} from '@shared/types/telemetry';
import { app, BrowserWindow, ipcMain } from 'electron';
import { TelemetrySender } from './sender';
import { type StoredTelemetrySession, TelemetryStore } from './store';

const MAX_BREADCRUMBS = 20;

const currentRuntimeMode: TelemetryRuntimeMode =
  process.env.NODE_ENV === 'production' ? 'production' : 'development';

const toErrorInfo = (error: unknown) => {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      stackDigest: error.stack,
    };
  }

  return {
    errorName: undefined,
    errorMessage: typeof error === 'string' ? error : String(error),
    stackDigest: undefined,
  };
};

export class TelemetryService {
  private readonly store = new TelemetryStore();
  private readonly sender = new TelemetrySender(currentRuntimeMode);
  private readonly windowTypes = new Map<number, TelemetryWindowType>();
  private readonly routes = new Map<number, string>();
  private readonly breadcrumbs = new Map<number, TelemetryBreadcrumb[]>();
  private session: StoredTelemetrySession | null = null;
  private isFlushing = false;
  private ipcRegistered = false;
  private processHandlersInstalled = false;

  startSession(): void {
    const previousSession = this.store.readSession();

    if (
      previousSession &&
      !previousSession.cleanExit &&
      previousSession.runtimeMode === currentRuntimeMode
    ) {
      this.store.appendPending(
        this.createEvent({
          eventName: 'previous_session_crash',
          processType: 'main',
          windowType: 'unknown',
          reason: 'previous_session_crash',
          route: previousSession.lastKnownRoute,
          breadcrumbDigest: this.serializeBreadcrumbs(
            previousSession.lastBreadcrumbs,
          ),
          previousCleanExit: false,
          sessionId: previousSession.sessionId,
          clientId: previousSession.installationId,
        }),
      );
    }

    this.session = {
      installationId: previousSession?.installationId ?? randomUUID(),
      sessionId: randomUUID(),
      runtimeMode: currentRuntimeMode,
      startedAt: new Date().toISOString(),
      cleanExit: false,
      lastKnownRoute: undefined,
      lastBreadcrumbs: [],
    };

    this.store.writeSession(this.session);
    void this.flushPending();
  }

  registerIpcHandlers(): void {
    if (this.ipcRegistered) return;

    ipcMain.removeHandler(TelemetryChannels.reportError);
    ipcMain.removeHandler(TelemetryChannels.setRoute);
    ipcMain.removeHandler(TelemetryChannels.pushBreadcrumb);
    ipcMain.removeHandler(TelemetryChannels.reportSanitizerRejection);
    ipcMain.removeHandler(
      TelemetryChannels.reportPreviewImageDimensionFallback,
    );

    ipcMain.handle(
      TelemetryChannels.reportError,
      async (event, payload: TelemetryRendererReportPayload) => {
        return this.handleRendererReport(event.sender, payload);
      },
    );
    ipcMain.handle(
      TelemetryChannels.setRoute,
      async (event, payload: TelemetrySetRoutePayload) => {
        return this.handleSetRoute(event.sender, payload);
      },
    );
    ipcMain.handle(
      TelemetryChannels.pushBreadcrumb,
      async (event, payload: TelemetryPushBreadcrumbPayload) => {
        return this.handlePushBreadcrumb(event.sender, payload);
      },
    );
    ipcMain.handle(
      TelemetryChannels.reportSanitizerRejection,
      async (event, payload: TelemetrySanitizerReportPayload) => {
        return this.handleSanitizerReport(event.sender, payload);
      },
    );
    ipcMain.handle(
      TelemetryChannels.reportPreviewImageDimensionFallback,
      async (
        event,
        payload: TelemetryPreviewImageDimensionFallbackPayload,
      ) => {
        return this.handlePreviewImageDimensionFallback(event.sender, payload);
      },
    );

    this.ipcRegistered = true;
  }

  installProcessHandlers(): void {
    if (this.processHandlersInstalled) return;

    process.on('uncaughtException', (error) => {
      this.captureError({
        processType: 'main',
        windowType: 'unknown',
        reason: 'uncaughtException',
        error,
      });
    });

    process.on('unhandledRejection', (reason) => {
      this.captureError({
        processType: 'main',
        windowType: 'unknown',
        reason: 'unhandledRejection',
        error: reason,
      });
    });

    this.processHandlersInstalled = true;
  }

  trackWindow(window: BrowserWindow, windowType: TelemetryWindowType): void {
    this.windowTypes.set(window.id, windowType);
    window.once('closed', () => {
      this.windowTypes.delete(window.id);
      this.routes.delete(window.id);
      this.breadcrumbs.delete(window.id);
    });
  }

  captureError(params: {
    processType: TelemetryProcessType;
    windowType: TelemetryWindowType;
    reason: TelemetryReason;
    error: unknown;
    route?: string;
    breadcrumbDigest?: string;
  }): void {
    const info = toErrorInfo(params.error);

    this.enqueueEvent(
      this.createEvent({
        eventName: 'app_crash',
        processType: params.processType,
        windowType: params.windowType,
        reason: params.reason,
        route: params.route,
        breadcrumbDigest: params.breadcrumbDigest,
        ...info,
      }),
    );
  }

  captureWindowEvent(params: {
    windowId: number;
    reason: Extract<
      TelemetryReason,
      'render-process-gone' | 'did-fail-load' | 'unresponsive'
    >;
    errorMessage?: string;
    stackDigest?: string;
  }): void {
    const breadcrumbs = this.breadcrumbs.get(params.windowId) ?? [];

    this.enqueueEvent(
      this.createEvent({
        eventName: 'app_crash',
        processType: 'renderer',
        windowType: this.windowTypes.get(params.windowId) ?? 'unknown',
        reason: params.reason,
        route: this.routes.get(params.windowId),
        errorMessage: params.errorMessage,
        stackDigest: params.stackDigest,
        breadcrumbDigest: this.serializeBreadcrumbs(breadcrumbs),
      }),
    );
  }

  captureChildProcessGone(details: Record<string, unknown>): void {
    this.enqueueEvent(
      this.createEvent({
        eventName: 'app_crash',
        processType: 'main',
        windowType: 'unknown',
        reason: 'child-process-gone',
        errorMessage: JSON.stringify(details),
      }),
    );
  }

  markCleanExit(): void {
    if (!this.session) return;

    this.session = {
      ...this.session,
      cleanExit: true,
      lastKnownRoute: this.pickLastKnownRoute(),
      lastBreadcrumbs: this.collectBreadcrumbs(),
    };
    this.store.writeSession(this.session);
  }

  async flushPending(): Promise<void> {
    if (this.isFlushing || !this.sender.isEnabled()) return;

    this.isFlushing = true;
    try {
      const current = this.store.readPending();
      const nextPending: TelemetryEvent[] = [];

      for (const event of current) {
        if (event.runtimeMode !== currentRuntimeMode) {
          nextPending.push(event);
          continue;
        }

        try {
          await this.sender.send(event);
        } catch {
          nextPending.push(event);
        }
      }

      this.store.writePending(nextPending);
    } finally {
      this.isFlushing = false;
    }
  }

  private async handleRendererReport(
    sender: Electron.WebContents,
    payload: TelemetryRendererReportPayload,
  ): Promise<TelemetryIpcResult> {
    try {
      const window = BrowserWindow.fromWebContents(sender);
      const windowId = window?.id;
      const breadcrumbs = windowId
        ? (this.breadcrumbs.get(windowId) ?? [])
        : [];

      this.enqueueEvent(
        this.createEvent({
          eventName: 'app_crash',
          processType: 'renderer',
          windowType: windowId
            ? (this.windowTypes.get(windowId) ?? 'unknown')
            : 'unknown',
          reason: payload.reason,
          route: windowId ? this.routes.get(windowId) : undefined,
          errorName: payload.errorName,
          errorMessage: payload.errorMessage,
          stackDigest: payload.stack,
          breadcrumbDigest: this.serializeBreadcrumbs(breadcrumbs),
        }),
      );

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async handleSetRoute(
    sender: Electron.WebContents,
    payload: TelemetrySetRoutePayload,
  ): Promise<TelemetryIpcResult> {
    try {
      const window = BrowserWindow.fromWebContents(sender);
      if (!window) return { ok: false, error: 'Window not found' };

      this.routes.set(window.id, payload.route);
      this.appendBreadcrumb(window.id, `route:${payload.route}`);
      this.persistSessionSnapshot();
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async handlePushBreadcrumb(
    sender: Electron.WebContents,
    payload: TelemetryPushBreadcrumbPayload,
  ): Promise<TelemetryIpcResult> {
    try {
      const window = BrowserWindow.fromWebContents(sender);
      if (!window) return { ok: false, error: 'Window not found' };

      this.appendBreadcrumb(window.id, payload.label);
      this.persistSessionSnapshot();
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async handleSanitizerReport(
    sender: Electron.WebContents,
    payload: TelemetrySanitizerReportPayload,
  ): Promise<TelemetryIpcResult> {
    try {
      const window = BrowserWindow.fromWebContents(sender);
      const windowId = window?.id;
      const windowType = windowId
        ? (this.windowTypes.get(windowId) ?? 'unknown')
        : 'unknown';
      const route = windowId ? this.routes.get(windowId) : undefined;

      for (const rejection of payload.rejections) {
        this.enqueueEvent(
          this.createEvent({
            eventName: 'html_sanitizer_rejection',
            processType: 'renderer',
            windowType,
            reason: 'sanitizer-rejected',
            route: rejection.route ?? route,
            errorMessage: rejection.reasonText,
            sanitizeProfile: rejection.profile,
            sanitizeBoundary: rejection.boundary,
            ruleCode: rejection.ruleCode,
            tagName: rejection.tagName,
            attributeName: rejection.attributeName,
            className: rejection.className,
            styleProperty: rejection.styleProperty,
            fieldName: rejection.fieldName,
            itemIdHash: rejection.itemIdHash,
            sampleHash: rejection.sampleHash,
            sampleText: rejection.sampleText,
            rejectionCount: rejection.rejectionCount,
            occurredAt: rejection.occurredAt,
          }),
        );
      }

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async handlePreviewImageDimensionFallback(
    sender: Electron.WebContents,
    payload: TelemetryPreviewImageDimensionFallbackPayload,
  ): Promise<TelemetryIpcResult> {
    try {
      const window = BrowserWindow.fromWebContents(sender);
      const windowId = window?.id;
      const windowType = windowId
        ? (this.windowTypes.get(windowId) ?? 'unknown')
        : 'unknown';
      const route = windowId ? this.routes.get(windowId) : undefined;

      this.enqueueEvent(
        this.createEvent({
          eventName: 'preview_image_dimension_fallback',
          processType: 'renderer',
          windowType,
          reason: 'preview-image-dimension-fallback',
          route: payload.route ?? route,
          itemIdHash: payload.itemIdHash,
          imageKeyHash: payload.imageKeyHash,
          grade: payload.grade,
          part: payload.part,
          fallbackSource: payload.fallbackSource,
          occurredAt: payload.occurredAt,
        }),
      );

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private appendBreadcrumb(windowId: number, label: string): void {
    const current = this.breadcrumbs.get(windowId) ?? [];
    current.push({ label, occurredAt: new Date().toISOString() });
    this.breadcrumbs.set(windowId, current.slice(-MAX_BREADCRUMBS));
  }

  private collectBreadcrumbs(): TelemetryBreadcrumb[] {
    const merged = [...this.breadcrumbs.values()].flat();
    return merged.slice(-MAX_BREADCRUMBS);
  }

  private serializeBreadcrumbs(
    breadcrumbs: TelemetryBreadcrumb[],
  ): string | undefined {
    if (breadcrumbs.length === 0) return undefined;

    return breadcrumbs
      .slice(-5)
      .map((breadcrumb) => breadcrumb.label)
      .join(' > ');
  }

  private persistSessionSnapshot(): void {
    if (!this.session) return;

    this.session = {
      ...this.session,
      lastKnownRoute: this.pickLastKnownRoute(),
      lastBreadcrumbs: this.collectBreadcrumbs(),
    };
    this.store.writeSession(this.session);
  }

  private pickLastKnownRoute(): string | undefined {
    const mainRoute = [...this.windowTypes.entries()].find(
      ([, windowType]) => windowType === 'main',
    );
    if (mainRoute) {
      return this.routes.get(mainRoute[0]);
    }

    const lastRoute = [...this.routes.values()].at(-1);
    return lastRoute;
  }

  private enqueueEvent(event: TelemetryEvent): void {
    this.store.appendPending(event);
    void this.flushPending();
  }

  private createEvent(params: {
    eventName: TelemetryEvent['eventName'];
    processType: TelemetryProcessType;
    windowType: TelemetryWindowType;
    reason: TelemetryReason;
    route?: string;
    errorName?: string;
    errorMessage?: string;
    stackDigest?: string;
    breadcrumbDigest?: string;
    sanitizeProfile?: TelemetryEvent['sanitizeProfile'];
    sanitizeBoundary?: TelemetryEvent['sanitizeBoundary'];
    ruleCode?: TelemetryEvent['ruleCode'];
    tagName?: TelemetryEvent['tagName'];
    attributeName?: TelemetryEvent['attributeName'];
    className?: TelemetryEvent['className'];
    styleProperty?: TelemetryEvent['styleProperty'];
    fieldName?: TelemetryEvent['fieldName'];
    itemIdHash?: TelemetryEvent['itemIdHash'];
    imageKeyHash?: TelemetryEvent['imageKeyHash'];
    grade?: TelemetryEvent['grade'];
    part?: TelemetryEvent['part'];
    fallbackSource?: TelemetryEvent['fallbackSource'];
    sampleHash?: TelemetryEvent['sampleHash'];
    sampleText?: TelemetryEvent['sampleText'];
    rejectionCount?: TelemetryEvent['rejectionCount'];
    occurredAt?: string;
    previousCleanExit?: boolean;
    sessionId?: string;
    clientId?: string;
  }): TelemetryEvent {
    const sessionId =
      params.sessionId ?? this.session?.sessionId ?? randomUUID();
    const clientId =
      params.clientId ??
      this.session?.installationId ??
      this.store.getOrCreateInstallationId();

    return {
      id: randomUUID(),
      eventName: params.eventName,
      runtimeMode: currentRuntimeMode,
      sessionId,
      clientId,
      appName: app.getName(),
      appVersion: app.getVersion(),
      platform: process.platform,
      isPackaged: app.isPackaged,
      processType: params.processType,
      windowType: params.windowType,
      reason: params.reason,
      route: params.route,
      errorName: params.errorName,
      errorMessage: params.errorMessage,
      stackDigest: params.stackDigest,
      breadcrumbDigest: params.breadcrumbDigest,
      sanitizeProfile: params.sanitizeProfile,
      sanitizeBoundary: params.sanitizeBoundary,
      ruleCode: params.ruleCode,
      tagName: params.tagName,
      attributeName: params.attributeName,
      className: params.className,
      styleProperty: params.styleProperty,
      fieldName: params.fieldName,
      itemIdHash: params.itemIdHash,
      imageKeyHash: params.imageKeyHash,
      grade: params.grade,
      part: params.part,
      fallbackSource: params.fallbackSource,
      sampleHash: params.sampleHash,
      sampleText: params.sampleText,
      rejectionCount: params.rejectionCount,
      occurredAt: params.occurredAt ?? new Date().toISOString(),
      previousCleanExit:
        params.previousCleanExit ?? this.session?.cleanExit ?? false,
    };
  }
}
