import {summarizeConsoleValue} from './consoleLevels';
import type {TestData} from '../hooks/useGlobalSaveDataContext';

export const generateTestDataId = (data: TestData, isQaa: boolean) => {
  try {
    const prefix = isQaa ? `qaa${data.parentChoice!}` : 'ch';
    return `${prefix}_${data.grade}_${data.subject ?? data.subject}_${data.nengo}_${
      data.year
    }_${data.testNo}${
      data.parentChoice === undefined ? '' : `_${data.parentChoice}`
    }`;
  } catch (error) {
    console.info(
      'generateTestDataId：処理情報',
      summarizeConsoleValue(data),
      summarizeConsoleValue(isQaa),
    );
    console.error('generateTestDataId：処理失敗', error);
    throw new Error('generateTestDataId error');
  }
};
