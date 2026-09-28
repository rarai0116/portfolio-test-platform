// createPdf 向けプレビュー snapshot 組み立て純粋関数 (T43)
// TestData map + imageItems + store state から CreatePdfPreviewSnapshot を生成する

import type { ImageItem } from '@api/imageAssetMeta';
import { extractImageIdsFromHtml, toIsoFromTimestampLike } from '@api/utils';
import { exportHtmlForPreview } from '@renderer/api/quillUtils';
import type { TestData } from '@shared/types/contracts';
import type { ExamDateOption } from '@shared/types/createPdfConditionJson';
import type {
  CreatePdfPreviewImageRef,
  CreatePdfPreviewItem,
  CreatePdfPreviewSnapshot,
} from '@shared/types/pdfPreview';
import type {
  TestTableRow,
  TestTableSection,
} from '@views/createPdf/types/testTable';
import type { WorkbookMode } from '@views/createPdf/types/viewState';
import { getChoiceIndices, normalizeQaaChoiceIndex } from './candidateIndex';

export type BuildSnapshotResult = {
  snapshot: CreatePdfPreviewSnapshot;
  /** answerText[n] が空文字だった場合の警告リスト */
  warnings: { itemId: string; sourceNo: number; message: string }[];
};

const collectRequiredImageKeysFromItems = (
  items: readonly CreatePdfPreviewItem[],
): Set<string> => {
  const keys = new Set<string>();

  for (const item of items) {
    const htmlBlocks = [
      item.questionHtml,
      item.answerHtml,
      ...(item.questionChoicesHtml ?? []),
      ...(item.answerChoicesHtml ?? []),
    ];

    for (const html of htmlBlocks) {
      if (!html) continue;
      for (const key of extractImageIdsFromHtml(html)) {
        keys.add(key);
      }
    }
  }

  return keys;
};

/** grade 数値 → Firestore コレクション名 */
const toGradeId = (grade: 1 | 2): 'firstGrade' | 'secondGrade' =>
  grade === 1 ? 'firstGrade' : 'secondGrade';

/** ch1〜ch5 のフィールド名（1始まりの選択肢番号）を取得する */
const getChoiceField = (idx: number): `ch${1 | 2 | 3 | 4 | 5}` | null => {
  const fields = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5'] as const;
  return fields[idx - 1] ?? null;
};

/**
 * qaa モードにおける answerBool を計算する。
 * - qaaChoiceIndex が null の場合は undefined を返し、呼び出し元でスキップを判断する。
 * - 正答選出形式 (isNegativeAnswer=false): 選択肢が answerNumber と一致 → true (○)
 * - 否定問題形式 (isNegativeAnswer=true): 選択肢が answerNumber と一致 → false (×)
 */
const calcQaaAnswerBool = (
  source: TestData,
  qaaChoiceIndex: number,
): boolean => {
  const choiceNo = qaaChoiceIndex;
  const isMatchingAnswer = choiceNo === Number(source.answerNumber);
  // 否定問題: answerNumber が「誤りの肢」を指す → 表示した肢がそれなら × (false)
  return source.isNegativeAnswer ? !isMatchingAnswer : isMatchingAnswer;
};

type BuildItemParams = {
  row: TestTableRow;
  source: TestData;
  grade: 1 | 2;
  workbookMode: WorkbookMode;
  itemIndex: number;
  warnings: BuildSnapshotResult['warnings'];
  isShuffleChoices: boolean;
  shuffleSeed: number | null;
};

/** 1行分の CreatePdfPreviewItem を生成する。スキップすべき場合は null を返す。 */
const buildItem = ({
  row,
  source,
  grade,
  workbookMode,
  itemIndex,
  warnings,
  isShuffleChoices,
  shuffleSeed,
}: BuildItemParams): CreatePdfPreviewItem | null => {
  if (workbookMode === 'multipleChoice') {
    const choiceIndices = getChoiceIndices(grade);
    const questionChoicesHtml = choiceIndices
      .map((choiceIndex) => {
        const field = getChoiceField(choiceIndex);
        return field ? exportHtmlForPreview(String(source[field] ?? '')) : '';
      })
      .filter((h) => h.length > 0);

    const answerChoicesHtml = choiceIndices
      .map((choiceIndex) => {
        const field = `answerText${choiceIndex}` as
          | 'answerText1'
          | 'answerText2'
          | 'answerText3'
          | 'answerText4'
          | 'answerText5';
        return exportHtmlForPreview(String(source[field] ?? ''));
      })
      .filter((h) => h.length > 0);

    return {
      itemId: row.id,
      sourceNo: source.no,
      sourceKind: source.isOriginal ? 'original' : 'existing',
      subject: source.subject || undefined,
      bigCategoryTag: String(source.bigCategoryTag || ''),
      smallCategoryTag: String(source.smallCategoryTag || ''),
      nengo: String(source.nengo || '') || undefined,
      year: String(source.year || '') || undefined,
      testNo: String(source.testNo || '') || undefined,
      publicationYear: String(source.publicationYear || '') || undefined,
      publicationNo: String(source.publicationNo || '') || undefined,
      difficult: Number(source.difficult) || undefined,
      questionHtml: exportHtmlForPreview(String(source.text ?? '')),
      questionChoicesHtml,
      answerHtml: exportHtmlForPreview(String(source.answerText ?? '')),
      answerChoicesHtml,
      answerNo: String(source.answerNumber || ''),
      questionEditorType: source.questionEditorType,
      answerEditorType: source.answerEditorType,
      forcePageBreak: row.pageBreakBefore && itemIndex > 0,
      shuffleSeed: (() => {
        // multipleChoice 内で isShuffleable 判定を完結させる。
        // シャッフル OFF / シードなし / isShuffleable が false のいずれかで 0 を返す
        if (!isShuffleChoices) return 0;
        if (!shuffleSeed) return 0;
        if (!source.isShuffleable) return 0;
        return shuffleSeed;
      })(),
    };
  }

  // qaa / qaaAllTrue / qaaAllFalse
  const choiceIndex = normalizeQaaChoiceIndex(row.qaaChoiceIndex);
  if (choiceIndex === null) return null; // 選択肢未指定行はスキップ

  const field = getChoiceField(choiceIndex);
  if (!field) return null;

  const choiceText = String(source[field] ?? '');
  if (!choiceText) return null;

  // answerText[qaaChoiceIndex] を選択肢別解説として使用
  const answerTextField = `answerText${choiceIndex}` as
    | 'answerText1'
    | 'answerText2'
    | 'answerText3'
    | 'answerText4'
    | 'answerText5';
  const choiceAnswerText = String(source[answerTextField] ?? '');
  if (!choiceAnswerText) {
    const msg = `answerText${choiceIndex} が空文字です (sourceNo: ${source.no})`;
    console.warn(`[buildCreatePdfPreviewSnapshot] ${msg}`);
    warnings.push({ itemId: row.id, sourceNo: source.no, message: msg });
  }

  let answerBool: boolean;
  if (workbookMode === 'qaaAllTrue') {
    answerBool = true;
  } else if (workbookMode === 'qaaAllFalse') {
    answerBool = false;
  } else {
    // qaa: qaaChoiceIndex と answerNumber から計算
    answerBool = calcQaaAnswerBool(source, choiceIndex);
  }

  const answerHtml = exportHtmlForPreview(choiceAnswerText);

  return {
    itemId: row.id,
    sourceNo: source.no,
    sourceKind: source.isOriginal ? 'original' : 'existing',
    subject: source.subject,
    bigCategoryTag: String(source.bigCategoryTag || ''),
    smallCategoryTag: String(source.smallCategoryTag || ''),
    nengo: String(source.nengo || '') || undefined,
    year: String(source.year || '') || undefined,
    testNo: String(source.testNo || '') || undefined,
    publicationYear: String(source.publicationYear || '') || undefined,
    publicationNo: String(source.publicationNo || '') || undefined,
    difficult: Number(source.difficult) || undefined,
    questionHtml: exportHtmlForPreview(choiceText),
    answerHtml,
    answerBool,
    questionEditorType: source.questionEditorType,
    answerEditorType: source.answerEditorType,
    forcePageBreak: row.pageBreakBefore && itemIndex > 0,
  };
};

type BuildSnapshotParams = {
  grade: 1 | 2;
  title: string;
  creationType: 'exam' | 'workbook';
  /** workbook モード。creationType === 'workbook' のときのみ参照する */
  workbookMode?: WorkbookMode;
  /** workbook テーブル行。creationType === 'workbook' のとき参照する */
  tableRows?: TestTableRow[];
  /** exam セクション群。creationType === 'exam' のとき参照する */
  tableSections?: TestTableSection[];
  testDataByNo: ReadonlyMap<number, TestData>;
  /** grade に対応する画像メタ一覧。imageRefs 組立に使う */
  imageItems: ImageItem[];
  generatedAt?: string;
  /** 選択肢シャッフル機能の ON/OFF */
  isShuffleChoices?: boolean;
  /** グローバルシード値。null の場合はシャッフルしない */
  shuffleSeed?: number | null;
  /** 模擬試験表紙の実施年月日。creationType === 'exam' のときのみ使用する。 */
  examDate?: ExamDateOption;
};

/**
 * createPdf View の state + TestData + 画像メタから snapshot を組み立てる純粋関数。
 * TestData の取得・Firestore 購読は行わない。呼び出し元で解決してから渡す。
 */
export const buildCreatePdfPreviewSnapshot = (
  params: BuildSnapshotParams,
): BuildSnapshotResult => {
  const {
    grade,
    title,
    creationType,
    workbookMode = 'multipleChoice',
    tableRows = [],
    tableSections = [],
    testDataByNo,
    imageItems,
    generatedAt = new Date().toISOString(),
    isShuffleChoices = false,
    shuffleSeed = null,
    examDate,
  } = params;

  // 全問テーブル行をフラット化（exam は各セクションの rows を結合）
  const allRows: TestTableRow[] =
    creationType === 'workbook'
      ? tableRows
      : tableSections.flatMap((s) => s.rows);

  const items: CreatePdfPreviewItem[] = [];
  const warnings: BuildSnapshotResult['warnings'] = [];
  let itemIndex = 0;

  for (const row of allRows) {
    if (!row.selectedNo) continue;
    const no = Number(row.selectedNo);
    if (!Number.isFinite(no)) continue;
    const source = testDataByNo.get(no);
    if (!source) continue;

    const item = buildItem({
      row,
      source,
      grade,
      workbookMode,
      itemIndex,
      warnings,
      isShuffleChoices,
      shuffleSeed,
    });
    if (item) {
      items.push(item);
      itemIndex++;
    }
  }

  const gradeId = toGradeId(grade);
  const requiredImageKeys = collectRequiredImageKeysFromItems(items);
  const imageRefs: CreatePdfPreviewImageRef[] = imageItems
    .filter((img) => requiredImageKeys.has(img.key))
    .map((img) => {
      return {
        grade: gradeId,
        key: img.key,
        objectPath: img.objectPath,
        updatedAt: toIsoFromTimestampLike(img.updatedAt),
        width: img.width,
        height: img.height,
      };
    });

  const snapshot: CreatePdfPreviewSnapshot = {
    schemaVersion: 1,
    creationType,
    workbookMode: creationType === 'workbook' ? workbookMode : null,
    grade,
    title,
    layout: {
      pageSize: creationType === 'exam' ? 'A4' : 'B5',
      hasCover: true,
      hasSubCategoryHeading: creationType === 'workbook',
    },
    items,
    imageRefs,
    generatedAt,
    isShuffleChoices,
    shuffleSeed,
    ...(creationType === 'exam' ? { examDate } : {}),
  };

  return { snapshot, warnings };
};
