import type { TestData } from '@shared/types/contracts';

export type TestDataDisplayNameSource = Pick<
  TestData,
  'isOriginal' | 'subject' | 'no' | 'testNo'
> &
  Partial<Pick<TestData, 'nengo' | 'year'>>;

export const buildTestDataDisplayName = (
  data: TestDataDisplayNameSource,
): string => {
  if (data.isOriginal) {
    return `${data.subject} No.${data.no}`;
  }

  const year = `${data.nengo ?? ''}${data.year ?? ''}` || '不明年度';
  return `${year}_${data.subject}_No${data.testNo || '不明'}`;
};
