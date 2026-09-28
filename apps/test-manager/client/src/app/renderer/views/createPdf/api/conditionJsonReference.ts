import type { TestData } from '@shared/types/contracts';
import type { SelectedReference } from '@shared/types/createPdfConditionJson';

const normalizeNullableString = (value: string | null | undefined) => {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const normalizeReferencePublicationNo = (
  value: string | null | undefined,
): string | null => {
  const normalized = normalizeNullableString(value);
  if (normalized === null) return null;

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? String(numeric) : normalized;
};

/**
 * TestData から SelectedReference を構築する。
 * selectedReference は JSON復元時の参照照合に使用する補助情報。
 */
export function buildSelectedReference(data: TestData): SelectedReference {
  return {
    nengo: data.nengo || null,
    year: data.year || null,
    subject: data.subject,
    no: String(data.no),
    isOriginal: Boolean(data.isOriginal),
    publicationYear: data.publicationYear ?? null,
    publicationNo: data.publicationNo ?? null,
  };
}

export function buildReferenceKeyFromSelectedReference(
  ref: SelectedReference,
): string {
  return JSON.stringify([
    normalizeNullableString(ref.nengo),
    normalizeNullableString(ref.year),
    normalizeNullableString(ref.subject),
    String(ref.no),
    Boolean(ref.isOriginal),
    normalizeNullableString(ref.publicationYear),
    normalizeReferencePublicationNo(ref.publicationNo),
  ]);
}

export function buildReferenceKeyFromTestData(data: TestData): string {
  return buildReferenceKeyFromSelectedReference({
    ...buildSelectedReference(data),
    no: data.testNo || String(data.no),
  });
}

export function buildLegacyReferenceKeyFromTestData(data: TestData): string {
  return buildReferenceKeyFromSelectedReference({
    ...buildSelectedReference(data),
    no: data.testNo,
  });
}

export function buildReferenceKeysFromTestData(
  data: TestData,
): readonly string[] {
  return [
    buildReferenceKeyFromTestData(data),
    buildReferenceKeyFromSelectedReference(buildSelectedReference(data)),
  ];
}

export function buildTestDataReferenceMap(
  testDataByNo: ReadonlyMap<number, TestData>,
): ReadonlyMap<string, TestData> {
  const map = new Map<string, TestData>();
  for (const data of testDataByNo.values()) {
    for (const key of buildReferenceKeysFromTestData(data)) {
      map.set(key, data);
    }
  }
  return map;
}

export function buildLegacyTestDataReferenceMap(
  testDataByNo: ReadonlyMap<number, TestData>,
): ReadonlyMap<string, TestData> {
  const map = new Map<string, TestData>();
  for (const data of testDataByNo.values()) {
    map.set(buildLegacyReferenceKeyFromTestData(data), data);
  }
  console.log('Built legacy reference map with keys:', map);
  return map;
}

export function referenceMatches(
  ref: SelectedReference | null,
  testData: TestData,
): boolean {
  if (ref === null) return false;
  const refKey = buildReferenceKeyFromSelectedReference(ref);
  return buildReferenceKeysFromTestData(testData).includes(refKey);
}
