import React, {useContext} from 'react';
import {act, render, waitFor} from '@testing-library/react-native';
import {getAuth} from '@react-native-firebase/auth';
import {
  QuestionAndChoicesViewContext,
  QuestionAndChoicesViewContextProvider,
} from '../../components/hooks/useQuestionsAndChoicesViewContext';
import {
  GlobalSaveDataContext,
  type TestData,
  type TestPlayData,
} from '../../components/hooks/useGlobalSaveDataContext';
import {GlobalUserSettingContext} from '../../components/hooks/useGlobalUserSettingContext';
import {QuestionSettingViewContext} from '../../components/hooks/useQuestionSettingViewContext';
import {StorageContext} from '../../components/hooks/useAsyncStorageContext';
import {
  updateTestData,
  type DailyLog,
} from '../../components/functionals/firestoreController';
import {createEmptyDailyLog} from '../../components/functionals/pendingDailyLog';
import {questionMode} from '../../types/commonUnionType';
import type {QuestionGradeType} from '../../types/commonUnionType';
import {
  makeResumePlayData,
  makeResumeQuestions,
} from '../fixtures/resumeTestData';

jest.mock('../../components/hooks/useInterval', () => ({
  __esModule: true,
  default: () => ['Stopped', {startTime: jest.fn(), stopTime: jest.fn()}],
}));
jest.mock('../../components/functionals/firestoreController', () => ({
  ...jest.requireActual('../../components/functionals/firestoreController'),
  updateTestData: jest.fn(async () => ({status: 'success'})),
}));

type PlayContext = React.ContextType<typeof QuestionAndChoicesViewContext>;

let playContext!: PlayContext;
const readContext = () => {
  playContext = useContext(QuestionAndChoicesViewContext);
  return null;
};
const ContextReader = readContext;

const questions = makeResumeQuestions();
const getTestDataList = jest.fn((_isQaa: boolean) => questions);
const setCurrentPlayData = jest.fn();
const setIsApp = jest.fn();
const initializeReady = jest.fn();
const saveInterruptedData = jest.fn(async (_data: TestPlayData | null) => {});
const setIsDisabledInput = jest.fn(
  async (_value: boolean, callback?: () => Promise<void>) => {
    await callback?.();
  },
);
const startAt = makeResumePlayData().startAt;
const currentDailyLog: DailyLog = {
  ...createEmptyDailyLog('test-uid'),
  answerList: [30],
  playRecord: {record: {startAt, endAt: null}},
};

const Harness = ({
  currentPlayData = null,
  isLoading = false,
  grade = '1級',
  isUser = false,
  isApp = false,
}: {
  readonly currentPlayData?: TestPlayData | null;
  readonly isLoading?: boolean;
  readonly grade?: QuestionGradeType;
  readonly isUser?: boolean;
  readonly isApp?: boolean;
}) => (
  <GlobalSaveDataContext.Provider
    value={
      {
        getTestDataList,
        setAnswerlingTestSettingData: saveInterruptedData,
        adjustTestData: async (data: TestData) => data,
        setPreviousSavedSetting: jest.fn(),
        updateAllDataLengthMap: jest.fn(),
      } as unknown as React.ContextType<typeof GlobalSaveDataContext>
    }
  >
    <GlobalUserSettingContext.Provider
      value={
        {
          currentPlayData,
          setCurrentPlayData,
          grade,
          currentDailyLog,
          setCurrentDailyLog: jest.fn(),
          currentRecordKey: 'record',
          setCurrentRecordKey: jest.fn(),
          isLoading,
          testIdList: {
            weakPoint: {total: []},
            correctlyAnswered: {total: []},
          },
          readyForTest: {
            isUser,
            isApp,
            setIsApp,
            setIsUser: jest.fn(),
            initialize: initializeReady,
          },
          setIsDisabledInput,
          getPendingBase: jest.fn(() => ({})),
        } as unknown as React.ContextType<typeof GlobalUserSettingContext>
      }
    >
      <QuestionSettingViewContext.Provider
        value={
          {questionModeType: questionMode.practice} as React.ContextType<
            typeof QuestionSettingViewContext
          >
        }
      >
        <StorageContext.Provider
          value={
            {
              savePendingDailyLog: jest.fn(async () => {}),
              loadPendingDailyLog: jest.fn(async () => null),
              deletePendingDailyLog: jest.fn(async () => {}),
            } as unknown as React.ContextType<typeof StorageContext>
          }
        >
          <QuestionAndChoicesViewContextProvider>
            <ContextReader />
          </QuestionAndChoicesViewContextProvider>
        </StorageContext.Provider>
      </QuestionSettingViewContext.Provider>
    </GlobalUserSettingContext.Provider>
  </GlobalSaveDataContext.Provider>
);

describe('中断テストの正答復元', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getTestDataList.mockReturnValue(questions);
    jest
      .mocked(getAuth)
      .mockReturnValue({currentUser: {uid: 'test-uid'}} as never);
  });

  it.each([
    ['未変換', [2, 4, 3, 4]],
    ['1回変換済み', [3, 4, 2, 4]],
    ['複数回変換済み', [1, 4, 4, 4]],
    ['空配列', []],
  ])('%sの保存値を教材の正答から同じ状態へ復元する', async (_name, saved) => {
    render(<Harness />);

    await act(async () => {
      await playContext.initializePlayData(
        makeResumePlayData({answerList: saved}),
      );
    });

    expect(playContext.answerList).toEqual([3, 4, 2, 4]);
    expect(playContext.correctAnswerCount).toBe(2);
    expect(setCurrentPlayData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        answerList: [2, 4, 3, 4],
        correctAnswerCount: 2,
      }),
    );
    expect(setIsApp).toHaveBeenCalledWith(true);
  });

  it('seedがない場合は前のセッションのseedを使わずseed=0で復元する', async () => {
    render(<Harness currentPlayData={makeResumePlayData()} />);

    await act(async () => {
      await playContext.initializePlayData(
        makeResumePlayData({baseSeed: undefined}),
      );
    });

    expect(playContext.answerList).toEqual([2, 4, 3, 4]);
    expect(playContext.correctAnswerCount).toBe(2);
  });

  it('同じテストは重複初期化せずProvider再マウント後は再初期化する', async () => {
    const currentPlayData = makeResumePlayData();
    const screen = render(
      <Harness currentPlayData={currentPlayData} isUser={true} />,
    );

    await waitFor(() => {
      expect(playContext.testDataNoList).toEqual(currentPlayData.testDataNoList);
      expect(setCurrentPlayData).toHaveBeenCalledTimes(1);
    });

    screen.rerender(
      <Harness currentPlayData={currentPlayData} isUser={true} isApp={true} />,
    );
    await waitFor(() => expect(setCurrentPlayData).toHaveBeenCalledTimes(1));

    screen.unmount();
    render(
      <Harness currentPlayData={currentPlayData} isUser={true} isApp={true} />,
    );

    await waitFor(() => {
      expect(playContext.testDataNoList).toEqual(currentPlayData.testDataNoList);
      expect(playContext.currentTestDatalist).toEqual(
        currentPlayData.testDataNoList.map((testDataNo) => questions[testDataNo]),
      );
      expect(setCurrentPlayData).toHaveBeenCalledTimes(2);
    });
  });

  it('QAAセッションでは既存のQAA教材を参照する', async () => {
    render(<Harness />);
    const playData = makeResumePlayData({
      baseSeed: 0,
      settingCardData: {
        ...makeResumePlayData().settingCardData,
        isQaa: true,
      },
    });

    await act(async () => {
      await playContext.initializePlayData(playData);
    });

    expect(getTestDataList).toHaveBeenCalledWith(true);
    expect(playContext.answerList).toEqual([2, 4, 3, 4]);
  });

  it('2級セッションでも同じ教材復元経路を使う', async () => {
    render(<Harness grade="2級" />);
    const playData = makeResumePlayData({
      baseSeed: 0,
      settingCardData: {
        ...makeResumePlayData().settingCardData,
        grade: '2級',
      },
    });

    await act(async () => {
      await playContext.initializePlayData(playData);
    });

    expect(playContext.answerList).toEqual([2, 4, 3, 4]);
    expect(setCurrentPlayData).toHaveBeenCalledWith(
      expect.objectContaining({answerList: [2, 4, 3, 4]}),
    );
  });

  it('保存された級と読込教材の級が異なる場合は復元しない', async () => {
    render(<Harness />);
    const playData = makeResumePlayData({
      settingCardData: {
        ...makeResumePlayData().settingCardData,
        grade: '2級',
      },
    });

    await act(async () => {
      await expect(playContext.initializePlayData(playData)).rejects.toThrow(
        '保存されたテストと現在の級が一致しません',
      );
    });

    expect(setCurrentPlayData).not.toHaveBeenCalled();
  });

  it('参照する問題が存在しない場合はstateを確定せず失敗する', async () => {
    getTestDataList.mockReturnValue(questions.slice(0, 31));
    render(<Harness />);

    await act(async () => {
      await expect(
        playContext.initializePlayData(makeResumePlayData()),
      ).rejects.toThrow('問題番号31を参照できない');
    });

    expect(playContext.answerList).toEqual([]);
    expect(setCurrentPlayData).not.toHaveBeenCalled();
    expect(setIsApp).not.toHaveBeenCalled();
  });

  it('教材の正答が選択肢に存在しない場合は位置0として続行しない', async () => {
    const invalidQuestions = makeResumeQuestions();
    invalidQuestions[31] = {...invalidQuestions[31], answer: '9'};
    getTestDataList.mockReturnValue(invalidQuestions);
    render(<Harness />);

    await act(async () => {
      await expect(
        playContext.initializePlayData(makeResumePlayData()),
      ).rejects.toThrow('問題番号31の正答位置を復元できません');
    });

    expect(playContext.answerList).toEqual([]);
    expect(setCurrentPlayData).not.toHaveBeenCalled();
  });

  it('未完了データの現在問題だけを復元可能条件として確認する', async () => {
    render(<Harness />);

    await act(async () => {
      await expect(
        playContext.initializePlayData(
          makeResumePlayData({currentPlayNo: 4, isFinished: false}),
        ),
      ).rejects.toThrow('再開する問題を参照できません');
    });
    await act(async () => {
      await expect(
        playContext.initializePlayData(
          makeResumePlayData({currentPlayNo: 4, isFinished: true}),
        ),
      ).resolves.toBeUndefined();
    });
  });

  it('復元後のFirestore保存と中断保存に生の正答を使う', async () => {
    const restored = makeResumePlayData({
      answerList: [2, 4, 3, 4],
      correctAnswerCount: 2,
    });
    const screen = render(<Harness currentPlayData={restored} />);
    await act(async () => {
      await playContext.initializePlayData(restored);
    });
    const normalized = setCurrentPlayData.mock.calls.at(-1)?.[0];
    screen.rerender(<Harness currentPlayData={normalized} />);

    await act(async () => {
      playContext.setIsFinished(true);
    });
    await act(async () => {
      await playContext.testFinishedProcess();
    });

    await waitFor(() => {
      expect(jest.mocked(updateTestData)).toHaveBeenCalledWith(
        expect.objectContaining({
          answerList: [2, 4, 3, 4],
          correctAnswerCount: 2,
          baseSeed: 56_453,
        }),
        restored.testId,
      );
      expect(saveInterruptedData).toHaveBeenCalledWith(
        expect.objectContaining({
          answerList: [2, 4, 3, 4],
          correctAnswerCount: 2,
        }),
      );
    });
  });
});
