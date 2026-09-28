import type {
  TelemetryEvent,
  TelemetryRuntimeMode,
} from '@shared/types/telemetry';
import got from 'got';

const GA_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

const trimText = (value: string | undefined, maxLength: number) => {
  if (!value) return undefined;

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;

  return normalized.length > maxLength
    ? normalized.slice(0, maxLength)
    : normalized;
};

const toMeasurementPayload = (event: TelemetryEvent) => ({
  client_id: event.clientId,
  non_personalized_ads: true,
  events: [
    {
      name: event.eventName,
      params: {
        session_id: event.sessionId,
        engagement_time_msec: 1,
        app_name: trimText(event.appName, 100),
        app_version: trimText(event.appVersion, 32),
        app_env: event.runtimeMode,
        platform: event.platform,
        is_packaged: event.isPackaged ? 1 : 0,
        process_type: event.processType,
        window_type: event.windowType,
        reason: event.reason,
        route: trimText(event.route, 120),
        error_name: trimText(event.errorName, 120),
        error_message: trimText(event.errorMessage, 300),
        stack_digest: trimText(event.stackDigest, 500),
        breadcrumb_digest: trimText(event.breadcrumbDigest, 400),
        sanitize_profile: event.sanitizeProfile,
        sanitize_boundary: event.sanitizeBoundary,
        rule_code: event.ruleCode,
        tag_name: trimText(event.tagName, 60),
        attribute_name: trimText(event.attributeName, 60),
        class_name: trimText(event.className, 120),
        style_property: trimText(event.styleProperty, 60),
        field_name: trimText(event.fieldName, 60),
        item_id_hash: trimText(event.itemIdHash, 120),
        image_key_hash: trimText(event.imageKeyHash, 120),
        grade: trimText(event.grade, 32),
        part: trimText(event.part, 60),
        fallback_source: event.fallbackSource,
        sample_hash: trimText(event.sampleHash, 120),
        sample_text: trimText(event.sampleText, 120),
        rejection_count: event.rejectionCount,
        previous_clean_exit: event.previousCleanExit ? 1 : 0,
        occurred_at: event.occurredAt,
      },
    },
  ],
});

export class TelemetrySender {
  constructor(private readonly runtimeMode: TelemetryRuntimeMode) {}

  isEnabled(): boolean {
    return (
      this.runtimeMode === 'production' &&
      Boolean(process.env.GA4_MEASUREMENT_ID) &&
      Boolean(process.env.GA4_API_SECRET)
    );
  }

  async send(event: TelemetryEvent): Promise<void> {
    if (!this.isEnabled()) {
      throw new Error('Telemetry sender is disabled');
    }

    await got.post(GA_ENDPOINT, {
      searchParams: {
        measurement_id: process.env.GA4_MEASUREMENT_ID,
        api_secret: process.env.GA4_API_SECRET,
      },
      json: toMeasurementPayload(event),
      timeout: {
        request: 5000,
      },
      retry: {
        limit: 0,
      },
    });
  }
}
