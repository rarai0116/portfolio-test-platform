import {
  TelemetryChannels,
  type TelemetryIpcResult,
  type TelemetryPreviewImageDimensionFallbackPayload,
  type TelemetryPushBreadcrumbPayload,
  type TelemetryRendererReportPayload,
  type TelemetrySanitizerReportPayload,
  type TelemetrySetRoutePayload,
} from '@shared/types/telemetry';
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('telemetry', {
  reportError: (payload: TelemetryRendererReportPayload) =>
    ipcRenderer.invoke(
      TelemetryChannels.reportError,
      payload,
    ) as Promise<TelemetryIpcResult>,
  setRoute: (payload: TelemetrySetRoutePayload) =>
    ipcRenderer.invoke(
      TelemetryChannels.setRoute,
      payload,
    ) as Promise<TelemetryIpcResult>,
  pushBreadcrumb: (payload: TelemetryPushBreadcrumbPayload) =>
    ipcRenderer.invoke(
      TelemetryChannels.pushBreadcrumb,
      payload,
    ) as Promise<TelemetryIpcResult>,
  reportSanitizerRejection: (payload: TelemetrySanitizerReportPayload) =>
    ipcRenderer.invoke(
      TelemetryChannels.reportSanitizerRejection,
      payload,
    ) as Promise<TelemetryIpcResult>,
  reportPreviewImageDimensionFallback: (
    payload: TelemetryPreviewImageDimensionFallbackPayload,
  ) =>
    ipcRenderer.invoke(
      TelemetryChannels.reportPreviewImageDimensionFallback,
      payload,
    ) as Promise<TelemetryIpcResult>,
});
