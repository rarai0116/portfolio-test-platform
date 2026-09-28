import type {
  answerEditorType,
  questionEditorType,
} from '@shared/types/contracts';
import type { ExamDateOption } from '@shared/types/createPdfConditionJson';
import type { CreatePdfWorkbookMode } from '@shared/types/pdfPreview';
export const PreviewChannels = {
  send: 'preview:send',
  set: 'preview:set',
  getLatest: 'preview:getLatest',
  imagePatch: 'preview:imagePatch',
  openWindow: 'preview:openWindow',
  closeWindow: 'preview:closeWindow',
  windowClosed: 'preview:windowClosed',
} as const;

export type PreviewMode = 'both' | 'onlyQuestion' | 'onlyAnswer';
export type PreviewImage = {
  /** demo-asset:// のURL。画像本体はプロセス間で運ばない（設計11.4） */
  url: string;
  contentType?: string;
  width?: number;
  height?: number;
};
export type PreviewImagesMap = Record<string, PreviewImage>; // keyは<img alt="key">のkey

export type PreviewOptions = {
  mode?: PreviewMode;
  hasCover?: boolean;
  questionCount?: number;
  meta?: { title?: string; subject?: string; grade?: string };
  page?: { size?: 'B5' | 'A4'; pxPerMm?: number; baseHeightMm?: number };
  questionEditorType: questionEditorType;
  answerEditorType: answerEditorType;
  hasSubCategoryHeading?: boolean; // 小項目見出しの有無
  hasNoNengoAndYear?: boolean; // 年号・年度の有無(trueのときは空欄になる)
  hasNoDifficult?: boolean; // 難易度の有無(trueのときは空欄になる)
  isOriginal?: boolean; // オリジナル問題かどうか
  isSerialNumber?: boolean; // 連番表示の有無
  creationType?: 'exam' | 'workbook'; // 作成物の種類（問題集 or 模擬試験。undefinedの場合は問題集）
  workbookMode?: CreatePdfWorkbookMode; // 問題集出題形式。一問一答系か選択問題かの判定に使用
  // optional: 既存保存データとの後方互換を保つため
  isShuffleChoices?: boolean; // 選択肢シャッフル機能の ON/OFF
  shuffleSeed?: number | null; // グローバルシード値（参照のみ。実際のシャッフルは PreviewItem.shuffleSeed で制御）
  examDate?: ExamDateOption; // 模擬試験表紙の実施年月日
};

export type PreviewQuestionState = {
  textHtml: string;
  choices: string[];
  questionEditorType?: questionEditorType;
};

export type PreviewAnswerState = {
  textHtml: string;
  choices: string[];
  answerBool?: boolean;
  answerNo: string;
  answerEditorType?: answerEditorType;
};

export type PreviewFullPayload = {
  id: string;
  subject: string;
  type: 'full';
  bigCategoryTag?: string;
  smallCategoryTag?: string;
  nengo?: string;
  year?: string;
  testNo?: string;
  difficult: number;
  question: PreviewQuestionState;
  answer: PreviewAnswerState;
  questionEditorType?: questionEditorType;
  answerEditorType?: answerEditorType;
  publicationYear?: string;
  publicationNo?: string;
  otherTags?: string[];
  images?: PreviewImagesMap;
  options?: PreviewOptions;
};

export type PreviewChangedFields = Partial<
  Record<
    | 'subject'
    | 'bigCategoryTag'
    | 'smallCategoryTag'
    | 'nengo'
    | 'year'
    | 'testNo'
    | 'difficult'
    | 'questionTextHtml'
    | 'questionChoices'
    | 'answerTextHtml'
    | 'answerChoices'
    | 'answerBool'
    | 'answerNo'
    | 'questionEditorType'
    | 'answerEditorType'
    | 'publicationYear'
    | 'publicationNo'
    | 'otherTags'
    | 'options'
    | 'images',
    true
  >
>;

export type PreviewPatchPayload = {
  id: string;
  type: 'patch';
  changed: PreviewChangedFields;
  subject?: string;
  bigCategoryTag?: string;
  smallCategoryTag?: string;
  nengo?: string;
  year?: string;
  testNo?: string;
  difficult?: number;
  question?: Partial<PreviewQuestionState>;
  answer?: Partial<PreviewAnswerState>;
  questionEditorType?: questionEditorType;
  answerEditorType?: answerEditorType;
  publicationYear?: string;
  publicationNo?: string;
  otherTags?: string[];
  images?: PreviewImagesMap;
  options?: PreviewOptions;
};

export type PreviewResolvedPayload = PreviewFullPayload;
export type PreviewSendPayload = PreviewFullPayload | PreviewPatchPayload;
export type PreviewSetPayload = PreviewSendPayload;

export type PreviewGetLatestResult =
  | { ok: true; payload?: PreviewSetPayload }
  | { ok: false; error: string };

export type PreviewWindowOpenResult =
  | { ok: true; reused: boolean }
  | { ok: false; error: string };

export type PreviewWindowCloseResult =
  | { ok: true }
  | { ok: false; error: string };

export type PreviewImagePatchPayload = {
  id: string;
  images: PreviewImagesMap;
};
