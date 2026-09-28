import type { AppInfoResult } from '@shared/types/appInfo';
import type {
  AssetKey,
  AssetLoadFailureResult,
  AssetLoadReport,
  AssetLoadSuccessResult,
  AssetReadyNotice,
  AssetsRequestResult,
} from '@shared/types/assets';
import type {
  AssetData,
  BatchGetDocsPayload,
  BatchGetDocsResult,
  GetDocPayload,
  GetDocResult,
  GetFirestoreCacheMetricsResult,
  GetOncePayload,
  GetOnceResult,
  MutateAccepted,
  MutateCommitted,
  MutateFailed,
  MutatePayload,
  OutboxItem,
  OutboxUpdate,
  PatchEvent,
  PingPayload,
  ResetFirestoreCacheMetricsResult,
  SetActiveKeysPayload,
  SyncCacheIndexEntriesPayload,
  SyncCacheIndexEntriesResult,
} from '@shared/types/contracts';
import type {
  CreatePdfExportPreviewUpdateRequest,
  CreatePdfExportPreviewUpdateRequestResult,
  CreatePdfExportPreviewWindowCloseResult,
  CreatePdfExportPreviewWindowOpenRequest,
  CreatePdfExportPreviewWindowOpenResult,
  CreatePdfExportPreviewWindowStatusResult,
  CreatePdfExportRequest,
  CreatePdfExportResult,
  CreatePdfLoadConditionJsonRequest,
  CreatePdfLoadConditionJsonResult,
  CreatePdfSelectOutputDirectoryRequest,
  CreatePdfSelectOutputDirectoryResult,
} from '@shared/types/createPdfExport';
import type { OpenCsvResult, SaveCsvResult } from '@shared/types/csvFile';
import type { MemoryProbeLabel } from '@shared/types/memoryProbe';
import type {
  CreatePdfPreviewCommitInput,
  CreatePdfPreviewCommitResult,
  CreatePdfPreviewPatchPayload,
  CreatePdfPreviewReadResult,
  CreatePdfPreviewRefreshResult,
  CreatePdfPreviewUpdatedEvent,
  CreationType,
} from '@shared/types/pdfPreview';
import type {
  TelemetryIpcResult,
  TelemetryPreviewImageDimensionFallbackPayload,
  TelemetryPushBreadcrumbPayload,
  TelemetryRendererReportPayload,
  TelemetrySanitizerReportPayload,
  TelemetrySetRoutePayload,
} from '@shared/types/telemetry';
import type { UpdaterStatusEvent } from '@shared/types/updater';
import type { WebUtils } from 'electron';

declare global {
  interface Window {
    __memoryProbeMark: (label: MemoryProbeLabel) => void;
    webUtils: WebUtils;
    fs: {
      setActiveKeys(payload: SetActiveKeysPayload): Promise<{ ok: boolean }>;
      ping(payload: PingPayload): Promise<{ ok: boolean }>;
      getOnce(payload: GetOncePayload): Promise<GetOnceResult>;
      getDoc(payload: GetDocPayload): Promise<GetDocResult>;
      batchGetDocs(payload: BatchGetDocsPayload): Promise<BatchGetDocsResult>;
      getFirestoreCacheMetrics(): Promise<GetFirestoreCacheMetricsResult>;
      resetFirestoreCacheMetrics(): Promise<ResetFirestoreCacheMetricsResult>;
      mutate(payload: MutatePayload): Promise<MutateAccepted>;
      onPatch(handler: (ev: PatchEvent) => void): () => void;
      onMutationAccepted(handler: (ev: MutateAccepted) => void): () => void;
      onMutationCommitted(handler: (ev: MutateCommitted) => void): () => void;
      onMutationFailed(handler: (ev: MutateFailed) => void): () => void;
      getOutbox: () => Promise<{
        type: 'snapshot';
        items: OutboxItem[];
      }>;
      onOutboxUpdate: (handler: (ev: OutboxUpdate) => void) => Unsubscribe;
      syncCacheIndexEntries(
        payload: SyncCacheIndexEntriesPayload,
      ): Promise<SyncCacheIndexEntriesResult>;
    };
    assets: {
      request: (items: AssetKey[]) => Promise<AssetsRequestResult>;
      upload: (
        filePath: string,
        grade: 'firstGrade' | 'secondGrade',
        timeoutMs?: number,
      ) => Promise<
        | {
            ok: true;
            grade: 'firstGrade' | 'secondGrade';
            key: string;
            objectPath: string;
            filePath: string;
            data: AssetData;
          }
        | { ok: false; error: string }
      >;
      uploadBuffer: (
        fileName: string,
        bytes: Uint8Array,
        grade: 'firstGrade' | 'secondGrade',
        contentType?: string,
        timeoutMs?: number,
      ) => Promise<
        | {
            ok: true;
            grade: 'firstGrade' | 'secondGrade';
            key: string;
            objectPath: string;
            filePath: string;
            data: AssetData;
          }
        | { ok: false; error: string }
      >;
      replace: (
        filePath: string,
        grade: 'firstGrade' | 'secondGrade',
        key: string,
        timeoutMs?: number,
      ) => Promise<
        | {
            ok: true;
            grade: 'firstGrade' | 'secondGrade';
            key: string;
            objectPath: string;
            filePath: string;
            data: AssetData;
          }
        | { ok: false; error: string }
      >;
      delete: (params: {
        grade: 'firstGrade' | 'secondGrade';
        key: string;
      }) => Promise<{ ok: true } | { ok: false; error: string }>;
      cancel: (filter?: {
        grade?: string;
        items?: AssetKey[];
      }) => Promise<
        | { ok: true; canceled: number }
        | { ok: false; error: string }
        | undefined
      >;
      prioritize: (
        items: AssetKey[],
        priority?: number,
      ) => Promise<{ ok: true } | { ok: false; error: string }>;
      onReady: (handler: (item: AssetReadyNotice) => void) => () => void;
      reportLoadFailure: (
        report: AssetLoadReport,
      ) => Promise<AssetLoadFailureResult>;
      reportLoadSuccess: (
        report: AssetLoadReport,
      ) => Promise<AssetLoadSuccessResult>;
      onProgress: (
        handler: (e: {
          grade: string;
          key: string;
          transferred: number;
          total?: number;
        }) => void,
      ) => () => void;
      onError: (handler: (e: unknown) => void) => () => void;
      clearCache: (scope?: {
        grade?: string;
      }) => Promise<
        { ok: true; removedFiles: number } | { ok: false; error: string }
      >;
    };
    editor: {
      insertImage: (
        payload: import('@shared/types/editor').EditorInsertPayload,
      ) => Promise<{ ok: true } | { ok: false; error: string }>;
      onInsertImage: (
        handler: (
          payload: import('@shared/types/editor').EditorInsertPayload,
        ) => void,
      ) => () => void;
    };
    preview: {
      send: (
        payload: import('@shared/types/preview').PreviewSendPayload,
      ) => Promise<{ ok: true } | { ok: false; error: string }>;
      onSet: (
        handler: (
          payload: import('@shared/types/preview').PreviewSetPayload,
        ) => void,
      ) => () => void;
      getLatest: () => Promise<
        import('@shared/types/preview').PreviewGetLatestResult
      >;
      openWindow: () => Promise<
        import('@shared/types/preview').PreviewWindowOpenResult
      >;
      closeWindow: () => Promise<
        import('@shared/types/preview').PreviewWindowCloseResult
      >;
      onWindowClosed: (handler: () => void) => () => void;
      patchImages: (
        payload: import('@shared/types/preview').PreviewImagePatchPayload,
      ) => Promise<{ ok: true } | { ok: false; error: string }>;
      onImagePatch: (
        handler: (
          payload: import('@shared/types/preview').PreviewImagePatchPayload,
        ) => void,
      ) => () => void;
    };
    updater: {
      check: () => Promise<{ ok: true } | { ok: false; error: string }>;
      install: () => Promise<{ ok: true } | { ok: false; error: string }>;
      onStatus: (handler: (ev: UpdaterStatusEvent) => void) => () => void;
    };
    appInfo: {
      get: () => Promise<AppInfoResult>;
    };
    testCategory: {
      request: (
        payload: import('@shared/types/testCategory').TestCategoryRequestPayload,
      ) => Promise<
        import('@shared/types/testCategory').TestCategoryRequestResult
      >;

      requestOtherTagNos: (
        payload: import('@shared/types/testCategory').TestCategoryOtherTagRequestPayload,
      ) => Promise<
        import('@shared/types/testCategory').TestCategoryOtherTagRequestResult
      >;

      getKey: (
        grade: import('@shared/types/contracts').GradeId,
        subject?: import('@shared/types/contracts').TestSubject,
        bigCategoryTag?: string,
      ) => Promise<
        import('@shared/types/testCategory').TestCategoryGetKeyResult
      >;

      getOtherTagKeys: (
        payload: import('@shared/types/testCategory').TestCategoryOtherTagKeysPayload,
      ) => Promise<
        import('@shared/types/testCategory').TestCategoryOtherTagKeysResult
      >;

      onUpdated: (
        handler: (
          changes: import('@shared/types/testCategory').TestCategoryChangedCategory[],
        ) => void,
      ) => () => void;

      onOtherTagsUpdated: (
        handler: (
          changes: import('@shared/types/testCategory').TestCategoryChangedOtherTag[],
        ) => void,
      ) => () => void;
    };
    csvFile: {
      openCsv: () => Promise<OpenCsvResult>;
      saveCsv: (
        bytes: Uint8Array,
        suggestedName: string,
      ) => Promise<SaveCsvResult>;
    };
    pdfPreview: {
      commit: (
        input: CreatePdfPreviewCommitInput,
      ) => Promise<CreatePdfPreviewCommitResult>;
      refresh: (
        creationType: CreationType,
        slotKey: string,
      ) => Promise<CreatePdfPreviewRefreshResult>;
      read: (creationType: CreationType) => Promise<CreatePdfPreviewReadResult>;
      notifyPatch: (
        payload: CreatePdfPreviewPatchPayload,
      ) => Promise<{ ok: true } | { ok: false; error: string }>;
      onUpdated: (
        handler: (event: CreatePdfPreviewUpdatedEvent) => void,
      ) => () => void;
      onPatch: (
        handler: (payload: CreatePdfPreviewPatchPayload) => void,
      ) => () => void;
    };
    createPdfExport: {
      openPreviewWindow: (
        request: CreatePdfExportPreviewWindowOpenRequest,
      ) => Promise<CreatePdfExportPreviewWindowOpenResult>;
      closePreviewWindow: () => Promise<CreatePdfExportPreviewWindowCloseResult>;
      getPreviewWindowStatus: () => Promise<CreatePdfExportPreviewWindowStatusResult>;
      requestPreviewUpdate: (
        request: CreatePdfExportPreviewUpdateRequest,
      ) => Promise<CreatePdfExportPreviewUpdateRequestResult>;
      selectOutputDirectory: (
        request?: CreatePdfSelectOutputDirectoryRequest,
      ) => Promise<CreatePdfSelectOutputDirectoryResult>;
      exportPdf: (
        request: CreatePdfExportRequest,
      ) => Promise<CreatePdfExportResult>;
      loadConditionJson: (
        request: CreatePdfLoadConditionJsonRequest,
      ) => Promise<CreatePdfLoadConditionJsonResult>;
      onPreviewWindowClosed: (handler: () => void) => () => void;
      onPreviewUpdateRequested: (
        handler: (request: CreatePdfExportPreviewUpdateRequest) => void,
      ) => () => void;
    };
    telemetry: {
      reportError: (
        payload: TelemetryRendererReportPayload,
      ) => Promise<TelemetryIpcResult>;
      reportSanitizerRejection: (
        payload: TelemetrySanitizerReportPayload,
      ) => Promise<TelemetryIpcResult>;
      reportPreviewImageDimensionFallback: (
        payload: TelemetryPreviewImageDimensionFallbackPayload,
      ) => Promise<TelemetryIpcResult>;
      setRoute: (
        payload: TelemetrySetRoutePayload,
      ) => Promise<TelemetryIpcResult>;
      pushBreadcrumb: (
        payload: TelemetryPushBreadcrumbPayload,
      ) => Promise<TelemetryIpcResult>;
    };
  }
}
