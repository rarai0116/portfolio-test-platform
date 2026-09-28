import {
  View,
  useWindowDimensions,
  // Animated,
  type ViewToken,
  Keyboard,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import {
  useState,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import {useNavigation} from '@react-navigation/native';
import tw from '../../tailwind.custom';
import BackButton from '../parts/backButton';
import type {RootViewsProps} from '../../types/viewParameter';
import Background from '../parts/background';
import ProgressTracker from '../parts/progressTracker';
import {QuestionSettingViewContext} from '../hooks/useQuestionSettingViewContext';
import {questionSettingState} from '../../types/commonUnionType';
import Spacer from '../parts/spacer';
import {ButtonContextProvider, ButtonStates} from '../hooks/useButtonContext';
import PrimaryShortButton from '../parts/primaryShortButton';
import NextButton from '../parts/nextButton';
import {InitialSettingDataContext} from '../hooks/useInitialSettingDataContext';
import PracticeQuestionSettingModalItem from '../organisms/practiceQuestionSettingModalItem';
import {CalendarTaskSettingViewModalContext} from '../views/calendarView/hooks/useCalendarTaskSettingViewModalContext';

export type PracticeQuestionSettingViewModalProps = Record<string, never>;

const PracticeQuestionSettingViewModal = (
  _props: PracticeQuestionSettingViewModalProps,
) => {
  const navigation =
    useNavigation<RootViewsProps<'ModalStack'>['navigation']>();
  const {
    questionModeType,
    currentIndex,
    scrollFoward,
    scrollBackward,
    practiceSlides,
    settingState,
    setCurrentIndex,
    slidesRef,
    questionDifficultiesInfo,
    questionNumberOfQuestionsInfo,
    questionTimeInfo,
    onPressStartPracticeTest,
    checkedCategoryButtonIdList,
    currentSelectedPracticeSettingIdList,
  } = useContext(QuestionSettingViewContext);
  const {initialPracticeQuestionSetting} = useContext(
    InitialSettingDataContext,
  );
  const {saveTaskQuestionSetting} = useContext(
    CalendarTaskSettingViewModalContext,
  );

  const {width} = useWindowDimensions();

  const [progressTrackerKey, setProgressTrackerKey] = useState<string>('pt');

  // const scrollX = useRef(new Animated.Value(0)).current;
  const initialScrollIndex = useMemo(() => {
    return settingState === questionSettingState.initial
      ? 0
      : practiceSlides.length - 1;
  }, [settingState, practiceSlides]);

  const scrollX = useSharedValue(initialScrollIndex * width);

  const viewableItemsChanged = useRef(
    ({viewableItems}: {viewableItems: ViewToken[]}) => {
      setCurrentIndex(viewableItems[0].index);
    },
  ).current;

  const viewConfig = useRef({viewAreaCoveragePercentThreshold: 50}).current;

  // コンポーネントの初期化
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    setProgressTrackerKey(`pt${String(Date.now())}`);
  }, [currentIndex]);

  // 初期化
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (settingState === questionSettingState.initial) {
      setCurrentIndex(0);
    } else {
      setCurrentIndex(practiceSlides.length - 1);
    }
  }, [settingState, questionModeType]);

  /*
  useEffect(() => {
    console.log('currentIndex,scrollX', currentIndex, scrollX);
  }, [currentIndex, scrollX]);
  */

  /* 「次へ」ボタンの状態**/
  const practiceNextButtonState = useMemo(() => {
    /* if(settingState=== questionSettingState) */
    const _checkedCategoryIdList = checkedCategoryButtonIdList;
    if (
      (currentIndex === 0 &&
        questionDifficultiesInfo.checkedList.length === 0) ||
      currentIndex === 1 ||
      (currentIndex === 2 && _checkedCategoryIdList.length === 0) ||
      (currentIndex === 3 && // 問題数未入力、または制限時間入力を選択かつ未入力の場合
        (questionNumberOfQuestionsInfo.selectedValue === '' ||
          questionNumberOfQuestionsInfo.selectedValue === '0' ||
          (initialPracticeQuestionSetting.questionTime[1].id.includes(
            questionTimeInfo.checkedIdList[0],
          ) &&
            questionTimeInfo.selectedValue === '')))
    ) {
      return ButtonStates.disabled;
    }

    return ButtonStates.released;
  }, [
    currentIndex,
    checkedCategoryButtonIdList,
    questionDifficultiesInfo.checkedList,
    questionNumberOfQuestionsInfo.selectedValue,
    questionTimeInfo,
    initialPracticeQuestionSetting,
  ]);

  const onPressOutSaveTaskButton = useCallback(() => {
    saveTaskQuestionSetting(
      questionModeType,
      currentSelectedPracticeSettingIdList,
    );
    /* navigation.navigate('ModalStack', {
      userId: allScreenIdList.ModalStack,
      screen: 'CalendarTaskSetting',
      params: {
        userId: allScreenIdList.CalendarTaskSetting,
        isReloadCurrentSettingId: true,
      },
    }); */
    navigation.popToTop();
  }, [
    saveTaskQuestionSetting,
    questionModeType,
    currentSelectedPracticeSettingIdList,
    navigation,
  ]);

  const displayPracticeFooter = useMemo(() => {
    switch (currentIndex) {
      case 0: {
        return (
          <>
            <BackButton
              onPressOut={() => {
                navigation.goBack();
              }}
            />
            <NextButton
              buttonState={practiceNextButtonState}
              onPressOut={() => {
                scrollFoward(practiceSlides);
              }}
            />
          </>
        );
      }

      case 1: {
        return (
          <>
            <BackButton onPressOut={scrollBackward} />
            <View style={tw`h-5`} />
          </>
        );
      }

      case 3: {
        return (
          <>
            <BackButton onPressOut={scrollBackward} />
            <NextButton
              buttonState={practiceNextButtonState}
              onPressOut={() => {
                scrollFoward(practiceSlides);
                if (currentIndex === 3) {
                  Keyboard.dismiss();
                }
              }}
            />
          </>
        );
      }

      case practiceSlides.length - 1: {
        return (
          <>
            {
              settingState === questionSettingState.initial && (
                <BackButton onPressOut={scrollBackward} />
              ) /*  : (
              <View />
            ) */
            }
            {settingState === questionSettingState.initial ? ( // settingState === questionSettingState.taskとなっていたがそれでは問題開始してしまったためinitialに変更
              <ButtonContextProvider
                state={ButtonStates.released}
                onPressOut={onPressOutSaveTaskButton}
              >
                <View style={tw`mr-3`}>
                  <PrimaryShortButton text="課題に設定" />
                </View>
              </ButtonContextProvider>
            ) : (
              <ButtonContextProvider
                state={ButtonStates.released}
                onPressOut={() => {
                  onPressStartPracticeTest()
                    .then(() => {
                      console.log('練習モードテスト開始');
                    })
                    .catch((error: unknown) => {
                      console.error('displayPracticeFooter：処理失敗', error);
                    });
                }}
              >
                <View style={tw`mr-3`}>
                  <PrimaryShortButton text="出題開始" />
                </View>
              </ButtonContextProvider>
            )}
          </>
        );
      }

      default: {
        return (
          <>
            <BackButton
              onPressOut={() => {
                scrollBackward();
              }}
            />
            <NextButton
              buttonState={practiceNextButtonState}
              onPressOut={() => {
                scrollFoward(practiceSlides);
              }}
            />
          </>
        );
      }
    }
  }, [
    currentIndex,
    practiceNextButtonState,
    settingState,
    navigation,
    onPressStartPracticeTest,
    scrollBackward,
    scrollFoward,
    practiceSlides,
    onPressOutSaveTaskButton,
  ]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll(event) {
      scrollX.value = event.contentOffset.x;
    },
  });

  return (
    <>
      <Background>
        <View style={tw`bg-white items-center`}>
          {settingState === questionSettingState.initial && (
            <>
              <Spacer isHorizontal={false} size={16} />
              <ProgressTracker
                key={progressTrackerKey}
                dataLength={practiceSlides.length}
                currentIndex={currentIndex}
                scrollX={scrollX}
              />
              <Spacer isHorizontal={false} size={16} />
            </>
          )}
        </View>
        <Animated.FlatList
          ref={slidesRef}
          horizontal
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          bounces={false}
          style={tw`w-full bg-background`}
          keyExtractor={(item: string) => item}
          scrollEventThrottle={32}
          viewabilityConfig={viewConfig}
          initialScrollIndex={initialScrollIndex}
          data={practiceSlides}
          extraData={currentIndex}
          getItemLayout={(_data, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          renderItem={({item}) => {
            return (
              <PracticeQuestionSettingModalItem
                key={`practice-setting-item-${item}`}
                currentIndex={item}
              />
            );
          }}
          onViewableItemsChanged={viewableItemsChanged}
          onScroll={scrollHandler}
        />
      </Background>
      <View
        style={tw`absolute self-end bottom-0 w-100% px-5 bg-white flex-row items-center ${settingState === questionSettingState.initial ? 'justify-between' : 'justify-center'}`}
      >
        {displayPracticeFooter}
      </View>
    </>
  );
};

export default PracticeQuestionSettingViewModal;
