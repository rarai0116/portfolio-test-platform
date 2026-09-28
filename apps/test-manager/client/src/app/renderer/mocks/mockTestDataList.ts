import type { TestData, Version } from '@shared/types/contracts';
import {
  answerFormatDisplay,
  autoCheckDisplay,
  booleanMarkDisplay,
  type FilterOptions,
  manualCheckDisplay,
  originalDisplay,
  type Row,
} from '@views/testDataList/types/reactGridDataTypes';

export const mockTestDocs: {
  path: string;
  data?: TestData | undefined;
  updateTime: Version;
}[] = [
  {
    path: 'firstGrade/0',
    data: {
      active: true,
      answer: '2',
      answerNumber: '2',
      answerText: '',
      answerText1: '',
      answerText2: '',
      answerText3: '',
      answerText4: '',
      answerText5: '',
      bigCategoryTag: '建築計画',
      ch1: '',
      ch2: '',
      ch3: '  ',
      ch4: '',
      ch5: '',
      difficult: '1',
      grade: 0,
      isShuffleable: true,
      isConvertibleQaa: true,
      isNegativeAnswer: true,
      nengo: '令和',
      no: 0,
      parentAnswerHonbun: '',
      parentHonbun: '',
      parentNo: 1,
      parentbNo: '2020_学科Ⅰ_001',
      publicationNo: '10',
      publicationYear: '2021',
      smallCategoryTag: '建築士の職責、建築設計の手法等',
      status: '準備完了',
      subject: '学科Ⅰ',
      testNo: '1',
      text: '',
      themeTag: '建築士の職責、業務等',
      otherTags: ['法規', '計画'],
      year: '1',
      id: undefined,
      isOriginal: true,
      autoCheck: true,
      calibrationCheck: true,
    },
    updateTime: { seconds: 1769126400, nanos: 0 },
  },
  {
    path: 'firstGrade/1',
    data: {
      active: true,
      answer: '1',
      answerNumber: '1',
      answerText: '',
      answerText1: '',
      answerText2: '',
      answerText3: '',
      answerText4: '',
      answerText5: '',
      bigCategoryTag: '建築設備',
      ch1: '',
      ch2: '',
      ch3: '  ',
      ch4: '',
      ch5: '',
      difficult: '1',
      grade: 0,
      isShuffleable: false,
      isConvertibleQaa: true,
      isNegativeAnswer: false,
      nengo: '令和',
      no: 1,
      parentAnswerHonbun: '',
      parentHonbun: '',
      parentNo: 1,
      parentbNo: '2020_学科Ⅱ_1',
      publicationNo: '2',
      publicationYear: '2023',
      smallCategoryTag: '省エネルギー・保全・管理',
      status: '準備完了',
      subject: '学科Ⅱ',
      testNo: '1',
      text: '',
      themeTag: '発電設備',
      otherTags: ['設備'],
      year: '2',
      id: undefined,
      isOriginal: true,
      autoCheck: true,
      calibrationCheck: true,
    },
    updateTime: { seconds: 1769126400, nanos: 0 },
  },
  {
    path: 'firstGrade/2',
    data: {
      active: true,
      answer: '2',
      answerNumber: '2',
      answerText: '',
      answerText1: '',
      answerText2: '',
      answerText3: '',
      answerText4: '',
      answerText5: '',
      bigCategoryTag: '建築基準法',
      ch1: '',
      ch2: '',
      ch3: '  ',
      ch4: '',
      ch5: '',
      difficult: '1',
      grade: 0,
      isConvertibleQaa: true,
      isNegativeAnswer: true,
      nengo: '令和',
      no: 2,
      parentAnswerHonbun: '',
      parentHonbun: '',
      parentNo: 1,
      parentbNo: '2020_学科Ⅲ_001',
      publicationNo: '1',
      publicationYear: '2022',
      smallCategoryTag: '用語の定義',
      status: '準備完了',
      subject: '学科Ⅲ',
      testNo: '1',
      text: '',
      themeTag: '用語',
      otherTags: [],
      year: '3',
      id: undefined,
      isOriginal: true,
      autoCheck: true,
      calibrationCheck: true,
    },
    updateTime: { seconds: 1769126400, nanos: 0 },
  },
];

export const generateMockRow = (
  docs: {
    path: string;
    data?: TestData | undefined;
    updateTime: Version;
  }[],
): Row[] => {
  return docs
    .map((doc) => {
      const data = doc.data;
      if (!data) return undefined;
      return {
        id: doc.path,
        no: data.no,
        year: `${data.nengo}${data.year}`,
        publicationYear: data.publicationYear ?? '',
        publicationNo: data.publicationNo ?? '',
        subject: data.subject,
        bigCategory: data.bigCategoryTag,
        smallCategory: data.smallCategoryTag,
        theme: data.themeTag,
        otherTags: data.otherTags ?? [],
        testNo: data.testNo,
        status: data.status,
        original: data.isOriginal
          ? originalDisplay.true
          : originalDisplay.false,
        autoCheck: data.autoCheck
          ? autoCheckDisplay.true
          : autoCheckDisplay.false,
        shuffleable: data.isShuffleable
          ? booleanMarkDisplay.true
          : booleanMarkDisplay.false,
        convertibleQaa: data.isConvertibleQaa
          ? booleanMarkDisplay.true
          : booleanMarkDisplay.false,
        answerFormat: data.isNegativeAnswer
          ? answerFormatDisplay.incorrect
          : answerFormatDisplay.correct,
        manualCheck: data.calibrationCheck
          ? manualCheckDisplay.lock
          : manualCheckDisplay.unlock,
        lastUpdated: data.updatedAt
          ? new Date(data.updatedAt.seconds * 1000).toLocaleString()
          : 'ー',
      };
    })
    .filter((row): row is Row => row !== undefined);
};

export const mockCheckedFilters: FilterOptions = {
  year: ['令和3', '令和2', '令和1'],
  publicationYear: ['2021', '2022', '2023'],
  subject: ['学科Ⅰ', '学科Ⅱ', '学科Ⅲ'],
  bigCategory: ['建築基準法', '建築計画', '建築設備'],
  smallCategory: [
    '建築士の職責、建築設計の手法等',
    '省エネルギー・保全・管理',
    '用語の定義',
  ],
  otherTags: ['計画', '設備', '法規'],
  original: [originalDisplay.true],
  autoCheck: [autoCheckDisplay.true],
  shuffleable: [booleanMarkDisplay.false, booleanMarkDisplay.true],
  convertibleQaa: [booleanMarkDisplay.true],
  answerFormat: [answerFormatDisplay.incorrect, answerFormatDisplay.correct],
  manualCheck: [manualCheckDisplay.lock],
  status: ['準備完了'],
};
