import type { TestData } from '@shared/types/contracts';
import {
  buildCandidateIndex,
  type CandidateIndex,
} from '@views/createPdf/api/candidateIndex';
import { deriveCreatePdfTestTableChecks } from '@views/createPdf/api/createPdfTestTableChecks';
import {
  buildNosMapFromTestData,
  sortYearLabelsDesc,
} from '@views/createPdf/api/yearFilterUtils';
import type { CreatePdfCommonOptionDraftState } from '@views/createPdf/types/draftState';
import type { CreatePdfTestTableCheckSnapshot } from '@views/createPdf/types/statusState';
import type {
  TestTableSection,
  TestTableSectionMode,
} from '@views/createPdf/types/testTable';
import type { WorkbookMode } from '@views/createPdf/types/viewState';

const NO_ACTIVE_CONDITION_IDS = {};

const nosMapCache = new WeakMap<
  ReadonlyMap<number, TestData>,
  ReadonlyMap<string, readonly number[]>
>();
const yearFilterOptionsCache = new WeakMap<
  ReadonlyMap<number, TestData>,
  {
    nosMap: ReadonlyMap<string, readonly number[]>;
    sortedLabels: string[];
  }
>();
const selectedYearNosCache = new WeakMap<
  ReadonlyMap<number, TestData>,
  WeakMap<readonly string[], ReadonlySet<number>>
>();
const filteredTestDataCache = new WeakMap<
  ReadonlyMap<number, TestData>,
  WeakMap<ReadonlySet<number>, ReadonlyMap<number, TestData>>
>();
const activeConditionIdsCache = new WeakMap<
  readonly { id: string }[],
  ReadonlySet<string>
>();
const candidateIndexCache = new WeakMap<
  ReadonlyMap<number, TestData>,
  WeakMap<
    ReadonlyMap<number, TestData>,
    WeakMap<
      ReadonlyMap<number, TestData>,
      WeakMap<CreatePdfCommonOptionDraftState, Map<string, CandidateIndex>>
    >
  >
>();
const testTableChecksCache = new WeakMap<
  readonly TestTableSection[],
  WeakMap<
    ReadonlyMap<number, TestData>,
    WeakMap<object, Map<string, CreatePdfTestTableCheckSnapshot>>
  >
>();

const getCachedNosMap = (
  testDataByNo: ReadonlyMap<number, TestData>,
): ReadonlyMap<string, readonly number[]> => {
  const cached = nosMapCache.get(testDataByNo);
  if (cached !== undefined) return cached;

  const created = buildNosMapFromTestData(testDataByNo);
  nosMapCache.set(testDataByNo, created);
  return created;
};

export const deriveYearFilterOptions = (
  testDataByNo: ReadonlyMap<number, TestData>,
): {
  nosMap: ReadonlyMap<string, readonly number[]>;
  sortedLabels: string[];
} => {
  const cached = yearFilterOptionsCache.get(testDataByNo);
  if (cached !== undefined) return cached;

  const nosMap = getCachedNosMap(testDataByNo);
  const created = {
    nosMap,
    sortedLabels: sortYearLabelsDesc([...nosMap.keys()]),
  };
  yearFilterOptionsCache.set(testDataByNo, created);
  return created;
};

export const deriveSelectedYearNos = (
  testDataByNo: ReadonlyMap<number, TestData>,
  selectedYears: readonly string[] | null,
): ReadonlySet<number> | null => {
  if (selectedYears === null) return null;

  let cacheBySelectedYears = selectedYearNosCache.get(testDataByNo);
  if (cacheBySelectedYears === undefined) {
    cacheBySelectedYears = new WeakMap();
    selectedYearNosCache.set(testDataByNo, cacheBySelectedYears);
  }

  const cached = cacheBySelectedYears.get(selectedYears);
  if (cached !== undefined) return cached;

  const nosMap = getCachedNosMap(testDataByNo);
  const created = new Set(
    selectedYears.flatMap((yearLabel) => [...(nosMap.get(yearLabel) ?? [])]),
  );
  cacheBySelectedYears.set(selectedYears, created);
  return created;
};

export const filterTestDataBySelectedYears = (
  source: ReadonlyMap<number, TestData>,
  selectedNos: ReadonlySet<number> | null,
): ReadonlyMap<number, TestData> => {
  if (selectedNos === null) return source;

  let cacheBySelectedNos = filteredTestDataCache.get(source);
  if (cacheBySelectedNos === undefined) {
    cacheBySelectedNos = new WeakMap();
    filteredTestDataCache.set(source, cacheBySelectedNos);
  }

  const cached = cacheBySelectedNos.get(selectedNos);
  if (cached !== undefined) return cached;

  const created = new Map([...source].filter(([no]) => selectedNos.has(no)));
  cacheBySelectedNos.set(selectedNos, created);
  return created;
};

export const deriveActiveConditionIds = (
  rows: ReadonlyArray<{ id: string }>,
): ReadonlySet<string> => {
  const cached = activeConditionIdsCache.get(rows);
  if (cached !== undefined) return cached;

  const created = new Set(rows.map((row) => row.id));
  activeConditionIdsCache.set(rows, created);
  return created;
};

export const deriveCreatePdfCandidateIndex = (params: {
  filteredTestDataByNo: ReadonlyMap<number, TestData>;
  allTestDataByNo: ReadonlyMap<number, TestData>;
  fixedTestDataByNo: ReadonlyMap<number, TestData>;
  workbookMode?: WorkbookMode;
  grade?: 1 | 2;
  options: CreatePdfCommonOptionDraftState;
}): CandidateIndex => {
  const {
    filteredTestDataByNo,
    allTestDataByNo,
    fixedTestDataByNo,
    workbookMode,
    grade,
    options,
  } = params;

  let cacheByAll = candidateIndexCache.get(filteredTestDataByNo);
  if (cacheByAll === undefined) {
    cacheByAll = new WeakMap();
    candidateIndexCache.set(filteredTestDataByNo, cacheByAll);
  }

  let cacheByFixed = cacheByAll.get(allTestDataByNo);
  if (cacheByFixed === undefined) {
    cacheByFixed = new WeakMap();
    cacheByAll.set(allTestDataByNo, cacheByFixed);
  }

  let cacheByOptions = cacheByFixed.get(fixedTestDataByNo);
  if (cacheByOptions === undefined) {
    cacheByOptions = new WeakMap();
    cacheByFixed.set(fixedTestDataByNo, cacheByOptions);
  }

  let cacheByMode = cacheByOptions.get(options);
  if (cacheByMode === undefined) {
    cacheByMode = new Map();
    cacheByOptions.set(options, cacheByMode);
  }

  const modeKey = `${workbookMode ?? ''}:${grade ?? ''}`;
  const cached = cacheByMode.get(modeKey);
  if (cached !== undefined) return cached;

  const created = buildCandidateIndex({
    testDataByNo: filteredTestDataByNo,
    allTestDataByNo,
    fixedTestDataByNo,
    workbookMode,
    grade,
    options,
  });
  cacheByMode.set(modeKey, created);
  return created;
};

export const deriveCreatePdfTestTableChecksCached = (params: {
  sections: readonly TestTableSection[];
  testDataByNo: ReadonlyMap<number, TestData>;
  showQaaChoiceIndex: boolean;
  grade?: 1 | 2;
  sectionMode: TestTableSectionMode;
  activeConditionIds?: ReadonlySet<string>;
}): CreatePdfTestTableCheckSnapshot => {
  const activeConditionIdsKey =
    params.activeConditionIds ?? NO_ACTIVE_CONDITION_IDS;

  let cacheByTestData = testTableChecksCache.get(params.sections);
  if (cacheByTestData === undefined) {
    cacheByTestData = new WeakMap();
    testTableChecksCache.set(params.sections, cacheByTestData);
  }

  let cacheByActiveConditionIds = cacheByTestData.get(params.testDataByNo);
  if (cacheByActiveConditionIds === undefined) {
    cacheByActiveConditionIds = new WeakMap();
    cacheByTestData.set(params.testDataByNo, cacheByActiveConditionIds);
  }

  let cacheByMode = cacheByActiveConditionIds.get(activeConditionIdsKey);
  if (cacheByMode === undefined) {
    cacheByMode = new Map();
    cacheByActiveConditionIds.set(activeConditionIdsKey, cacheByMode);
  }

  const modeKey = `${params.showQaaChoiceIndex ? 1 : 0}:${params.grade ?? 'any'}:${params.sectionMode}`;
  const cached = cacheByMode.get(modeKey);
  if (cached !== undefined) return cached;

  const created = deriveCreatePdfTestTableChecks(params);
  cacheByMode.set(modeKey, created);
  return created;
};
