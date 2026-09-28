// 第二段階: questionEditor と createPdf 双方から呼ぶ純粋変換の核 (T43)
// images / options / type は呼び出し側で付加する
import { exportHtmlForPreview } from '@renderer/api/quillUtils';
import type { TestData } from '@shared/types/contracts';
import type { PreviewFullPayload } from '@shared/types/preview';

/** images / options / type を除いたコアデータ */
export type PreviewCoreData = Omit<PreviewFullPayload, 'type' | 'images' | 'options'>;

/**
 * TestData の正規化済み入力から preview コアデータを組み立てる純粋変換。
 * questionEditor 用の単一問題 wrapper や createPdf 用の options は含まない。
 */
export const buildPreviewCoreData = (
  source: TestData,
  id: string,
): PreviewCoreData => {
  return {
    id: String(source.id ?? source.no ?? id),
    subject: String(source.subject || ''),
    bigCategoryTag: String(source.bigCategoryTag || ''),
    smallCategoryTag: String(source.smallCategoryTag || ''),
    nengo: String(source.nengo || ''),
    year: String(source.year || ''),
    difficult: Number(source.difficult ?? 0) || 0,
    testNo: String(source.testNo || ''),
    question: {
      textHtml: exportHtmlForPreview(String(source.text ?? '')),
      choices: [
        exportHtmlForPreview(String(source.ch1 ?? '')),
        exportHtmlForPreview(String(source.ch2 ?? '')),
        exportHtmlForPreview(String(source.ch3 ?? '')),
        exportHtmlForPreview(String(source.ch4 ?? '')),
        exportHtmlForPreview(String(source.ch5 ?? '')),
      ],
    },
    answer: {
      textHtml: exportHtmlForPreview(String(source.answerText ?? '')),
      choices: [
        exportHtmlForPreview(String(source.answerText1 ?? '')),
        exportHtmlForPreview(String(source.answerText2 ?? '')),
        exportHtmlForPreview(String(source.answerText3 ?? '')),
        exportHtmlForPreview(String(source.answerText4 ?? '')),
        exportHtmlForPreview(String(source.answerText5 ?? '')),
      ],
      // 否定問題（誤答選出形式）では isNegativeAnswer が true → 正解肢が × になる
      answerBool: source.isNegativeAnswer ? !source.answer : Boolean(source.answer),
      answerNo: String(source.answerNumber ?? ''),
    },
    questionEditorType: source.questionEditorType ?? 'normal',
    answerEditorType: source.answerEditorType ?? 'normal',
    publicationYear: String(source.publicationYear || ''),
    publicationNo: String(source.publicationNo || ''),
    otherTags: source.otherTags || [],
  };
};
