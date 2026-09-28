import type { PreviewOptions } from '@shared/types/preview';
export type PreviewMode = 'both' | 'onlyQuestion' | 'onlyAnswer';

import type {
  answerEditorType,
  questionEditorType,
} from '@shared/types/contracts';
export interface PreviewPageOptions {
  size: 'A4';
  pxPerMm: number;
  baseHeightMm: number;
}

export interface PreviewMeta {
  title: string;
  subject: string;
  grade: string;
}

export interface PreviewItem {
  id: string;
  subject: string;
  bigCategoryTag: string;
  smallCategoryTag: string;
  nengo: string;
  year: number;
  testNo?: string;
  textHtml?: string;
  questionChoicesHtml?: string[];
  answerTextHtml?: string;
  answerChoicesHtml?: string[];
  answerBool: boolean;
  answerNo: string;
  difficult: number;
  publicationYear?: string;
  publicationNo?: string;
  otherTags?: string[];
  questionEditorType?: questionEditorType;
  answerEditorType?: answerEditorType;
  // 0 または undefined の場合はシャッフルしない（buildCreatePdfPreviewSnapshot.ts の buildItem で確定済み）
  shuffleSeed?: number;
  // true のとき、この問題の直前で強制改ページを行う（先頭問題には適用しない）
  forcePageBreak?: boolean;
}

export interface LayoutState {
  options: PreviewOptions & { gradeNumber?: 1 | 2 };
  items: PreviewItem[];
  htmlImageState?: {
    realized: boolean;
  };
}

export interface PageMapEntry {
  itemId: string;
  subject: string;
  smallCategory: string;
  questionIndex: number; // 同一科目・小項目内での通し番号(mNo)
  questionPage?: number; // 問題ページ（1始まり）
  answerPage?: number; // 解説ページ（1始まり）
  questionNodeId?: string; // test-... の id
  answerNodeId?: string; // answer-... の id
}

export interface LayoutResult {
  pageMap: PageMapEntry[];
}
