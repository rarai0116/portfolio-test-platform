import type { TestData } from '@shared/types/contracts';
import { parseUsedIdKey } from '@views/testDataEditor/api/testDataUtils';
import {
  type ImageItem,
  kOf,
} from '@views/testDataEditor/hooks/useImageAssetList';
import type { EditDataEntry } from '@views/testDataEditor/store/useTestDataStore';
import { useEffect, useMemo, useRef, useState } from 'react';

const MAX_LABEL_CACHE_SIZE = 300;

type UsedIdLabelResolverArgs = {
  imageItems: ImageItem[];
  imageItemKeys: string[];
  editMap: Record<string, EditDataEntry>;
};

const getGradeLabel = (gradeNo: '0' | '1') => {
  return gradeNo === '0' ? '1級' : '2級';
};

const getGradeCollectionPath = (gradeNo: '0' | '1') => {
  return gradeNo === '0' ? 'firstGrade' : 'secondGrade';
};

const buildFallbackLabel = (usedId: string) => {
  const parsed = parseUsedIdKey(usedId);
  if (!parsed) return usedId;
  return `[${getGradeLabel(parsed.gradeNo)}] ${parsed.docId}`;
};

const buildLabelFromTestData = (
  gradeNo: '0' | '1',
  data: Pick<TestData, 'subject' | 'nengo' | 'year' | 'no'>,
) => {
  return `[${getGradeLabel(gradeNo)}] ${data.subject ?? ''} ${data.nengo ?? ''}${data.year ?? ''}年 問題No.${data.no ?? ''}`;
};

const getStringField = (value: unknown) => {
  return typeof value === 'string' ? value : '';
};

const getNumberField = (value: unknown) => {
  return typeof value === 'number' ? value : '';
};

const extractLabelData = (usedId: string, value?: TestData) => {
  const parsed = parseUsedIdKey(usedId);
  if (!parsed) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  return buildLabelFromTestData(parsed.gradeNo, {
    subject: getStringField(value.subject),
    nengo: getStringField(value.nengo),
    year: getStringField(value.year),
    no: getNumberField(value.no),
  } as Pick<TestData, 'subject' | 'nengo' | 'year' | 'no'>);
};

const appendLabelCache = (
  prev: Map<string, string>,
  usedId: string,
  label: string,
) => {
  const next = new Map(prev);
  if (next.has(usedId)) {
    next.delete(usedId);
  }
  next.set(usedId, label);

  while (next.size > MAX_LABEL_CACHE_SIZE) {
    const oldestKey = next.keys().next().value;
    if (!oldestKey) break;
    next.delete(oldestKey);
  }

  return next;
};

const appendLabelCacheEntries = (
  prev: Map<string, string>,
  entries: Iterable<[string, string]>,
) => {
  let next = prev;

  for (const [usedId, label] of entries) {
    next = appendLabelCache(next, usedId, label);
  }

  return next;
};

const useUsedIdLabelResolver = ({
  imageItems,
  imageItemKeys,
  editMap,
}: UsedIdLabelResolverArgs) => {
  const [labelCache, setLabelCache] = useState<Map<string, string>>(
    () => new Map(),
  );
  const inflightRef = useRef(new Set<string>());
  const failedRef = useRef(new Set<string>());

  const imageItemsByKey = useMemo(() => {
    return new Map(imageItems.map((item) => [kOf(item), item]));
  }, [imageItems]);

  const visibleUsedIds = useMemo(() => {
    if (imageItemKeys.length === 0) return [];

    const visibleItems = imageItemKeys
      .map((key) => imageItemsByKey.get(key))
      .filter((item): item is ImageItem => !!item);

    return Array.from(
      new Set(visibleItems.flatMap((item) => item.usedIds ?? [])),
    );
  }, [imageItemKeys, imageItemsByKey]);

  useEffect(() => {
    const missingUsedIds = visibleUsedIds.filter((usedId) => {
      const parsed = parseUsedIdKey(usedId);
      if (!parsed) return false;
      if (editMap[parsed.docId]?.data) return false;
      if (labelCache.has(usedId)) return false;
      if (inflightRef.current.has(usedId)) return false;
      if (failedRef.current.has(usedId)) return false;
      return true;
    });

    if (missingUsedIds.length === 0) return;

    for (const usedId of missingUsedIds) {
      inflightRef.current.add(usedId);
    }

    let cancelled = false;

    const loadLabels = async () => {
      const targets = missingUsedIds
        .map((usedId) => {
          const parsed = parseUsedIdKey(usedId);
          if (!parsed) return null;

          return {
            usedId,
            path: `${getGradeCollectionPath(parsed.gradeNo)}/${parsed.docId}`,
          };
        })
        .filter(
          (
            target,
          ): target is {
            usedId: string;
            path: string;
          } => target !== null,
        );

      const pathToUsedIds = new Map<string, string[]>();
      for (const target of targets) {
        const existing = pathToUsedIds.get(target.path);
        if (existing) {
          existing.push(target.usedId);
        } else {
          pathToUsedIds.set(target.path, [target.usedId]);
        }
      }

      try {
        const res = await window.fs.batchGetDocs({
          paths: [...pathToUsedIds.keys()],
        });
        if (cancelled) return;

        const resolvedLabels = new Map<string, string>();
        for (const [path, usedIds] of pathToUsedIds) {
          const doc = res.docs[path] ?? null;

          for (const usedId of usedIds) {
            const label = extractLabelData(
              usedId,
              doc?.data as TestData | undefined,
            );
            if (label) {
              resolvedLabels.set(usedId, label);
            } else {
              failedRef.current.add(usedId);
            }

            inflightRef.current.delete(usedId);
          }
        }

        if (resolvedLabels.size > 0) {
          setLabelCache((prev) =>
            appendLabelCacheEntries(prev, resolvedLabels),
          );
        }
      } catch (e) {
        for (const usedId of missingUsedIds) {
          inflightRef.current.delete(usedId);
          failedRef.current.add(usedId);
        }
        console.error('usedId label batch fetch failed', e);
      }
    };

    void loadLabels();

    return () => {
      cancelled = true;
    };
  }, [editMap, labelCache, visibleUsedIds]);

  const formatUsedIdLabel = useMemo(() => {
    return (usedId: string): string => {
      const parsed = parseUsedIdKey(usedId);
      if (!parsed) {
        console.warn('Failed to parse usedId:', usedId);
        return usedId;
      }

      const editData = editMap[parsed.docId]?.data;
      if (editData) {
        return buildLabelFromTestData(parsed.gradeNo, editData);
      }

      return labelCache.get(usedId) ?? buildFallbackLabel(usedId);
    };
  }, [editMap, labelCache]);

  return {
    formatUsedIdLabel,
  };
};

export default useUsedIdLabelResolver;
