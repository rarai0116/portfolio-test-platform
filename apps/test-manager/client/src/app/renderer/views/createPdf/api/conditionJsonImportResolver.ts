import {
  buildItemSeedStr,
  generateShuffleSeed,
  shuffleWithSeed,
} from '@api/shuffleSeed';
import type { TestData, TestSubject } from '@shared/types/contracts';
import type {
  CreatePdfConditionJson,
  SelectedReference,
  WorkbookConditionJson,
  WorkbookConditionRow,
  WorkbookTableRow,
} from '@shared/types/createPdfConditionJson';
import type { CreatePdfTestCategoryResourceState } from '@views/createPdf/store/useCreatePdfResourceStore';
import {
  buildCreatePdfTestCategoryCacheKey,
  CREATE_PDF_TEST_CATEGORY_SUBJECTS,
  createEmptyCreatePdfBigKeysBySubject,
} from '@views/createPdf/store/useCreatePdfResourceStore';
import type { WorkbookMode } from '@views/createPdf/types/viewState';
import {
  calcQaaAnswerBool,
  getChoiceIndices,
  hasChoiceHtml,
  toCandidateKey,
} from './candidateIndex';
import {
  buildLegacyTestDataReferenceMap,
  buildReferenceKeyFromSelectedReference,
  buildSelectedReference,
  normalizeReferencePublicationNo,
} from './conditionJsonReference';
import { deriveYearFilterOptions } from './createPdfDerivedInputs';

export type ConditionJsonImportSourceType =
  | 'current-workbook'
  | 'current-exam'
  | 'legacy-qaa-workbook';

export type ConditionJsonImportSummary = {
  sourceType: ConditionJsonImportSourceType;
  inputRowCount: number;
  convertedRowCount: number;
  skippedRowCount: number;
  blankedRowCount: number;
  subjectMismatchRowCount: number;
};

export type ResolvedLoadedConditionJson = {
  json: CreatePdfConditionJson;
  importSummary: ConditionJsonImportSummary;
};

export type LoadedConditionJsonImportMeta = {
  sourceType: ConditionJsonImportSourceType;
  creationType: CreatePdfConditionJson['creationType'];
  gradeId: 1 | 2;
};

export type LegacyCategorySnapshot = Pick<
  CreatePdfTestCategoryResourceState,
  'bigKeysBySubject' | 'smallKeysBySubjectAndBig'
>;

export type LegacyCategoryLoader = (params: {
  grade: 1 | 2;
  baseSubject: TestSubject | null;
}) => Promise<LegacyCategorySnapshot | null>;

type ResolveLoadedConditionJsonParams = {
  testDataByNo: ReadonlyMap<number, TestData>;
  testCategory: CreatePdfTestCategoryResourceState;
  loadLegacyCategorySnapshot?: LegacyCategoryLoader;
};

type LegacyQaaWorkbookJson = {
  testName?: unknown;
  testMode?: unknown;
  optionSetting?: unknown;
  lists: unknown[];
};

type LegacyRow = Record<string, unknown>;

type LegacyCategoryResolver = {
  resolve: (params: {
    subject: string;
    bigCategoryTag: unknown;
    smallCategoryTag: unknown;
  }) => {
    subject: TestSubject;
    bigCategoryTag: string;
    smallCategoryTag: string;
  } | null;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isTestSubject = (value: string): value is TestSubject =>
  CREATE_PDF_TEST_CATEGORY_SUBJECTS.includes(value as TestSubject);

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toLegacyGradeId = (value: unknown): 1 | 2 | null => {
  const grade = Number(value);
  if (grade === 0) return 1;
  if (grade === 1) return 2;
  return null;
};

const isCurrentConditionJson = (
  value: unknown,
): value is CreatePdfConditionJson => {
  if (!isObject(value)) return false;
  if (value.version !== 1) return false;
  if (value.creationType === 'workbook') {
    return Array.isArray(value.conditions) && Array.isArray(value.table);
  }
  if (value.creationType === 'exam') {
    return Array.isArray(value.slots);
  }
  return false;
};

const isLegacyQaaWorkbookJson = (
  value: unknown,
): value is LegacyQaaWorkbookJson =>
  isObject(value) &&
  !('version' in value) &&
  !('creationType' in value) &&
  typeof value.testMode === 'string' &&
  Array.isArray(value.lists) &&
  value.lists.every(Array.isArray);

const getCurrentImportSummary = (
  json: CreatePdfConditionJson,
): ConditionJsonImportSummary => {
  const rowCount =
    json.creationType === 'workbook' ? json.table.length : json.slots.length;
  return {
    sourceType:
      json.creationType === 'workbook' ? 'current-workbook' : 'current-exam',
    inputRowCount: rowCount,
    convertedRowCount: rowCount,
    skippedRowCount: 0,
    blankedRowCount: 0,
    subjectMismatchRowCount: 0,
  };
};

export const resolveLoadedConditionJsonImportMeta = (
  rawJson: unknown,
): LoadedConditionJsonImportMeta => {
  if (isCurrentConditionJson(rawJson)) {
    return {
      sourceType:
        rawJson.creationType === 'workbook'
          ? 'current-workbook'
          : 'current-exam',
      creationType: rawJson.creationType,
      gradeId: rawJson.gradeId,
    };
  }

  if (isLegacyQaaWorkbookJson(rawJson)) {
    const flatItems = flattenLegacyRows(rawJson.lists);
    const rows = flatItems.filter(isObject);
    if (rows.length === 0) {
      throw new Error('旧アプリJSONに問題データがありません。');
    }

    return {
      sourceType: 'legacy-qaa-workbook',
      creationType: 'workbook',
      gradeId: getLegacyGrade(rows),
    };
  }

  throw new Error(
    '無効なJSONファイルです。本アプリ用JSONまたは旧一問一答アプリJSONとして判定できません。',
  );
};

const convertTestMode = (testMode: unknown): WorkbookMode | null => {
  switch (testMode) {
    case 'mode-choices-normal':
      return 'multipleChoice';
    case 'mode-qaa-normal':
      return 'qaa';
    case 'mode-qaa-all-correct':
      return 'qaaAllTrue';
    case 'mode-qaa-all-incorrect':
      return 'qaaAllFalse';
    default:
      return null;
  }
};

const flattenLegacyRows = (lists: unknown[]): unknown[] =>
  lists.flatMap((list) => (Array.isArray(list) ? list : []));

const parseParentbNo = (parentbNo: unknown) => {
  const value = toTrimmedString(parentbNo);
  if (value === null) {
    return { publicationYear: null, publicationNo: null };
  }

  const parts = value.split('_');
  return {
    publicationYear: toTrimmedString(parts[0]) ?? null,
    publicationNo: normalizeReferencePublicationNo(toTrimmedString(parts[2])),
  };
};

const buildLegacySelectedReference = (
  row: LegacyRow,
): SelectedReference | null => {
  const subject = toTrimmedString(row.sublect);
  const no = toTrimmedString(row.testNo);
  if (subject === null || no === null) return null;

  const { publicationYear, publicationNo } = parseParentbNo(row.parentbNo);
  return {
    nengo: toTrimmedString(row.nengo),
    year: toTrimmedString(row.year),
    subject,
    no,
    isOriginal: false,
    publicationYear,
    publicationNo,
  };
};

const summarizeLegacyRowForLog = (row: LegacyRow) => ({
  legacyNo: toTrimmedString(row.No),
  grade: row.grade,
  subject: toTrimmedString(row.sublect),
  nengo: toTrimmedString(row.nengo),
  year: toTrimmedString(row.year),
  testNo: toTrimmedString(row.testNo),
  parentbNo: toTrimmedString(row.parentbNo),
  tagA: toTrimmedString(row.tagA),
  tagB: toTrimmedString(row.tagB),
});

const logLegacyProblemNoUnresolved = (params: {
  rowId: string;
  reason:
    | 'subject_mismatch'
    | 'reference_not_matched'
    | 'category_not_matched'
    | 'qaa_choice_candidate_exhausted';
  row: LegacyRow;
  baseSubject?: string;
  legacyReference?: SelectedReference | null;
  referenceKey?: string | null;
}) => {
  console.log('[createPdf:legacyJsonImport] problem no unresolved', {
    rowId: params.rowId,
    reason: params.reason,
    baseSubject: params.baseSubject,
    legacyReference: params.legacyReference,
    referenceKey: params.referenceKey,
    legacyRow: summarizeLegacyRowForLog(params.row),
  });
};

const getLegacyGrade = (rows: LegacyRow[]): 1 | 2 => {
  const grades = new Set(rows.map((row) => toLegacyGradeId(row.grade)));
  if (grades.has(null)) {
    throw new Error('対応していない級のJSONです。');
  }
  if (grades.size !== 1) {
    throw new Error('複数の級が混在する旧アプリJSONは読み込めません。');
  }

  const [grade] = [...grades];
  if (grade !== 1 && grade !== 2) {
    throw new Error('対応していない級のJSONです。');
  }
  return grade;
};

const getLegacyBaseSubject = (rows: LegacyRow[]): string => {
  const baseSubject = toTrimmedString(rows[0]?.sublect);
  if (baseSubject === null) {
    throw new Error('旧アプリJSONの学科を判定できません。');
  }
  return baseSubject;
};

const buildCategoryResolver = (
  snapshot: LegacyCategorySnapshot,
): LegacyCategoryResolver => ({
  resolve: ({ subject, bigCategoryTag, smallCategoryTag }) => {
    if (!isTestSubject(subject)) return null;

    const big = toTrimmedString(bigCategoryTag);
    const small = toTrimmedString(smallCategoryTag);
    if (big === null || small === null) return null;

    const bigKeys = snapshot.bigKeysBySubject[subject] ?? [];
    if (!bigKeys.includes(big)) return null;

    const smallKey = buildCreatePdfTestCategoryCacheKey(subject, big);
    const smallKeys = snapshot.smallKeysBySubjectAndBig[smallKey] ?? [];
    if (!smallKeys.includes(small)) return null;

    return {
      subject,
      bigCategoryTag: big,
      smallCategoryTag: small,
    };
  },
});

const getLegacyCategorySnapshot = async (params: {
  grade: 1 | 2;
  baseSubject: string;
  testCategory: CreatePdfTestCategoryResourceState;
  loadLegacyCategorySnapshot?: LegacyCategoryLoader;
}): Promise<LegacyCategorySnapshot> => {
  const { grade, baseSubject, testCategory, loadLegacyCategorySnapshot } =
    params;

  if (testCategory.grade === grade && !testCategory.isLoading) {
    return {
      bigKeysBySubject: testCategory.bigKeysBySubject,
      smallKeysBySubjectAndBig: testCategory.smallKeysBySubjectAndBig,
    };
  }

  const loaded = await loadLegacyCategorySnapshot?.({
    grade,
    baseSubject: isTestSubject(baseSubject) ? baseSubject : null,
  });
  if (loaded !== undefined && loaded !== null) return loaded;

  return {
    bigKeysBySubject: createEmptyCreatePdfBigKeysBySubject(),
    smallKeysBySubjectAndBig: {},
  };
};

const getQaaChoiceIndex = (params: {
  rowId: string;
  data: TestData;
  grade: 1 | 2;
  mode: WorkbookMode;
  usedCandidateKeys: Set<string>;
  qaaAssignSeed: number;
}): number | null => {
  const { rowId, data, grade, mode, usedCandidateKeys, qaaAssignSeed } = params;
  if (mode === 'multipleChoice' || !data.isConvertibleQaa) return null;

  const candidates = getChoiceIndices(grade).filter((choiceIndex) => {
    if (!hasChoiceHtml(data, choiceIndex)) return false;
    if (mode === 'qaaAllTrue' && !calcQaaAnswerBool(data, choiceIndex)) {
      return false;
    }
    if (mode === 'qaaAllFalse' && calcQaaAnswerBool(data, choiceIndex)) {
      return false;
    }

    return !usedCandidateKeys.has(toCandidateKey(data.no, choiceIndex));
  });

  if (candidates.length === 0) return null;

  const { shuffled } = shuffleWithSeed(
    candidates,
    buildItemSeedStr(qaaAssignSeed, rowId),
  );
  const choiceIndex = shuffled[0] ?? null;
  if (choiceIndex !== null) {
    usedCandidateKeys.add(toCandidateKey(data.no, choiceIndex));
  }
  return choiceIndex;
};

const createLegacyConditionBuilder = () => {
  const conditions: WorkbookConditionRow[] = [];
  const conditionIdByKey = new Map<string, string>();

  return {
    conditions,
    getConditionId: (params: {
      subject: string;
      bigCategoryTag: string;
      smallCategoryTag: string;
    }) => {
      const key = JSON.stringify([
        params.subject,
        params.bigCategoryTag,
        params.smallCategoryTag,
      ]);
      const existing = conditionIdByKey.get(key);
      if (existing !== undefined) {
        const condition = conditions.find((row) => row.id === existing);
        if (condition !== undefined) condition.count += 1;
        return existing;
      }

      const id = `legacy-cond-${conditions.length + 1}`;
      conditionIdByKey.set(key, id);
      conditions.push({
        id,
        subject: params.subject,
        bigCategoryTag: params.bigCategoryTag,
        smallCategoryTag: params.smallCategoryTag,
        count: 1,
      });
      return id;
    },
  };
};

const convertLegacyQaaWorkbookJson = async (
  legacyJson: LegacyQaaWorkbookJson,
  params: ResolveLoadedConditionJsonParams,
): Promise<ResolvedLoadedConditionJson> => {
  const mode = convertTestMode(legacyJson.testMode);
  if (mode === null) {
    throw new Error('対応していない旧アプリJSONの問題形式です。');
  }

  const flatItems = flattenLegacyRows(legacyJson.lists);
  if (flatItems.length === 0) {
    throw new Error('旧アプリJSONに問題データがありません。');
  }

  const rows = flatItems.filter(isObject);
  if (rows.length === 0) {
    throw new Error('旧アプリJSONに問題データがありません。');
  }

  const gradeId = getLegacyGrade(rows);
  const baseSubject = getLegacyBaseSubject(rows);
  const categorySnapshot = await getLegacyCategorySnapshot({
    grade: gradeId,
    baseSubject,
    testCategory: params.testCategory,
    loadLegacyCategorySnapshot: params.loadLegacyCategorySnapshot,
  });
  const categoryResolver = buildCategoryResolver(categorySnapshot);
  const referenceMap = buildLegacyTestDataReferenceMap(params.testDataByNo);

  const optionSetting = isObject(legacyJson.optionSetting)
    ? legacyJson.optionSetting
    : {};
  const isChoiceShuffle =
    typeof optionSetting.isChoiceShuffle === 'boolean'
      ? optionSetting.isChoiceShuffle
      : true;
  const shuffleSeed = isChoiceShuffle ? generateShuffleSeed() : null;
  const qaaAssignSeed = shuffleSeed ?? generateShuffleSeed();
  const title = toTrimmedString(legacyJson.testName) ?? '旧アプリ問題集';
  const conditionBuilder = createLegacyConditionBuilder();
  const table: WorkbookTableRow[] = [];
  const usedCandidateKeys = new Set<string>();
  let skippedRowCount = flatItems.length - rows.length;
  let blankedRowCount = 0;
  let subjectMismatchRowCount = 0;

  for (const [index, row] of rows.entries()) {
    const rowId = `legacy-row-${index + 1}`;
    const rowSubject = toTrimmedString(row.sublect);
    if (rowSubject !== baseSubject) {
      subjectMismatchRowCount += 1;
      logLegacyProblemNoUnresolved({
        rowId,
        reason: 'subject_mismatch',
        row,
        baseSubject,
      });
      continue;
    }

    const legacyRef = buildLegacySelectedReference(row);
    const referenceKey =
      legacyRef !== null
        ? buildReferenceKeyFromSelectedReference(legacyRef)
        : null;
    const matchedData =
      referenceKey !== null ? referenceMap.get(referenceKey) : undefined;
    const category =
      matchedData !== undefined
        ? {
            subject: matchedData.subject,
            bigCategoryTag: matchedData.bigCategoryTag,
            smallCategoryTag: matchedData.smallCategoryTag,
          }
        : categoryResolver.resolve({
            subject: rowSubject ?? '',
            bigCategoryTag: row.tagA,
            smallCategoryTag: row.tagB,
          });

    if (matchedData === undefined) {
      logLegacyProblemNoUnresolved({
        rowId,
        reason: 'reference_not_matched',
        row,
        legacyReference: legacyRef,
        referenceKey,
      });
    }

    if (category === null) {
      skippedRowCount += 1;
      logLegacyProblemNoUnresolved({
        rowId,
        reason: 'category_not_matched',
        row,
        legacyReference: legacyRef,
        referenceKey,
      });
      continue;
    }

    const conditionId = conditionBuilder.getConditionId(category);
    const categoryPairs = [
      {
        big: category.bigCategoryTag,
        small: category.smallCategoryTag,
      },
    ];

    if (matchedData === undefined) {
      table.push({
        id: rowId,
        sourceConditionId: conditionId,
        categoryPairs,
        selectedNo: null,
        selectedUuid: null,
        selectedReference: null,
        qaaChoiceIndex: null,
        isFixed: false,
        pageBreakBefore: false,
      });
      continue;
    }

    const qaaChoiceIndex = getQaaChoiceIndex({
      rowId,
      data: matchedData,
      grade: gradeId,
      mode,
      usedCandidateKeys,
      qaaAssignSeed,
    });

    if (mode !== 'multipleChoice' && qaaChoiceIndex === null) {
      blankedRowCount += 1;
      logLegacyProblemNoUnresolved({
        rowId,
        reason: 'qaa_choice_candidate_exhausted',
        row,
        legacyReference: legacyRef,
        referenceKey,
      });
      table.push({
        id: rowId,
        sourceConditionId: conditionId,
        categoryPairs,
        selectedNo: null,
        selectedUuid: null,
        selectedReference: null,
        qaaChoiceIndex: null,
        isFixed: false,
        pageBreakBefore: false,
      });
      continue;
    }

    table.push({
      id: rowId,
      sourceConditionId: conditionId,
      categoryPairs,
      selectedNo: String(matchedData.no),
      selectedUuid: matchedData.uuid ?? null,
      selectedReference: buildSelectedReference(matchedData),
      qaaChoiceIndex,
      isFixed: false,
      pageBreakBefore: false,
    });
  }

  const json: WorkbookConditionJson = {
    version: 1,
    creationType: 'workbook',
    gradeId,
    title,
    createdAt: new Date().toISOString(),
    shuffleSeed,
    mode,
    excludedTagIds: [],
    excludePastExam: false,
    excludeOriginal: false,
    isChoiceShuffle,
    difficulty: {
      isEnabled: false,
      ratios: [30, 70],
    },
    selectedOutputFolder: null,
    selectedYears: deriveYearFilterOptions(params.testDataByNo).sortedLabels,
    showQaaChoiceIndex: mode !== 'multipleChoice',
    conditions: conditionBuilder.conditions,
    table,
  };

  return {
    json,
    importSummary: {
      sourceType: 'legacy-qaa-workbook',
      inputRowCount: flatItems.length,
      convertedRowCount: table.length,
      skippedRowCount,
      blankedRowCount,
      subjectMismatchRowCount,
    },
  };
};

export const resolveLoadedConditionJson = async (
  rawJson: unknown,
  params: ResolveLoadedConditionJsonParams,
): Promise<ResolvedLoadedConditionJson> => {
  if (isCurrentConditionJson(rawJson)) {
    return {
      json: rawJson,
      importSummary: getCurrentImportSummary(rawJson),
    };
  }

  if (isLegacyQaaWorkbookJson(rawJson)) {
    return convertLegacyQaaWorkbookJson(rawJson, params);
  }

  throw new Error(
    '無効なJSONファイルです。本アプリ用JSONまたは旧一問一答アプリJSONとして判定できません。',
  );
};
