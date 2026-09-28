import {summarizeConsoleValue} from '../../functionals/consoleLevels';
import {useIsFocused} from '@react-navigation/native';
import {useHeaderHeight} from '@react-navigation/elements';
import {useBottomTabBarHeight} from '@react-navigation/bottom-tabs';
import {useCallback, useContext, useEffect, useMemo} from 'react';
import {Platform, useWindowDimensions, View} from 'react-native';
import Constants from 'expo-constants';
import {isEqual} from 'lodash';
import {useNavigation} from '@react-navigation/native';
import {
  type QuestionViewsProps,
  allScreenIdList,
} from '../../../types/viewParameter';
import ModalManagerContextProvider, {
  ModalManagerContext,
} from '../../hooks/useModalManagerContext';
import {
  InquiryFormContext,
  InquiryFormContextProvider,
} from '../../hooks/useInquiryFormContextProvider';
import {QuestionSettingViewContext} from '../../hooks/useQuestionSettingViewContext';
import {GlobalUserSettingContext} from '../../hooks/useGlobalUserSettingContext';
import {GlobalSaveDataContext} from '../../hooks/useGlobalSaveDataContext';
import {
  inquiryFormModalStates,
  questionHomeViewModalStates,
  questionSettingModalStates,
  questionSettingState,
} from '../../../types/commonUnionType';
import {TextInputContextProvider} from '../../hooks/useTextInputContextProvider';
import QuestionSettingViewModal from '../../viewmodals/questionSettingViewModal';
import InquiryFormAskSubmitModal from '../../organisms/inquiryFormAskSubmitModal';
import InquiryFormViewModal from '../../viewmodals/inquiryFormViewModal';
import InquiryFormSubmitCompletedModal from '../../organisms/inquiryFormSubmitCompletedModal';
import InquiryFormSubmitFailedModal from '../../organisms/inquiryFormSubmitFailedModal';
import tw from '../../../tailwind.custom';
import Spacer from '../../parts/spacer';
import QuestionCardButtons from '../../organisms/questionCardButtons';
import {
  ButtonContextProvider,
  ButtonStates,
} from '../../hooks/useButtonContext';
import PrimaryLongButton from '../../parts/primaryLongButton';
import Background from '../../parts/background';
import TodayTaskModal from './organisms/todayTaskModal';
import {
  pressMode,
  QuestionHomeViewContext,
  QuestionHomeViewContextProvider,
} from './hooks/useQuestionHomeViewContext';
import InterruptedDataModal from './organisms/InterruptedDataModal';
import {
  dateFormat,
  getTodayTimestamp,
  getYmdString,
} from '@/components/functionals/timeManager';
import AppText from '@/components/identities/appText';
import FailedStartTestModals from '@/components/organisms/failedStartTestModal';
import {MainPageContext} from '@/components/hooks/mainPageContext';
import {useBackgroundPreloader} from '@/components/hooks/useBackgroundPreloader';

export type QuestionHomeViewProps = QuestionViewsProps<'Home'>;

/** Defined Types And States */

const InnerView = (_props: QuestionHomeViewProps) => {
  const navigation = useNavigation<QuestionViewsProps<'Home'>['navigation']>();
  const isFocused = useIsFocused();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const screenHeight = useWindowDimensions().height;
  const {addPreloadTask} = useBackgroundPreloader();

  const height = useMemo(() => {
    const adjustedHeight = screenHeight - headerHeight - tabBarHeight;
    return Platform.OS === 'ios'
      ? adjustedHeight - Constants.statusBarHeight
      : adjustedHeight;
  }, [headerHeight, tabBarHeight, screenHeight]);

  /** Load Context */
  const {showModal, activeModal} = useContext(ModalManagerContext);
  const {setIsInitialOpen} = useContext(InquiryFormContext);
  const {setCurrentSettingId, initializeQuestionInfo} = useContext(
    QuestionSettingViewContext,
  );
  const {navigateToQuestionAndChoiceView} = useContext(MainPageContext);
  const {
    setCurrentPlayData,
    readyForTest,
    setIsDisabledInput,
    currentPlayData,
    showedTodayTaskModalDate,
    setShowedTodayTaskModalDate,
  } = useContext(GlobalUserSettingContext);
  const {
    previousSavedSetting,
    answerlingTestSettingData,
    setAnswerlingTestSettingData,
  } = useContext(GlobalSaveDataContext);
  const {todayTaskSettinIdList, setOnPressOutMode} = useContext(
    QuestionHomeViewContext,
  );

  // 中断データの有無
  //  const [hasInterruptedData, setHasInterruptedData] = useState<boolean>(false);
  const hasInterruptedData = useMemo(() => {
    return (
      answerlingTestSettingData !== null &&
      answerlingTestSettingData.settingCardData.settingState !==
        questionSettingState.task
    );
  }, [answerlingTestSettingData]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (!isFocused) return;

    if (
      answerlingTestSettingData !== null &&
      answerlingTestSettingData.settingCardData.settingState !==
        questionSettingState.task
    ) {
      // 終了済の場合は中断データを削除
      if (answerlingTestSettingData.isFinished) {
        setAnswerlingTestSettingData(null).catch((error: unknown) => {
          console.error('中断データ削除失敗', error);
        });
        return;
      }

      console.log(
        '中断データ準備完了',
        summarizeConsoleValue(answerlingTestSettingData),
      );
      const testPlayData = {
        ...answerlingTestSettingData,
        currentPlayNo: answerlingTestSettingData.currentPlayNo,
      };
      if (!isEqual(currentPlayData, testPlayData))
        setCurrentPlayData(testPlayData);
    }
  }, [isFocused, answerlingTestSettingData]);

  // 今日の課題モーダル表示
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (!isFocused) return;
    const now = getTodayTimestamp();
    const ymd = getYmdString(now, dateFormat.none);
    if (ymd !== showedTodayTaskModalDate && todayTaskSettinIdList.length > 0) {
      showModal(questionHomeViewModalStates.TodayTask);
      setShowedTodayTaskModalDate(ymd);
    }
  }, [isFocused, showedTodayTaskModalDate, todayTaskSettinIdList]);

  // テスト開始チェック
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (!isFocused) return;
    console.log('テスト開始チェック', readyForTest);
    if (!readyForTest.isComplete) return;
    //    navigation.getParent()?.setOptions({tabBarStyle: {display: 'none'}});
    navigateToQuestionAndChoiceView();

    setIsDisabledInput(false).catch((error: unknown) => {
      console.error('テスト開始失敗', error);
    });
  }, [readyForTest.isComplete]);

  const preloadViews = useCallback(async () => {
    addPreloadTask({
      id: 'preload-screen-savedSetting',
      priority: 'high',
      async execute() {
        return new Promise<void>((resolve) => {
          navigation.preload('SavedSetting', {
            userId: allScreenIdList.SavedSetting,
          });
          resolve();
        });
      },
    });
    addPreloadTask({
      id: 'preload-screen-taskMode',
      priority: 'low',
      async execute() {
        return new Promise<void>((resolve) => {
          navigation.preload('TaskMode', {
            userId: allScreenIdList.TaskMode,
          });
          resolve();
        });
      },
    });
    /*
    if (!navigation.getParent()) return;
    addPreloadTask({
      id: 'preload-screen-calenderTab',
      priority: 'medium',
      async execute() {
        return new Promise<void>((resolve) => {
          navigation.getParent()?.preload('CalenderTab', {
            userId: allScreenIdList.CalenderTab,
            screen: 'CalendarHome',
            params: {
              userId: allScreenIdList.CalendarHome,
            },
          });
          resolve();
        });
      },
    });
    addPreloadTask({
      id: 'preload-screen-dataAnalysisTab',
      priority: 'low',
      async execute() {
        return new Promise<void>((resolve) => {
          navigation.getParent()?.preload('DataAnalysisTab', {
            userId: allScreenIdList.DataAnalysisTab,
            screen: 'DataAnalysisHome',
            params: {
              userId: allScreenIdList.DataAnalysisHome,
            },
          });
          resolve();
        });
      },
    });
    */
  }, [navigation, addPreloadTask]);

  // 初回ロード時プリロード
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    setIsDisabledInput(false).catch((error: unknown) => {
      console.error('初期設定失敗', error);
    });
    setTimeout(() => {
      preloadViews().catch((error: unknown) => {
        console.error('プリロード失敗', error);
      });
    }, 0);
  }, []);

  return (
    <Background>
      <InterruptedDataModal />
      <TodayTaskModal />
      <FailedStartTestModals
        noQuestionSettingConditionModalProps={{
          onPressOutOkButton() {},
        }}
        notEnoughQuestionSettingConditionModalProps={{
          onPressOutOkButton() {},
          onPressOutCancelButton() {},
        }}
        questionStartFailedModalProps={{
          onPressOutCloseButton() {},
        }}
      />
      <TextInputContextProvider>
        <QuestionSettingViewModal id={questionSettingModalStates.viewModal} />
      </TextInputContextProvider>

      <TextInputContextProvider>
        <InquiryFormAskSubmitModal />
        <InquiryFormViewModal />
        <InquiryFormSubmitCompletedModal />
        <InquiryFormSubmitFailedModal />
      </TextInputContextProvider>

      <View style={tw`h-[${height}px] items-center justify-center`}>
        {hasInterruptedData ? (
          <View style={tw`w-10/12 items-end`}>
            <View
              style={tw`h-5 w-30 bg-[#F8F899] items-center justify-center rounded-full`}
            >
              <AppText style={tw`text-xxs text-primary`}>
                中断データがあります
              </AppText>
            </View>
          </View>
        ) : (
          <View style={tw`h-5`} />
        )}
        <Spacer isHorizontal={false} size={12} />
        <QuestionCardButtons
          onPressOutPractice={() => {
            if (activeModal !== null) return;
            setOnPressOutMode(pressMode.practice);
            if (hasInterruptedData) {
              showModal(questionHomeViewModalStates.InterruptedData);
            } else {
              // initializeQuestionInfo();
              setCurrentSettingId('initialSetting-practice-0');
              showModal(questionSettingModalStates.viewModal);
            }
          }}
          onPressOutTask={() => {
            if (!isFocused) return;
            if (activeModal !== null) return;
            navigation.navigate('TaskMode', {
              userId: allScreenIdList.TaskMode,
            });
          }}
          onPressOutExam={() => {
            if (activeModal !== null) return;
            setOnPressOutMode(pressMode.exam);
            if (hasInterruptedData) {
              showModal(questionHomeViewModalStates.InterruptedData);
            } else {
              setCurrentSettingId('initialSetting-exam-0');
              showModal(questionSettingModalStates.viewModal);
            }
          }}
          onPressOutSavedSetting={() => {
            if (activeModal !== null) return;
            setOnPressOutMode(pressMode.saved);
            if (hasInterruptedData) {
              showModal(questionHomeViewModalStates.InterruptedData);
            } else {
              navigation.navigate('SavedSetting', {
                userId: allScreenIdList.SavedSetting,
              });
            }
          }}
          onPressOutPreviousSavedSetting={() => {
            if (activeModal !== null || !previousSavedSetting) return;
            setOnPressOutMode(pressMode.previous);
            initializeQuestionInfo();

            setCurrentSettingId(previousSavedSetting.id);
            if (hasInterruptedData) {
              showModal(questionHomeViewModalStates.InterruptedData);
            } else {
              showModal(questionSettingModalStates.viewModal);
            }
          }}
        />
        <Spacer isHorizontal={false} size={40} />
        <ButtonContextProvider
          state={ButtonStates.released}
          onPressOut={() => {
            if (activeModal !== null) return;
            setIsInitialOpen(true);
            showModal(inquiryFormModalStates.inquiryFormViewModal);
          }}
        >
          <PrimaryLongButton text="ご意見・ご要望" />
        </ButtonContextProvider>
      </View>
    </Background>
  );
};

const QuestionHomeView = (props: QuestionHomeViewProps) => {
  return (
    <QuestionHomeViewContextProvider>
      <ModalManagerContextProvider>
        <InquiryFormContextProvider>
          <InnerView {...props} />
        </InquiryFormContextProvider>
      </ModalManagerContextProvider>
    </QuestionHomeViewContextProvider>
  );
};

export default QuestionHomeView;
