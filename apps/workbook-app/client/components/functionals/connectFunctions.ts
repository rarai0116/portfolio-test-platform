import {httpsCallable} from '@react-native-firebase/functions';
import type {TestData} from '../hooks/useGlobalSaveDataContext';
import {functions} from './firebase';

export const callWriteContact = async (
  uid: string,
  context: string,
  meta?: string,
) => {
  try {
    meta ??= '';
    const result = await httpsCallable(
      functions,
      'write',
    )({
      uid,
      context,
      meta,
    }).catch((error: unknown) => {
      console.error('writeProblemReport送信失敗', error);
      throw new Error('お問い合わせの送信に失敗しました。');
    });

    return result;
  } catch (error: unknown) {
    console.error('callWriteContact：処理失敗', error);
    throw new Error('お問い合わせの送信に失敗しました。');
  }
};

export const callWriteProblemReport = async (
  uid: string,
  testData: TestData,
  problems: string[],
  other?: string,
  meta?: string,
) => {
  try {
    meta ??= '';
    const problemTypes = problems.reduce((acc, problem) => {
      return `${acc}${problem} `;
    }, '');
    const grade = testData.grade === 0 ? '1級' : '2級';
    const {subject} = testData;
    const year = `${testData.nengo}${testData.year}`;
    const no = testData.testNo;

    const result = await httpsCallable(
      functions,
      'writeProblemReport',
    )({
      uid,
      grade,
      subject,
      year,
      no,
      problemTypes,
      other,
      meta,
    }).catch((error: unknown) => {
      console.error('writeProblemReport送信失敗', error);
      throw new Error('問題不備報告の送信に失敗しました。');
    });

    return result;
  } catch (error: unknown) {
    console.error('callWriteProblemReport：処理失敗', error);
    throw new Error('問題不備報告の送信に失敗しました');
  }
};
