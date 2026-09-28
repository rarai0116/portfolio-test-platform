import React from 'react';
import {act, fireEvent, render, waitFor} from '@testing-library/react-native';
import HomeResume from '../../components/views/questionHomeView/organisms/InterruptedDataModal';
import AnalysisResume from '../../components/views/dataAnalysisHomeView/organisms/InterruptedDataModal';
import TaskResume from '../../components/views/taskModeView/taskModeMain';
import CalendarResume from '../../components/views/calendarView/organisms/startCalendarTaskFooter';
import {GlobalUserSettingContext} from '../../components/hooks/useGlobalUserSettingContext';
import {GlobalSaveDataContext} from '../../components/hooks/useGlobalSaveDataContext';
import {QuestionAndChoicesViewContext} from '../../components/hooks/useQuestionsAndChoicesViewContext';
import {QuestionSettingViewContext} from '../../components/hooks/useQuestionSettingViewContext';
import {ModalManagerContext} from '../../components/hooks/useModalManagerContext';
import {TaskDataContext} from '../../components/hooks/useTaskDataContext';
import {TaskModeViewContext} from '../../components/views/taskModeView/hooks/useTaskModeViewContext';
import {CalendarTaskSettingViewModalContext} from '../../components/views/calendarView/hooks/useCalendarTaskSettingViewModalContext';
import {getTestData} from '../../components/functionals/firestoreController';
import type {BasicHalfModalProps} from '../../components/parts/basicHalfModal';
import {
  questionSettingModalStates,
  questionState,
} from '../../types/commonUnionType';
import {makeResumePlayData} from '../fixtures/resumeTestData';

jest.mock('../../components/parts/basicHalfModal', () => ({
  __esModule: true,
  default: (props: BasicHalfModalProps) => {
    const {Pressable} = require('react-native');
    return (
      <Pressable
        testID={`modal-${props.id}`}
        onPress={props.onPressOutPrimaryButton}
      />
    );
  },
}));
jest.mock('../../components/parts/displaySettingCardList', () => ({
  displaySettingCardList: () => null,
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({navigate: jest.fn()}),
}));
jest.mock('@react-navigation/material-top-tabs', () => ({
  createMaterialTopTabNavigator: () => ({
    Navigator: () => null,
    Screen: () => null,
  }),
}));
jest.mock(
  '../../components/views/taskModeView/organisms/taskPreviewModal',
  () => ({
    __esModule: true,
    default: (props: {onPressOut: () => void}) => {
      const {Pressable} = require('react-native');
      return <Pressable testID="task-resume" onPress={props.onPressOut} />;
    },
  }),
);
jest.mock(
  '../../components/views/taskModeView/organisms/taskSecondaryTodayTab',
  () => ({__esModule: true, default: () => null}),
);
jest.mock(
  '../../components/views/taskModeView/organisms/taskSecondaryUserTab',
  () => ({__esModule: true, default: () => null}),
);
jest.mock(
  '../../components/views/taskModeView/organisms/taskSecondaryTeacherTab',
  () => ({__esModule: true, default: () => null}),
);
jest.mock('../../components/organisms/completedTaskModal', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../components/organisms/unableToAnswerTaskModal', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../components/organisms/failedStartTestModal', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../components/hooks/useButtonContext', () => ({
  ButtonStates: {disabled: 'disabled', released: 'released'},
  ButtonContextProvider: (props: {onPressOut: () => void}) => {
    const {Pressable} = require('react-native');
    return <Pressable testID="calendar-resume" onPress={props.onPressOut} />;
  },
}));
jest.mock('../../components/parts/primaryShortButton', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('react-native-animatable', () => ({
  View: require('react-native').View,
}));
jest.mock('../../components/functionals/firestoreController', () => ({
  ...jest.requireActual('../../components/functionals/firestoreController'),
  getTestData: jest.fn(),
}));

const playData = makeResumePlayData();
const taskData = {
  ...playData.settingCardData,
  taskSetting: {
    testId: playData.testId,
    taskState: questionState.progress,
  },
};
const initializePlayData = jest.fn(async () => {});
const setIsUser = jest.fn();
const initializeReady = jest.fn();
const showModal = jest.fn();
const hideModal = jest.fn((callback?: () => void) => callback?.());
const setIsDisabledInput = jest.fn(
  async (_value: boolean, callback?: () => Promise<void>) => {
    await callback?.();
  },
);

const Harness = ({
  children,
  isLoading = false,
}: {
  readonly children: React.ReactNode;
  readonly isLoading?: boolean;
}) => (
  <GlobalUserSettingContext.Provider
    value={
      {
        setCurrentPlayData: jest.fn(),
        setIsDisabledInput,
        isLoading,
        readyForTest: {
          setIsUser,
          initialize: initializeReady,
        },
      } as unknown as React.ContextType<typeof GlobalUserSettingContext>
    }
  >
    <QuestionAndChoicesViewContext.Provider
      value={
        {initializePlayData} as unknown as React.ContextType<
          typeof QuestionAndChoicesViewContext
        >
      }
    >
      <QuestionSettingViewContext.Provider
        value={
          {
            startPracticeTest: jest.fn(),
            startExamTest: jest.fn(),
            onPressStartPracticeTest: jest.fn(),
            onPressStartExamTest: jest.fn(),
          } as unknown as React.ContextType<typeof QuestionSettingViewContext>
        }
      >
        <ModalManagerContext.Provider
          value={
            {
              activeModal: 'source',
              showModal,
              hideModal,
            } as unknown as React.ContextType<typeof ModalManagerContext>
          }
        >
          <GlobalSaveDataContext.Provider
            value={
              {
                answerlingTestSettingData: playData,
                setAnswerlingTestSettingData: jest.fn(),
                previousSavedSetting: playData.settingCardData,
              } as unknown as React.ContextType<typeof GlobalSaveDataContext>
            }
          >
            <TaskDataContext.Provider
              value={
                {
                  taskSettingList: {setting: taskData},
                } as unknown as React.ContextType<typeof TaskDataContext>
              }
            >
              <TaskModeViewContext.Provider
                value={
                  {selectedTaskData: taskData} as unknown as React.ContextType<
                    typeof TaskModeViewContext
                  >
                }
              >
                <CalendarTaskSettingViewModalContext.Provider
                  value={
                    {
                      currentTaskSettingCardId: 'setting',
                      taskSaveButtonState: 'released',
                    } as React.ContextType<
                      typeof CalendarTaskSettingViewModalContext
                    >
                  }
                >
                  {children}
                </CalendarTaskSettingViewModalContext.Provider>
              </TaskModeViewContext.Provider>
            </TaskDataContext.Provider>
          </GlobalSaveDataContext.Provider>
        </ModalManagerContext.Provider>
      </QuestionSettingViewContext.Provider>
    </QuestionAndChoicesViewContext.Provider>
  </GlobalUserSettingContext.Provider>
);

const entrypoints = [
  ['home', <HomeResume />, 'modal-InterruptedData', false],
  ['analysis', <AnalysisResume id="analysis-resume" />, 'modal-analysis-resume', false],
  ['task', <TaskResume />, 'task-resume', true],
  ['calendar', <CalendarResume />, 'calendar-resume', true],
] as const;

describe.each(entrypoints)('%sの再開入口', (_name, view, testId, remote) => {
  beforeEach(() => {
    jest.clearAllMocks();
    initializePlayData.mockResolvedValue(undefined);
    jest.mocked(getTestData).mockResolvedValue({
      status: 'success',
      testPlayDataLog: playData,
    } as never);
  });

  it('復元成功後にだけ開始する', async () => {
    const screen = render(<Harness>{view}</Harness>);
    await act(async () => {
      fireEvent.press(screen.getByTestId(testId));
    });

    await waitFor(() => expect(initializePlayData).toHaveBeenCalledWith(playData));
    expect(initializeReady).toHaveBeenCalledTimes(1);
    expect(initializeReady.mock.invocationCallOrder[0]).toBeLessThan(
      initializePlayData.mock.invocationCallOrder[0],
    );
    expect(setIsUser).toHaveBeenCalledWith(true);
    expect(showModal).not.toHaveBeenCalled();
    if (!remote || _name === 'task') {
      expect(hideModal).toHaveBeenCalled();
      expect(initializePlayData.mock.invocationCallOrder[0]).toBeLessThan(
        hideModal.mock.invocationCallOrder[0],
      );
    }
  });

  it('復元失敗時は開始せず既存モーダルを表示する', async () => {
    initializePlayData.mockRejectedValueOnce(new Error('restore failed'));
    const screen = render(<Harness>{view}</Harness>);
    await act(async () => {
      fireEvent.press(screen.getByTestId(testId));
    });

    await waitFor(() =>
      expect(showModal).toHaveBeenCalledWith(
        questionSettingModalStates.QuestionStartFailed,
      ),
    );
    expect(setIsUser).not.toHaveBeenCalled();
    expect(setIsDisabledInput).toHaveBeenLastCalledWith(false);
  });

  if (remote) {
    it('取得文書がない場合は復元せず既存モーダルを表示する', async () => {
      jest.mocked(getTestData).mockResolvedValueOnce({
        status: 'error',
        errorMessage: 'not found',
      });
      const screen = render(<Harness>{view}</Harness>);
      await act(async () => {
        fireEvent.press(screen.getByTestId(testId));
      });

      await waitFor(() =>
        expect(showModal).toHaveBeenCalledWith(
          questionSettingModalStates.QuestionStartFailed,
        ),
      );
      expect(initializePlayData).not.toHaveBeenCalled();
      expect(setIsUser).not.toHaveBeenCalled();
    });
  }
});

it('読込中は手動再開を成功にも失敗にも進めない', async () => {
  jest.clearAllMocks();
  const screen = render(
    <Harness isLoading>
      <HomeResume />
    </Harness>,
  );
  await act(async () => {
    fireEvent.press(screen.getByTestId('modal-InterruptedData'));
  });

  expect(initializePlayData).not.toHaveBeenCalled();
  expect(setIsUser).not.toHaveBeenCalled();
  expect(showModal).not.toHaveBeenCalled();
});
