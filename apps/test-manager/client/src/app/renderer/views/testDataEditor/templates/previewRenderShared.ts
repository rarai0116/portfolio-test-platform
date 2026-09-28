import {
  type DisplayMode,
  ensureDisplayModeStyle,
  ensureKatexFontStyle,
  ensureKatexOverrideStyle,
  ensureKatexStyle,
} from '@api/ensurePdf';
import { sanitizeForPreviewRender } from '@api/htmlSanitizer';
import { realizeHtmlImages } from '@components/templates/preview/imageRealizer';
import type {
  PreviewMode,
  PreviewOptions,
  PreviewSetPayload,
} from '@shared/types/preview';
import { fullRenderPreview } from '@templates/preview/layout/fullRenderPreview';
import type { LayoutState, PreviewItem } from '@templates/preview/layout/types';
import { clearViewerDocument } from '@templates/preview/layout/utils';

export type PreviewUiOptions = {
  mode: PreviewMode;
  hasCover: boolean;
  questionCount?: number;
  page?: { size: 'B5' | 'A4'; pxPerMm?: number; baseHeightMm?: number };
  meta?: { title?: string; subject?: string; grade?: string };
};

export const buildLayoutOptions = (
  uiOptions: PreviewUiOptions,
  payloadOptions?: PreviewOptions,
): PreviewOptions => {
  const merged: PreviewOptions = {
    ...payloadOptions,
    mode: uiOptions.mode,
    hasCover: uiOptions.hasCover,
    questionCount: payloadOptions?.questionCount ?? uiOptions.questionCount,
    questionEditorType: payloadOptions?.questionEditorType ?? 'normal',
    answerEditorType: payloadOptions?.answerEditorType ?? 'normal',
    meta: { ...payloadOptions?.meta, ...uiOptions.meta },
    page: { ...payloadOptions?.page, ...uiOptions.page },
  };

  return merged;
};

export const buildLayoutItemsFromPayload = (
  payload: PreviewSetPayload,
): PreviewItem[] => {
  const imagesMap = payload.images ?? {};

  const realize = (html?: string) => {
    const sanitizedHtml = sanitizeForPreviewRender(html || '').sanitizedHtml;
    return realizeHtmlImages(sanitizedHtml, imagesMap);
  };

  const questionChoices = (payload?.question?.choices ?? []).map((choice) =>
    realize(choice || ''),
  );
  const answerChoices = (payload?.answer?.choices ?? []).map((choice) =>
    realize(choice || ''),
  );

  return [
    {
      id: String(payload.id),
      subject: String(payload.subject ?? ''),
      bigCategoryTag: String(payload.bigCategoryTag ?? ''),
      smallCategoryTag: String(payload.smallCategoryTag ?? ''),
      nengo: String(payload.nengo ?? ''),
      year: Number(payload.year ?? '0') || 0,
      testNo: payload.testNo ? String(payload.testNo) : undefined,
      textHtml: realize(payload?.question?.textHtml),
      questionChoicesHtml: questionChoices,
      answerTextHtml: realize(payload?.answer?.textHtml),
      answerChoicesHtml: answerChoices,
      answerBool: !!payload?.answer?.answerBool,
      answerNo: payload?.answer?.answerNo ?? '',
      difficult: Number(payload?.difficult ?? '0') || 0,
      publicationYear: payload?.publicationYear,
      publicationNo: payload?.publicationNo
        ? String(payload.publicationNo)
        : undefined,
    },
  ];
};

export const renderPreviewToDocument = async (args: {
  doc: Document;
  payload: PreviewSetPayload;
  uiOptions: PreviewUiOptions;
  displayMode: DisplayMode;
}): Promise<LayoutState> => {
  const { doc, payload, uiOptions, displayMode } = args;

  clearViewerDocument(doc);
  doc.documentElement.setAttribute('data-active-item-id', String(payload.id));
  // patch 表示モードでは紙の再現（改ページ）を行わない。paginateArea 側が
  // この属性を見てページ分割の基準高さを実質無限大にする（案C / Bug 4+11）。
  doc.documentElement.setAttribute('data-preview-display-mode', displayMode);

  ensureKatexFontStyle(doc);
  ensureKatexStyle(doc);
  ensureKatexOverrideStyle(doc);
  ensureDisplayModeStyle(doc, displayMode);

  const layoutState: LayoutState = {
    options: buildLayoutOptions(uiOptions, payload.options),
    items: buildLayoutItemsFromPayload(payload),
  };

  await fullRenderPreview(layoutState, doc, payload.images);
  return layoutState;
};
