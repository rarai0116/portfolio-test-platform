import {summarizeConsoleValue} from '../../../../functionals/consoleLevels';
import type {ViewToken, FlatList} from 'react-native';
import {useCallback, useMemo, useRef, useState} from 'react';
import {currentMonth, currentYear} from '../../../../functionals/timeManager';
import type {CalenderYmData} from '../../../../../types/customCalendarTypes';

export type CalendarSwipe = {
  initialScrollRange: number;
  pastScrollRange: number;
  ymData: CalenderYmData[];
  setYmData: React.Dispatch<React.SetStateAction<CalenderYmData[]>>;
  currentIndex: number | null;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number | null>>;
  viewConfig: {viewAreaCoveragePercentThreshold: number};
  viewableItemsChanged: ({viewableItems}: {viewableItems: ViewToken[]}) => void;
  flashListRef: React.RefObject<FlatList<CalenderYmData> | null>;
  scrollFoward: (slides: string[]) => void;
  scrollBackward: () => void;
};

/** カスタムカレンダーのhooks */
export const useCalendarSwipe: (calendarType: string) => CalendarSwipe = (
  _calendarType,
) => {
  // 1年分(9月～8月)
  /** 過去のスクロール範囲 */
  const pastScrollRange = useMemo(() => {
    return currentMonth >= 9 ? currentMonth - 9 : 12 + currentMonth - 9;
  }, []);

  /** 未来のスクロール範囲 */
  const futureScrollRange = useMemo(() => {
    // 9月～今月
    if (currentMonth >= 9) {
      return 12 - pastScrollRange - 1;
    }

    return 8 - currentMonth;
  }, [pastScrollRange]);

  /** 初期のスクロール範囲 */
  const initialScrollRange = useMemo(() => {
    return pastScrollRange + 1 + futureScrollRange;
  }, [pastScrollRange, futureScrollRange]);

  /** 表示する年月の初期値  */
  const initialYmData = useMemo(() => {
    return Array.from(
      {length: pastScrollRange + futureScrollRange + 1},
      (_, i) => {
        const offset = i - pastScrollRange;
        const totalMonths = currentYear * 12 + currentMonth + offset;
        const year = Math.floor((totalMonths - 1) / 12);
        const month = ((totalMonths - 1) % 12) + 1;
        return {year, month};
      },
    );
  }, [futureScrollRange, pastScrollRange]);

  /** 表示する月のデータを保持するステート  */
  const [ymData, setYmData] = useState<CalenderYmData[]>(initialYmData);

  const [currentIndex, setCurrentIndex] = useState<number | null>(
    pastScrollRange,
  );

  const viewConfig = useRef({viewAreaCoveragePercentThreshold: 50}).current;

  const viewableItemsChanged = useCallback(
    ({viewableItems}: {viewableItems: ViewToken[]}) => {
      if (viewableItems.length === 1 && viewableItems[0].index !== undefined) {
        setCurrentIndex(viewableItems[0].index);
      } else {
        console.warn(
          'Invalid viewableItems:',
          summarizeConsoleValue(viewableItems),
        ); // 期待しない状態のログ
      }
    },
    [],
  );

  const flashListRef = useRef<FlatList<CalenderYmData>>(null);

  /** スライドを前にスクロール */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const scrollFoward = useCallback(
    (slides: string[]) => {
      if (
        flashListRef?.current &&
        currentIndex !== null &&
        currentIndex < slides.length - 1
      ) {
        flashListRef.current.scrollToIndex({
          index: currentIndex + 1,
          animated: true,
        });
        setCurrentIndex(currentIndex + 1);
      } else {
      }
    },
    [flashListRef, currentIndex],
  );

  /** スライドを後ろににスクロール */
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const scrollBackward = useCallback(() => {
    if (flashListRef?.current && currentIndex !== null && currentIndex > 0) {
      flashListRef.current.scrollToIndex({
        index: currentIndex - 1,
        animated: true,
      });
      setCurrentIndex(currentIndex - 1);
    } else {
    }
  }, [flashListRef, currentIndex]);

  return {
    initialScrollRange,
    pastScrollRange,
    ymData,
    setYmData,
    currentIndex,
    setCurrentIndex,
    viewConfig,
    viewableItemsChanged,
    flashListRef,
    scrollFoward,
    scrollBackward,
  };
};
