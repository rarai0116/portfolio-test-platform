// CreatePdfPreviewSnapshot を fullRenderPreview 用の LayoutState に変換する adapter (T24)
// 型変換・フォールバック責務をここに集約し、previewPanel には置かない

import { extractImageIdsFromHtml } from '@api/utils';
import { realizeHtmlImages } from '@components/templates/preview/imageRealizer';
import { normalizeExamDateOption } from '@renderer/api/examDateOption';
import type { CreatePdfPreviewSnapshot } from '@shared/types/pdfPreview';
import type { ImageAssetMap } from '@stores/useImageAssetStore';
import type { LayoutState, PreviewItem } from '@templates/preview/layout/types';

const collectHtmlBlocks = (snapshot: CreatePdfPreviewSnapshot): string[] =>
  snapshot.items.flatMap((item) => [
    item.questionHtml ?? '',
    ...(item.questionChoicesHtml ?? []),
    item.answerHtml ?? '',
    ...(item.answerChoicesHtml ?? []),
  ]);

const hasCompleteImageAssetsForHtml = (
  snapshot: CreatePdfPreviewSnapshot,
  images: ImageAssetMap,
): boolean => {
  const imageIds = new Set<string>();
  for (const html of collectHtmlBlocks(snapshot)) {
    for (const imageId of extractImageIdsFromHtml(html)) {
      imageIds.add(imageId);
    }
  }

  for (const imageId of imageIds) {
    const asset = images[imageId];
    if (
      !asset?.url ||
      asset.width == null ||
      asset.height == null ||
      asset.width <= 0 ||
      asset.height <= 0
    ) {
      return false;
    }
  }

  return true;
};

/**
 * snapshot item の HTML は buildCreatePdfPreviewSnapshot で sanitized 済み。
 * adapter では再サニタイズせず、描画時点の画像解決だけを行う。
 */
const prepareSanitizedPreviewHtml = (
  html: string | undefined,
  images: ImageAssetMap,
  shouldRealizeImages: boolean,
): string => {
  if (!html) return '';
  if (!shouldRealizeImages) return html;
  return realizeHtmlImages(html, images);
};

/**
 * CreatePdfPreviewSnapshot + 画像アセットマップ から LayoutState を組み立てる。
 * - questionEditorType / answerEditorType が未設定のときは 'normal' にフォールバック
 * - mode は常に 'both'（問題・解説両方表示）を基本とする
 */
export const buildLayoutStateFromCreatePdfSnapshot = (
  snapshot: CreatePdfPreviewSnapshot,
  images: ImageAssetMap,
): LayoutState => {
  const shouldRealizeImages = hasCompleteImageAssetsForHtml(snapshot, images);
  const items: PreviewItem[] = snapshot.items.map((item) => ({
    id: item.itemId,
    subject: item.subject ?? '',
    bigCategoryTag: item.bigCategoryTag ?? '',
    smallCategoryTag: item.smallCategoryTag ?? '',
    nengo: item.nengo ?? '',
    year: Number(item.year ?? '0') || 0,
    testNo: item.testNo,
    textHtml: prepareSanitizedPreviewHtml(
      item.questionHtml,
      images,
      shouldRealizeImages,
    ),
    questionChoicesHtml: (item.questionChoicesHtml ?? []).map((h) =>
      prepareSanitizedPreviewHtml(h, images, shouldRealizeImages),
    ),
    answerTextHtml: prepareSanitizedPreviewHtml(
      item.answerHtml,
      images,
      shouldRealizeImages,
    ),
    answerChoicesHtml: (item.answerChoicesHtml ?? []).map((h) =>
      prepareSanitizedPreviewHtml(h, images, shouldRealizeImages),
    ),
    answerBool: item.answerBool ?? false,
    answerNo: item.answerNo ?? '',
    difficult: item.difficult ?? 0,
    publicationYear: item.publicationYear,
    publicationNo: item.publicationNo,
    // 各問の editorType を各アイテムに設定する。fullRenderPreview 内でアイテム単位で参照される。
    questionEditorType: item.questionEditorType ?? 'normal',
    answerEditorType: item.answerEditorType ?? 'normal',
    shuffleSeed: item.shuffleSeed,
    forcePageBreak: item.forcePageBreak,
  }));

  return {
    options: {
      mode: 'both',
      hasCover: snapshot.layout.hasCover,
      hasSubCategoryHeading: snapshot.layout.hasSubCategoryHeading,
      questionCount: snapshot.items.length,
      meta: {
        title: snapshot.title,
        grade: `${snapshot.grade}級`,
      },
      page: { size: snapshot.layout.pageSize },
      // options の editorType はフォールバック用。各アイテムの値を優先するため、実質的に使われない。
      questionEditorType: 'normal',
      answerEditorType: 'normal',
      creationType: snapshot.creationType,
      gradeNumber: snapshot.grade,
      isSerialNumber: true, // 連番表示はPDF作成モードでは常に有効とする（将来的にオプション化する可能性あり）
      workbookMode: snapshot.workbookMode ?? undefined,
      isShuffleChoices: snapshot.isShuffleChoices,
      shuffleSeed: snapshot.shuffleSeed,
      examDate: normalizeExamDateOption(snapshot.examDate),
    },
    items,
    htmlImageState: {
      realized: shouldRealizeImages,
    },
  };
};
