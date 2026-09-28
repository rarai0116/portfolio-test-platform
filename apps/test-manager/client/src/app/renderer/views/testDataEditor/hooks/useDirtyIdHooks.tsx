import { META_KEYS, type TestData } from '@shared/types/contracts';
import {
  applyCommonRulesToTestData,
  HTML_FIELDS,
  normalizeEditorTypesInTestData,
} from '@views/testDataEditor/api/testDataUtils';
import type {
  EditDataEntry,
  TestDataEntry,
} from '@views/testDataEditor/store/useTestDataStore';
import { useCallback, useMemo, useRef, useState } from 'react';

type UseDirtyIdHooksArgs = {
  selectedDataId?: string;
  selectedDataIdList: string[];
  selectedGrade?: string;
  editMap: Record<string, EditDataEntry>;
  testDataMap: Record<string, TestDataEntry>;
};

type EvaluateDirtyReason = {
  html: Array<keyof TestData>;
  meta: Array<keyof TestData>;
  editorType: Array<'questionEditorType' | 'answerEditorType'>;
  calibrationCheck: {
    editValue: boolean;
    baseValue: boolean;
  } | null;
  status: {
    editValue: string;
    baseValue: string;
  } | null;
};

type EvaluateDirtyResult = {
  id: string;
  isDirty: boolean;
  reasons: EvaluateDirtyReason | null;
};

type UseDirtyIdHooksResult = {
  dirtyIdSet: Set<string>;
  evaluateDirty: (ids: string[]) => EvaluateDirtyResult[];
  evaluateDirtyNext: (
    next: TestData,
    targetId?: string,
  ) => EvaluateDirtyResult | null;
  initializeDirtyState: (ids?: string[]) => void;
  refreshNormalizedBaseFromRaw: (ids?: string[]) => void;
  markIdsClean: (ids: string[]) => void;
  clearDirtyIds: (ids?: string[]) => void;
  isDirty: (id?: string | null) => boolean;
};

const uniqueIds = (ids: string[]): string[] => {
  return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
};

const normalizeMetaValue = (
  key: keyof TestData,
  value: unknown,
): string | number => {
  switch (key) {
    case 'grade':
      return typeof value === 'number' ? value : Number(value ?? -1);
    case 'testNo': {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) && numericValue > 0
        ? String(numericValue)
        : '-1';
    }
    default:
      return String(value ?? '');
  }
};

const buildNormalizedBase = (id: string, source: TestData): TestData => {
  const [normalized] = normalizeEditorTypesInTestData({ ...source });
  return applyCommonRulesToTestData(normalized, {
    boundary: 'load',
    itemId: id,
  });
};

const getComparedKeys = (selectedGrade?: string): Array<keyof TestData> => {
  return selectedGrade === 'secondGrade'
    ? HTML_FIELDS
    : HTML_FIELDS.filter((key) => key !== 'ch5' && key !== 'answerText5');
};

export const useDirtyIdHooks = ({
  selectedDataId,
  selectedDataIdList,
  selectedGrade,
  editMap,
  testDataMap,
}: UseDirtyIdHooksArgs): UseDirtyIdHooksResult => {
  const [dirtyIdSet, setDirtyIdSet] = useState<Set<string>>(() => new Set());
  const dirtyIdSetRef = useRef<Set<string>>(new Set());
  const normalizedBaseRef = useRef<Record<string, TestData>>({});

  const comparedKeys = useMemo(() => {
    return getComparedKeys(selectedGrade);
  }, [selectedGrade]);

  const commitDirtyIdSet = useCallback((nextDirtyIdSet: Set<string>) => {
    dirtyIdSetRef.current = nextDirtyIdSet;
    setDirtyIdSet(nextDirtyIdSet);
  }, []);

  const resolveTargetIds = useCallback(
    (ids?: string[]) => {
      const sourceIds = ids && ids.length > 0 ? ids : selectedDataIdList;
      return uniqueIds(sourceIds);
    },
    [selectedDataIdList],
  );

  const buildDirtyReasons = useCallback(
    (
      _id: string,
      editData: TestData,
      baseData: TestData,
    ): EvaluateDirtyReason => {
      const diffKeys = comparedKeys.filter((key) => {
        const editValue =
          typeof editData[key] === 'string' ? editData[key] : '';
        const baseValue =
          typeof baseData[key] === 'string' ? baseData[key] : '';
        return editValue !== baseValue;
      });

      const diffMetaKeys = META_KEYS.filter((key) => {
        const editValue = normalizeMetaValue(key, editData[key]);
        const baseValue = normalizeMetaValue(key, baseData[key]);
        return editValue !== baseValue;
      });

      const diffEditorTypeKeys = (
        ['questionEditorType', 'answerEditorType'] as const
      ).filter((key) => {
        return String(editData[key] ?? '') !== String(baseData[key] ?? '');
      });

      const calibrationEditValue = Boolean(editData.calibrationCheck);
      const calibrationBaseValue = Boolean(baseData.calibrationCheck);
      const hasCalibrationDiff = calibrationEditValue !== calibrationBaseValue;

      const statusEditValue = String(editData.status ?? '');
      const statusBaseValue = String(baseData.status ?? '');
      const hasStatusDiff =
        statusEditValue === '停止中'
          ? statusBaseValue !== '停止中'
          : statusBaseValue === '停止中';

      return {
        html: diffKeys,
        meta: diffMetaKeys,
        editorType: diffEditorTypeKeys,
        calibrationCheck: hasCalibrationDiff
          ? {
              editValue: calibrationEditValue,
              baseValue: calibrationBaseValue,
            }
          : null,
        status: hasStatusDiff
          ? {
              editValue: statusEditValue,
              baseValue: statusBaseValue,
            }
          : null,
      };
    },
    [comparedKeys],
  );

  const refreshNormalizedBaseFromRaw = useCallback(
    (ids?: string[]) => {
      const targetIds = resolveTargetIds(ids);
      if (targetIds.length === 0) {
        normalizedBaseRef.current = {};
        return;
      }

      const nextBaseMap = { ...normalizedBaseRef.current };
      for (const id of targetIds) {
        const raw = testDataMap[id]?.raw;
        if (!raw) {
          delete nextBaseMap[id];
          continue;
        }

        nextBaseMap[id] = buildNormalizedBase(id, raw);
      }

      normalizedBaseRef.current = nextBaseMap;
    },
    [resolveTargetIds, testDataMap],
  );

  const clearDirtyIds = useCallback(
    (ids?: string[]) => {
      const targetIds = resolveTargetIds(ids);
      if (targetIds.length === 0) {
        commitDirtyIdSet(new Set());
        return;
      }

      const nextDirtyIdSet = new Set(dirtyIdSetRef.current);
      for (const id of targetIds) {
        nextDirtyIdSet.delete(id);
      }

      commitDirtyIdSet(nextDirtyIdSet);
    },
    [commitDirtyIdSet, resolveTargetIds],
  );

  const initializeDirtyState = useCallback(
    (ids?: string[]) => {
      const targetIds = resolveTargetIds(ids);
      refreshNormalizedBaseFromRaw(targetIds);
      clearDirtyIds(targetIds);
    },
    [clearDirtyIds, refreshNormalizedBaseFromRaw, resolveTargetIds],
  );

  const markIdsClean = useCallback(
    (ids: string[]) => {
      const targetIds = resolveTargetIds(ids);
      if (targetIds.length === 0) {
        return;
      }

      const nextBaseMap = { ...normalizedBaseRef.current };
      for (const id of targetIds) {
        const editData = editMap[id]?.data;
        if (!editData) {
          continue;
        }

        nextBaseMap[id] = { ...editData };
      }

      normalizedBaseRef.current = nextBaseMap;
      clearDirtyIds(targetIds);
    },
    [clearDirtyIds, editMap, resolveTargetIds],
  );

  const evaluateDirty = useCallback(
    (ids: string[]) => {
      const targetIds = resolveTargetIds(ids);
      if (targetIds.length === 0) {
        return [];
      }

      const nextDirtyIdSet = new Set(dirtyIdSetRef.current);
      const results: EvaluateDirtyResult[] = [];

      for (const id of targetIds) {
        const editData = editMap[id]?.data;
        const baseData = normalizedBaseRef.current[id];

        if (!editData || !baseData) {
          nextDirtyIdSet.delete(id);
          results.push({ id, isDirty: false, reasons: null });
          continue;
        }

        const reasons = buildDirtyReasons(id, editData, baseData);
        const isDirty =
          reasons.html.length > 0 ||
          reasons.meta.length > 0 ||
          reasons.editorType.length > 0 ||
          reasons.calibrationCheck !== null ||
          reasons.status !== null;

        if (isDirty) {
          nextDirtyIdSet.add(id);
        } else {
          nextDirtyIdSet.delete(id);
        }

        results.push({
          id,
          isDirty,
          reasons: isDirty ? reasons : null,
        });
      }

      commitDirtyIdSet(nextDirtyIdSet);
      return results;
    },
    [buildDirtyReasons, commitDirtyIdSet, editMap, resolveTargetIds],
  );

  const evaluateDirtyNext = useCallback(
    (next: TestData, targetId?: string): EvaluateDirtyResult | null => {
      const id = String(targetId ?? selectedDataId ?? '');
      if (!id) {
        return null;
      }

      const baseData = normalizedBaseRef.current[id];
      if (!baseData) {
        const nextDirtyIdSet = new Set(dirtyIdSetRef.current);
        nextDirtyIdSet.delete(id);
        commitDirtyIdSet(nextDirtyIdSet);
        return {
          id,
          isDirty: false,
          reasons: null,
        };
      }

      const reasons = buildDirtyReasons(id, next, baseData);
      const isDirty =
        reasons.html.length > 0 ||
        reasons.meta.length > 0 ||
        reasons.editorType.length > 0 ||
        reasons.calibrationCheck !== null ||
        reasons.status !== null;

      const nextDirtyIdSet = new Set(dirtyIdSetRef.current);
      if (isDirty) {
        nextDirtyIdSet.add(id);
      } else {
        nextDirtyIdSet.delete(id);
      }

      commitDirtyIdSet(nextDirtyIdSet);

      return {
        id,
        isDirty,
        reasons: isDirty ? reasons : null,
      };
    },
    [buildDirtyReasons, commitDirtyIdSet, selectedDataId],
  );

  const isDirty = useCallback((id?: string | null) => {
    if (!id) {
      return false;
    }

    return dirtyIdSetRef.current.has(id);
  }, []);

  return {
    dirtyIdSet,
    evaluateDirty,
    evaluateDirtyNext,
    initializeDirtyState,
    refreshNormalizedBaseFromRaw,
    markIdsClean,
    clearDirtyIds,
    isDirty,
  };
};

export default useDirtyIdHooks;
