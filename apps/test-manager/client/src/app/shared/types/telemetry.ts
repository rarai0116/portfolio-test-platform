export const TelemetryChannels = {
  reportError: 'telemetry:reportError',
  setRoute: 'telemetry:setRoute',
  pushBreadcrumb: 'telemetry:pushBreadcrumb',
  reportSanitizerRejection: 'telemetry:reportSanitizerRejection',
  reportPreviewImageDimensionFallback:
    'telemetry:reportPreviewImageDimensionFallback',
} as const;

export type TelemetryProcessType = 'main' | 'renderer' | 'preload';

export type TelemetryWindowType = 'main' | 'auth' | 'preview' | 'unknown';

export type TelemetryRuntimeMode = 'development' | 'production';

export type TelemetryReason =
  | 'uncaughtException'
  | 'unhandledRejection'
  | 'render-process-gone'
  | 'did-fail-load'
  | 'unresponsive'
  | 'child-process-gone'
  | 'renderer-error'
  | 'renderer-unhandledrejection'
  | 'previous_session_crash'
  | 'sanitizer-rejected'
  | 'preview-image-dimension-fallback';

export type TelemetryBreadcrumb = {
  label: string;
  occurredAt: string;
};

export type TelemetryEventName =
  | 'app_crash'
  | 'previous_session_crash'
  | 'html_sanitizer_rejection'
  | 'preview_image_dimension_fallback';

export type TelemetryPreviewImageDimensionFallbackSource =
  | 'base64'
  | 'natural'
  | 'property'
  | 'offset';

export type TelemetrySanitizerProfile =
  | 'persisted'
  | 'editor-runtime'
  | 'quill-import'
  | 'preview-render';

export type TelemetrySanitizerBoundary =
  | 'load'
  | 'save'
  | 'editor-runtime'
  | 'quill-paste'
  | 'preview';

export type TelemetrySanitizerRuleCode =
  | 'blocked-tag'
  | 'blocked-attribute'
  | 'blocked-class'
  | 'blocked-style-property'
  | 'blocked-style-value'
  | 'stripped-src'
  | 'formula-recovery-failed';

export type TelemetrySanitizerRejection = {
  profile: TelemetrySanitizerProfile;
  boundary: TelemetrySanitizerBoundary;
  ruleCode: TelemetrySanitizerRuleCode;
  tagName?: string;
  attributeName?: string;
  className?: string;
  styleProperty?: string;
  reasonText: string;
  fieldName?: string;
  route?: string;
  sampleText?: string;
  sampleHash: string;
  itemIdHash?: string;
  occurredAt: string;
  rejectionCount: number;
};

export type TelemetryEvent = {
  id: string;
  eventName: TelemetryEventName;
  runtimeMode: TelemetryRuntimeMode;
  sessionId: string;
  clientId: string;
  appName: string;
  appVersion: string;
  platform: NodeJS.Platform;
  isPackaged: boolean;
  processType: TelemetryProcessType;
  windowType: TelemetryWindowType;
  reason: TelemetryReason;
  route?: string;
  errorName?: string;
  errorMessage?: string;
  stackDigest?: string;
  breadcrumbDigest?: string;
  sanitizeProfile?: TelemetrySanitizerProfile;
  sanitizeBoundary?: TelemetrySanitizerBoundary;
  ruleCode?: TelemetrySanitizerRuleCode;
  tagName?: string;
  attributeName?: string;
  className?: string;
  styleProperty?: string;
  fieldName?: string;
  itemIdHash?: string;
  imageKeyHash?: string;
  grade?: string;
  part?: string;
  fallbackSource?: TelemetryPreviewImageDimensionFallbackSource;
  sampleHash?: string;
  sampleText?: string;
  rejectionCount?: number;
  occurredAt: string;
  previousCleanExit: boolean;
};

export type TelemetryRendererReportPayload = {
  reason: Extract<
    TelemetryReason,
    'renderer-error' | 'renderer-unhandledrejection'
  >;
  errorName?: string;
  errorMessage?: string;
  stack?: string;
};

export type TelemetrySetRoutePayload = {
  route: string;
};

export type TelemetrySanitizerReportPayload = {
  rejections: TelemetrySanitizerRejection[];
};

export type TelemetryPreviewImageDimensionFallbackPayload = {
  imageKeyHash: string;
  itemIdHash?: string;
  grade?: string;
  route?: string;
  part?: string;
  fallbackSource: TelemetryPreviewImageDimensionFallbackSource;
  occurredAt: string;
};

export type TelemetryPushBreadcrumbPayload = {
  label: string;
};

export type TelemetryIpcResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
    };
