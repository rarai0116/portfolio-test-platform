import React, {useContext} from 'react';
import {act, render} from '@testing-library/react-native';
import GlobalSaveDataContextProvider, {
  GlobalSaveDataContext,
  type TestData,
} from '../../components/hooks/useGlobalSaveDataContext';
import {StorageContext} from '../../components/hooks/useAsyncStorageContext';
import {AuthContext} from '../../components/hooks/useAuthContext';
import {
  GlobalUserSettingContext,
  type TestIdList,
} from '../../components/hooks/useGlobalUserSettingContext';
import {makeResumePlayData} from '../fixtures/resumeTestData';

jest.mock('../../components/functionals/adjusttestData', () => ({
  __esModule: true,
  default: jest.fn(async (data: TestData) => data),
  getBaseDirectory: jest.fn(async () => 'test-directory'),
}));
jest.mock('../../components/functionals/firestoreController', () => ({
  ...jest.requireActual('../../components/functionals/firestoreController'),
  updateCurrentTests: jest.fn(async () => ({status: 'success'})),
}));

type GlobalSaveDataContextValue = React.ContextType<
  typeof GlobalSaveDataContext
>;

const emptyIdBlock = () => ({
  current: [],
  old: [],
  total: [],
  set: jest.fn(),
});

const makeTestIdList = (parameters?: {
  answered?: string[];
  weakPoint?: string[];
}): TestIdList => ({
  answered: {
    ...emptyIdBlock(),
    total: parameters?.answered ?? [],
  },
  weakPoint: {
    ...emptyIdBlock(),
    total: parameters?.weakPoint ?? [],
  },
  correctlyAnswered: emptyIdBlock(),
  unCorrectlyAnswered: {
    current: [],
    old: [],
    total: [],
  },
  generate: jest.fn(),
});

const testData: TestData = {
  active: true,
  answer: '1',
  answerNumber: '1',
  answerText: 'answer',
  answerText1: 'answer 1',
  answerText2: 'answer 2',
  answerText3: 'answer 3',
  answerText4: 'answer 4',
  answerText5: 'answer 5',
  bigCategoryTag: 'big',
  ch1: 'choice 1',
  ch2: 'choice 2',
  ch3: 'choice 3',
  ch4: 'choice 4',
  ch5: 'choice 5',
  difficult: '2',
  grade: 1,
  isConvertibleQaa: true,
  isNegativeAnswer: false,
  nengo: 'R',
  no: 0,
  parentAnswerHonbun: '',
  parentHonbun: '',
  parentNo: 0,
  parentbNo: '',
  smallCategoryTag: 'small',
  status: '',
  subject: 'subject',
  testNo: '1',
  text: 'question',
  themeTag: '',
  year: '2026',
};

const regularId = 'ch_1_subject_R_2026_1';
const firstQaaId = 'qaa1_1_subject_R_2026_1_1';
const secondQaaId = 'qaa2_1_subject_R_2026_1_2';
const categoryKey = 'subject-big-small';

const ContextReader = ({
  capture,
}: {
  readonly capture: (value: GlobalSaveDataContextValue) => void;
}) => {
  capture(useContext(GlobalSaveDataContext));
  return null;
};

const TestProviders = ({
  testIdList,
  capture,
}: {
  readonly testIdList: TestIdList;
  readonly capture: (value: GlobalSaveDataContextValue) => void;
}) => (
  <StorageContext.Provider
    value={{} as React.ContextType<typeof StorageContext>}
  >
    <AuthContext.Provider
      value={
        {
          isAuthenticated: false,
          loginUser: null,
        } as React.ContextType<typeof AuthContext>
      }
    >
      <GlobalUserSettingContext.Provider
        value={
          {
            grade: undefined,
            isReloadRequired: false,
            setCurrentRecordKey: jest.fn(),
            setIsReloadRequired: jest.fn(),
            testIdList,
          } as unknown as React.ContextType<typeof GlobalUserSettingContext>
        }
      >
        <GlobalSaveDataContextProvider>
          <ContextReader capture={capture} />
        </GlobalSaveDataContextProvider>
      </GlobalUserSettingContext.Provider>
    </AuthContext.Provider>
  </StorageContext.Provider>
);

describe('GlobalSaveDataContextProvider category data length maps', () => {
  let contextValue!: GlobalSaveDataContextValue;
  let logSpy: jest.SpyInstance;

  const capture = (value: GlobalSaveDataContextValue) => {
    contextValue = value;
  };

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('updates the regular and QAA maps after testDataList changes', async () => {
    render(<TestProviders testIdList={makeTestIdList()} capture={capture} />);

    expect(contextValue.categoryDataLengthMap).toEqual({});
    expect(contextValue.qaaCategoryDataLengthMap).toEqual({});

    await act(async () => {
      await contextValue.setTestDataList([testData]);
    });

    expect(
      contextValue.categoryDataLengthMap[categoryKey].totalList,
    ).toEqual({
      _total: [0],
      _1: [],
      _2: [0],
      _3: [],
    });
    expect(
      contextValue.qaaCategoryDataLengthMap[categoryKey].totalList,
    ).toEqual({
      _total: [0, 1, 2, 3, 4],
      _1: [],
      _2: [0, 1, 2, 3, 4],
      _3: [],
    });
  });

  it('recalculates both maps after testIdList changes', async () => {
    const rendered = render(
      <TestProviders testIdList={makeTestIdList()} capture={capture} />,
    );

    await act(async () => {
      await contextValue.setTestDataList([testData]);
    });

    const previousQaa = contextValue.getTestDataList(true);
    const previousRegularMap = contextValue.categoryDataLengthMap;
    const previousQaaMap = contextValue.qaaCategoryDataLengthMap;

    expect(
      contextValue.categoryDataLengthMap[categoryKey].answeredList._total,
    ).toEqual([]);
    expect(
      contextValue.qaaCategoryDataLengthMap[categoryKey].weakList._total,
    ).toEqual([]);

    rendered.rerender(
      <TestProviders
        testIdList={
          makeTestIdList({
            answered: [regularId, firstQaaId],
            weakPoint: [secondQaaId],
          })
        }
        capture={capture}
      />,
    );

    expect(contextValue.getTestDataList(true)).toBe(previousQaa);
    expect(previousRegularMap[categoryKey].answeredList._total).toEqual([]);
    expect(previousQaaMap[categoryKey].weakList._total).toEqual([]);

    expect(
      contextValue.categoryDataLengthMap[categoryKey].answeredList._total,
    ).toEqual([0]);
    expect(
      contextValue.qaaCategoryDataLengthMap[categoryKey].answeredList._total,
    ).toEqual([0]);
    expect(
      contextValue.qaaCategoryDataLengthMap[categoryKey].weakList._total,
    ).toEqual([1]);
  });

  it('preserves question order, category separation and input data across replacements', async () => {
    render(<TestProviders testIdList={makeTestIdList()} capture={capture} />);
    const first = Object.freeze({...testData});
    const second = Object.freeze({
      ...testData,
      no: 1,
      testNo: '2',
      smallCategoryTag: 'other',
      difficult: '1',
      isNegativeAnswer: true,
      answer: '3',
    });
    const input = [first, second];

    await act(async () => {
      await contextValue.setTestDataList(input);
    });

    const previousQaa = contextValue.getTestDataList(true);
    const previousMap = contextValue.categoryDataLengthMap;
    expect(previousQaa.map((data) => data.no)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(previousQaa.map((data) => data.text)).toEqual([
      'choice 1', 'choice 2', 'choice 3', 'choice 4', 'choice 5',
      'choice 1', 'choice 2', 'choice 3', 'choice 4', 'choice 5',
    ]);
    expect(previousQaa.map((data) => data.answer)).toEqual([
      '1', '2', '2', '2', '2', '1', '1', '2', '1', '1',
    ]);
    expect(contextValue.qaaCategoryDataLengthMap[categoryKey].totalList._total).toEqual([0, 1, 2, 3, 4]);
    expect(contextValue.qaaCategoryDataLengthMap['subject-big-other'].totalList._total).toEqual([5, 6, 7, 8, 9]);
    expect(previousMap['subject-big'].totalList._total).toEqual([0, 1]);
    expect(input).toEqual([testData, {...second}]);

    await act(async () => {
      await contextValue.setTestDataList([{...testData, text: 'replacement'}]);
    });

    expect(contextValue.getTestDataList(true)).not.toBe(previousQaa);
    expect(previousQaa).toHaveLength(10);
    expect(previousMap['subject-big'].totalList._total).toEqual([0, 1]);
    expect(contextValue.categoryDataLengthMap['subject-big'].totalList._total).toEqual([0]);
  });

  it('generates four choices for grade 0 and excludes nonconvertible questions', async () => {
    render(<TestProviders testIdList={makeTestIdList()} capture={capture} />);
    await act(async () => {
      await contextValue.setTestDataList([
        {...testData, grade: 0},
        {...testData, grade: 0, no: 1, isConvertibleQaa: false},
      ]);
    });
    expect(contextValue.getTestDataList(true).map((data) => data.parentChoice)).toEqual([1, 2, 3, 4]);
    expect(contextValue.categoryDataLengthMap[categoryKey].totalList._total).toEqual([0, 1]);
    expect(contextValue.qaaCategoryDataLengthMap[categoryKey].totalList._total).toEqual([0, 1, 2, 3]);
  });

  it('生の正答と選択位置を比較し直さず、算出済み正解数を保持する', async () => {
    render(<TestProviders testIdList={makeTestIdList()} capture={capture} />);
    const playData = makeResumePlayData({
      answerList: [2, 4, 3, 4],
      selectedAnswerList: [2, 2, 2, 4],
      correctAnswerCount: 2,
    });

    await act(async () => {
      await contextValue.setAnswerlingTestSettingData(playData);
    });

    expect(contextValue.answerlingTestSettingData).toMatchObject({
      answerList: [2, 4, 3, 4],
      selectedAnswerList: [2, 2, 2, 4],
      correctAnswerCount: 2,
    });
  });
});
