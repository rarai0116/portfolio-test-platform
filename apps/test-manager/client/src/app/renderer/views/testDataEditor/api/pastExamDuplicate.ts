import type { TestData } from '@shared/types/contracts';

export const PAST_EXAM_DUPLICATE_FAILED_KEY = 'pastExamDuplicate';

export const PAST_EXAM_DUPLICATE_TARGET_KEYS = new Set<keyof TestData>([
  'grade',
  'nengo',
  'year',
  'subject',
  'testNo',
  'isOriginal',
]);

type PastExamDuplicateFields = Pick<
  TestData,
  'grade' | 'nengo' | 'year' | 'subject' | 'testNo' | 'isOriginal'
>;

export type PastExamDuplicateEntry = {
  id: string;
  data: PastExamDuplicateFields;
};

export type PastExamDuplicateIndex = {
  keyById: Record<string, string | null>;
  idsByKey: Record<string, string[]>;
};

export function createEmptyPastExamDuplicateIndex(): PastExamDuplicateIndex {
  return {
    keyById: {},
    idsByKey: {},
  };
}

function normalizeGrade(grade: unknown): string | null {
  const normalized = typeof grade === 'number' ? grade : Number(grade);
  if (!Number.isFinite(normalized)) return null;
  return String(normalized);
}

function normalizeRequiredText(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeTestNo(value: unknown): string | null {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0
    ? String(normalized)
    : null;
}

export function getPastExamDuplicateKey(
  data: PastExamDuplicateFields,
): string | null {
  if (data.isOriginal === true) return null;

  const grade = normalizeGrade(data.grade);
  const nengo = normalizeRequiredText(data.nengo);
  const year = normalizeRequiredText(data.year);
  const subject = normalizeRequiredText(data.subject);
  const testNo = normalizeTestNo(data.testNo);

  if (!grade || !nengo || !year || !subject || !testNo) {
    return null;
  }

  return [grade, nengo, year, subject, testNo].join('|');
}

export function clonePastExamDuplicateIndex(
  index: PastExamDuplicateIndex,
): PastExamDuplicateIndex {
  return {
    keyById: { ...index.keyById },
    idsByKey: Object.fromEntries(
      Object.entries(index.idsByKey).map(([key, ids]) => [key, [...ids]]),
    ),
  };
}

function removeIdFromKey(
  index: PastExamDuplicateIndex,
  key: string | null | undefined,
  id: string,
): void {
  if (!key) return;

  const currentIds = index.idsByKey[key];
  if (!currentIds) return;

  const nextIds = currentIds.filter((currentId) => currentId !== id);
  if (nextIds.length === 0) {
    delete index.idsByKey[key];
    return;
  }

  index.idsByKey[key] = nextIds;
}

export function upsertPastExamDuplicateIndexEntry(
  index: PastExamDuplicateIndex,
  entry: PastExamDuplicateEntry,
): PastExamDuplicateIndex {
  const nextIndex = clonePastExamDuplicateIndex(index);
  const previousKey = nextIndex.keyById[entry.id] ?? null;
  const nextKey = getPastExamDuplicateKey(entry.data);

  removeIdFromKey(nextIndex, previousKey, entry.id);

  if (nextKey) {
    const currentIds = nextIndex.idsByKey[nextKey] ?? [];
    const mergedIds = currentIds.includes(entry.id)
      ? currentIds
      : [...currentIds, entry.id];

    nextIndex.idsByKey[nextKey] = mergedIds.sort((left, right) => {
      const leftNum = Number(left);
      const rightNum = Number(right);
      if (Number.isFinite(leftNum) && Number.isFinite(rightNum)) {
        return leftNum - rightNum;
      }
      return left.localeCompare(right, 'ja');
    });
    nextIndex.keyById[entry.id] = nextKey;
  } else {
    nextIndex.keyById[entry.id] = null;
  }

  return nextIndex;
}

export function buildPastExamDuplicateIndex(
  entries: PastExamDuplicateEntry[],
): PastExamDuplicateIndex {
  return entries.reduce<PastExamDuplicateIndex>(
    (index, entry) => upsertPastExamDuplicateIndexEntry(index, entry),
    createEmptyPastExamDuplicateIndex(),
  );
}

export function getPastExamDuplicateIds(
  index: PastExamDuplicateIndex,
  entry: PastExamDuplicateEntry,
): string[] {
  const key = getPastExamDuplicateKey(entry.data);
  if (!key) return [];

  const ids = index.idsByKey[key] ?? [];
  return ids.filter((id) => id !== entry.id);
}
