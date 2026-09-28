import type {ViewToken} from 'react-native';
import {useWindowDimensions} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import {useState, useContext, useEffect, useRef, useMemo} from 'react';
import tw from '../../tailwind.custom';
import {QuestionSettingViewContext} from '../hooks/useQuestionSettingViewContext';
import Spacer from '../parts/spacer';
import ProgressTracker from '../parts/progressTracker';
import {questionSettingState} from '../../types/commonUnionType';
import ExamQuestionSettingModalItem from './examQuestionSettingModalItem';

export type ExamQuestionSettingModalProps = Record<string, never>;

const ExamQuestionSettingModal = (_props: ExamQuestionSettingModalProps) => {
  const {
    questionModeType,
    settingState,
    examSlides,
    currentIndex,
    setCurrentIndex,
    slidesRef,
  } = useContext(QuestionSettingViewContext);

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
  }, [questionModeType, settingState, examSlides.length, setCurrentIndex]);

  const initialScrollIndex = useMemo(() => {
    return settingState === questionSettingState.initial
      ? 0
      : examSlides.length - 1;
  }, [settingState, examSlides]);
  const scrollX = useSharedValue(initialScrollIndex * width);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll(event) {
      scrollX.value = event.contentOffset.x;
    },
  });

  const viewableItemsChanged = useRef(
    ({viewableItems}: {viewableItems: ViewToken[]}) => {
      setCurrentIndex(viewableItems[0].index);
    },
  ).current;

  const viewConfig = useRef({viewAreaCoveragePercentThreshold: 50}).current;

  return (
    <>
      {settingState === questionSettingState.initial && (
        <>
          <ProgressTracker
            key={progressTrackerKey}
            dataLength={examSlides.length}
            currentIndex={currentIndex}
            scrollX={scrollX}
          />

          <Spacer isHorizontal={false} size={32} />
        </>
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
        renderItem={({item}) => <ExamQuestionSettingModalItem id={item} />}
        onScroll={scrollHandler}
        onViewableItemsChanged={viewableItemsChanged}
      />
    </>
  );
};

export default ExamQuestionSettingModal;
