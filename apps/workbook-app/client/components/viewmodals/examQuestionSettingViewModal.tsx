import type {ViewToken} from 'react-native';
import {View, useWindowDimensions} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import {
  useState,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import {Background} from '@react-navigation/elements';
import {useNavigation} from '@react-navigation/native';
import tw from '../../tailwind.custom';
import {QuestionSettingViewContext} from '../hooks/useQuestionSettingViewContext';
import Spacer from '../parts/spacer';
import ProgressTracker from '../parts/progressTracker';
import {questionSettingState} from '../../types/commonUnionType';
import BackButton from '../parts/backButton';
import PrimaryShortButton from '../parts/primaryShortButton';
import type {RootViewsProps} from '../../types/viewParameter';
import {ButtonContextProvider, ButtonStates} from '../hooks/useButtonContext';
import NextButton from '../parts/nextButton';
import ExamQuestionSettingViewModalModalItem from '../organisms/examQuestionSettingModalItem';
import {CalendarTaskSettingViewModalContext} from '../views/calendarView/hooks/useCalendarTaskSettingViewModalContext';

export type ExamQuestionSettingViewModalProps = Record<string, never>;

const ExamQuestionSettingViewModal = (
  _props: ExamQuestionSettingViewModalProps,
) => {
  const navigation =
    useNavigation<RootViewsProps<'ModalStack'>['navigation']>();
  const {
    questionModeType,
    settingState,
    examSlides,
    currentIndex,
    setCurrentIndex,
    slidesRef,
    scrollBackward,
    scrollFoward,
    examSubjectCheckedButtonInfoList,
    currentSelectedExamSettingIdList,
  } = useContext(QuestionSettingViewContext);
  const {saveTaskQuestionSetting} = useContext(
    CalendarTaskSettingViewModalContext,
  );

  const width = useWindowDimensions().width;
  const [progressTrackerKey, setProgressTrackerKey] = useState<string>('pt');
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
      setCurrentIndex(examSlides.length - 1);
    }
  }, [questionModeType, examSlides.length, setCurrentIndex, settingState]);

  // const scrollX = useRef(new Animated.Value(0)).current;
  const initialScrollIndex = useMemo(() => {
    return settingState === questionSettingState.initial
      ? 0
      : examSlides.length - 1;
  }, [settingState, examSlides.length]);
  const scrollX = useSharedValue(initialScrollIndex * width);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll(event) {
      scrollX.value = event.contentOffset.x;
    },
  });

  const viewableItemsChanged = useRef(
    ({viewableItems}: {viewableItems: ViewToken[]}) => {
      // console.log('viewableItems[0].index', viewableItems[0].index);
      setCurrentIndex(viewableItems[0].index);
    },
  ).current;

  const viewConfig = useRef({viewAreaCoveragePercentThreshold: 50}).current;

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const displayExamFooter = useCallback(() => {
    switch (currentIndex) {
      case 0: {
        return (
          <>
            <BackButton
              onPressOut={() => {
                navigation.goBack();
              }}
            />
            <View style={tw`h-5`} />
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

      case examSlides.length - 1: {
        return (
          <>
            {settingState === questionSettingState.initial ? (
              <BackButton onPressOut={scrollBackward} />
            ) : (
              <View />
            )}
            <ButtonContextProvider
              state={ButtonStates.released}
              onPressOut={() => {
                saveTaskQuestionSetting(
                  questionModeType,
                  undefined,
                  currentSelectedExamSettingIdList,
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
              }}
            >
              <View style={tw`mr-3`}>
                <PrimaryShortButton text="課題に設定" />
              </View>
            </ButtonContextProvider>
          </>
        );
      }

      default: {
        return (
          <>
            <BackButton onPressOut={scrollBackward} />
            <NextButton
              buttonState={ButtonStates.released}
              onPressOut={() => {
                scrollFoward(examSlides);
              }}
            />
          </>
        );
      }
    }
  }, [currentIndex, examSubjectCheckedButtonInfoList]);

  return (
    <>
      <Background>
        {settingState === questionSettingState.initial && (
          <View style={tw`bg-white items-center`}>
            <ProgressTracker
              key={progressTrackerKey}
              dataLength={examSlides.length}
              currentIndex={currentIndex}
              scrollX={scrollX}
            />
            <Spacer isHorizontal={false} size={32} />
          </View>
        )}

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
          data={examSlides}
          getItemLayout={(_data, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          renderItem={({item}) => (
            <ExamQuestionSettingViewModalModalItem id={item} />
          )}
          onScroll={scrollHandler}
          onViewableItemsChanged={viewableItemsChanged}
        />
      </Background>
      <View style={tw`flex-row  px-5 justify-between items-center bg-white`}>
        {displayExamFooter()}
      </View>
    </>
  );
};

export default ExamQuestionSettingViewModal;
