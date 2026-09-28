import type {ViewToken} from 'react-native';
import {
  // FlatList,
  // Animated,
  useWindowDimensions,
  type ListRenderItem,
  type ListRenderItemInfo,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import {
  useState,
  useContext,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  memo,
} from 'react';
import tw from '../../tailwind.custom';
import Spacer from '../parts/spacer';
import ProgressTracker from '../parts/progressTracker';
import {QuestionSettingViewContext} from '../hooks/useQuestionSettingViewContext';
import {questionSettingState} from '../../types/commonUnionType';
import PracticeQuestionSettingModalItem from './practiceQuestionSettingModalItem';

export type PracticeQuestionSettingModalProps = Record<string, never>;

const MemorizedPracticeQuestionSettingModalItem = memo(
  PracticeQuestionSettingModalItem,
);
const PracticeQuestionSettingModal = (
  _props: PracticeQuestionSettingModalProps,
) => {
  const {
    settingState,
    questionModeType,
    practiceSlides,
    currentIndex,
    setCurrentIndex,
    slidesRef,
  } = useContext(QuestionSettingViewContext);

  const width = useWindowDimensions().width;
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
      setProgressTrackerKey(`pt${String(Date.now())}`);
    },
  ).current;

  const viewConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
    waitForInteraction: false,
  }).current;
  const scrollHandler = useAnimatedScrollHandler({
    onScroll(event) {
      scrollX.value = event.contentOffset.x;
    },
  });
  const renderItem: ListRenderItem<string> = useCallback(
    ({item}: ListRenderItemInfo<string>) => {
      return <MemorizedPracticeQuestionSettingModalItem currentIndex={item} />;
    },
    [],
  );

  // コンポーネントの初期化
  /*
  useEffect(() => {
    setProgressTrackerKey('pt' + String(Date.now()));
  }, [currentIndex]);
  */

  // 初期化
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (settingState === questionSettingState.initial) {
      setCurrentIndex(0);
    } else {
      setCurrentIndex(practiceSlides.length - 1);
    }
  }, [settingState, questionModeType, practiceSlides.length]);

  return (
    <>
      {settingState === questionSettingState.initial && (
        <>
          <ProgressTracker
            key={`pqsm_${progressTrackerKey}`}
            dataLength={practiceSlides.length}
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
        keyExtractor={(item: string, index: number) => `pqsm-${item}-${index}`}
        scrollEventThrottle={32}
        viewabilityConfig={viewConfig}
        initialScrollIndex={initialScrollIndex}
        data={practiceSlides}
        initialNumToRender={2}
        maxToRenderPerBatch={3}
        windowSize={5}
        getItemLayout={(_data, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        extraData={currentIndex}
        renderItem={renderItem}
        onViewableItemsChanged={viewableItemsChanged}
        onScroll={scrollHandler}
      />
    </>
  );
};

export default PracticeQuestionSettingModal;
