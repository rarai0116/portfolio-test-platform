import type {
  TelemetryPreviewImageDimensionFallbackPayload,
  TelemetryPreviewImageDimensionFallbackSource,
} from '@shared/types/telemetry';

const hashText = (value: string): string => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return `h${(hash >>> 0).toString(16)}`;
};

const reportedKeys = new Set<string>();

export const reportPreviewImageDimensionFallback = (params: {
  imageKey: string;
  itemId?: string;
  grade?: string;
  route?: string;
  part?: string;
  fallbackSource: TelemetryPreviewImageDimensionFallbackSource;
}): void => {
  const imageKeyHash = hashText(params.imageKey);
  const dedupeKey = `${imageKeyHash}:${params.fallbackSource}`;
  if (reportedKeys.has(dedupeKey)) return;
  reportedKeys.add(dedupeKey);

  console.warn('[preview-image-dimension-fallback]', {
    imageKeyHash,
    grade: params.grade,
    route: params.route,
    part: params.part,
    fallbackSource: params.fallbackSource,
  });

  const payload: TelemetryPreviewImageDimensionFallbackPayload = {
    imageKeyHash,
    itemIdHash: params.itemId ? hashText(params.itemId) : undefined,
    grade: params.grade,
    route: params.route,
    part: params.part,
    fallbackSource: params.fallbackSource,
    occurredAt: new Date().toISOString(),
  };

  void window.telemetry?.reportPreviewImageDimensionFallback?.(payload);
};
