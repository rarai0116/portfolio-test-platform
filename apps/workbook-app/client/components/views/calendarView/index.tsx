import {
  useNavigation,
  useIsFocused,
  CommonActions,
  StackActions,
} from '@react-navigation/native';
import {
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useState,
  useRef,
} from 'react';
import {View, useWindowDimensions} from 'react-native';
import {useBottomTabBarHeight} from '@react-navigation/bottom-tabs';
import {
  allScreenIdList,
  type CalendarViewsProps,
} from '../../../types/viewParameter';
import {QuestionSettingViewContext} from '../../hooks/useQuestionSettingViewContext';
import {
  ButtonContextProvider,
  ButtonStates,
} from '../../hooks/useButtonContext';
import TaskButton from '../../parts/taskButton';
import Background from '../../parts/background';
import {taskSettingMode} from '../../../types/commonUnionType';
import {GlobalUserSettingContext} from '../../hooks/useGlobalUserSettingContext';
import CompletedTaskModal from '../../organisms/completedTaskModal';
import UnableToAnswerTaskModal from '../../organisms/unableToAnswerTaskModal';
import {calendarTheme} from '../../../types/customCalendarTypes';
import tw from '../../../tailwind.custom';
import {getStatusBarBackgroundColor} from '../../functionals/getStatusBarBackgroundColor';
import {CalendarTaskSettingViewModalContext} from './hooks/useCalendarTaskSettingViewModalContext';
import {HomeCalendar} from './organisms/HomeCalendar';
import {CustomCalendarContextProvider} from './hooks/useCustomCalendarContext';
import CalendarSelectedDateTaskList from './organisms/calendarSelectedDateTaskList';
import {GestureHandlerRootView} from 'react-native-gesture-handler';

export type CalendarViewProps = Record<string, never>;

const dumpNavState = (_label: string, nav: any) => {
  try {
    void [JSON.stringify(nav.getState(), null, 2)];
  } catch (e) {
    console.error('dumpNavState error', e);
  }
};

const CalendarView = (_props: CalendarViewProps) => {
  const isFocused = useIsFocused();
  const navigation =
    useNavigation<CalendarViewsProps<'CalendarHome'>['navigation']>();
  const _rootNav = navigation.getParent()?.getParent();
  const {setIsInCalendarTaskSetting} = useContext(QuestionSettingViewContext);
  const {
    setTemporaryTaskSetting,
    initialTaskSetting,
    setIsDefaultTitle,
    setCalendarTaskSettingMode,
  } = useContext(CalendarTaskSettingViewModalContext);
  const {
    readyForTest,
    setIsDisabledInput,
    isModalLikeViewVisibleRef,
    isModalVisibleRef,
  } = useContext(GlobalUserSettingContext);

  const _checkIfModalStackScreenIsActive = useMemo(() => {
    const parentState = navigation.getParent()?.getParent()?.getState();
    if (!parentState) return false;
    const currentRoute = parentState.routes[parentState.index];
    if (currentRoute.name === 'ModalStack') {
      return true;
    }

    return false;
  }, [navigation]);
  const [_preloadStatus, setPreloadStatus] = useState({
    isPreloading: false,
    isCompleted: false,
    error: null as string | null,
  });
  const isScreenPreloaded = useCallback(
    (screenName: string[]) => {
      try {
        const state = navigation
          .getParent()
          ?.getParent()
          ?.getParent()
          ?.getState();

        // ルートの状態を再帰的に検索
        const findScreen = (
          preloadedRoutes: any[],
          screenName: string[],
          index: number,
        ): boolean => {
          const targetName = screenName[index];

          return preloadedRoutes.some((route) => {
            if (route.name === targetName) {
              if (index === screenName.length - 2) {
                return true; // 最後のスクリーンが見つかった
              } else {
                return findScreen(
                  route.state.preloadedRoutes,
                  screenName,
                  index + 1,
                );
              }
            }

            // ネストされたナビゲーターも確認
            if (route.state?.routes) {
              return false;
            }

            return false;
          });
        };

        if (!state) return false;
        return findScreen(state.routes, screenName, 0);
      } catch (error) {
        console.error('プリロード状態の確認エラー:', error);
        return false;
      }
    },
    [navigation],
  );
  const idleIdRef = useRef<number | null>(null);

  const preloadCalendarTaskSetting = useCallback(() => {
    console.info('カレンダー登録画面のプリロード開始');
    if (isScreenPreloaded(['MainPage', 'ModalStack', 'CalendarTaskSetting'])) {
      setPreloadStatus({
        isPreloading: false,
        isCompleted: true,
        error: null,
      });
      return;
    }

    setPreloadStatus((prev) => ({...prev, isPreloading: true, error: null}));

    idleIdRef.current = requestIdleCallback(
      () => {
        console.info('インタラクション完了・プリロード要求');
        try {
          navigation.getParent()?.getParent()?.preload('ModalStack');
          console.info('カレンダー登録画面のプリロード要求完了');
          setPreloadStatus({
            isPreloading: false,
            isCompleted: true,
            error: null,
          });
        } catch (error) {
          console.error('CalendarTaskSetting プリロードエラー:', error);
          setPreloadStatus({
            isPreloading: false,
            isCompleted: false,
            error:
              error instanceof Error
                ? error.message
                : 'プリロードに失敗しました',
          });
        }
      },
      {timeout: 1500},
    );
  }, [navigation, isScreenPreloaded]);

  useEffect(() => {
    return () => {
      if (idleIdRef.current != null) {
        cancelIdleCallback(idleIdRef.current);
        idleIdRef.current = null;
      }
    };
  }, []);
  // テスト開始チェック
  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (!isFocused) return;
    console.log('カレンダー→テスト開始チェック', readyForTest);
    if (!readyForTest.isComplete) return;

    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          {name: 'MainPage'},
          {
            name: 'Test',
            params: {
              userId: allScreenIdList.Test,
              screen: 'QuestionAndChoicesView',
              params: {
                userId: allScreenIdList.QuestionAndChoicesView,
              },
            },
          },
        ],
      }),
    );
    setIsDisabledInput(false).catch((error: unknown) => {
      console.error('Error setting disabled input:', error);
    });
  }, [readyForTest.isComplete]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  useEffect(() => {
    if (!isFocused) return;
    preloadCalendarTaskSetting();
  }, [isFocused]);

  const openModalStack = () => {
    // 毎回最新の root ナビゲータを取得
    const rootNav = navigation.getParent()?.getParent();
    if (!rootNav) return;

    const state = rootNav.getState();
    const exists = state.routes.some((r: any) => r.name === 'ModalStack');

    // 同フレームの state 更新と衝突させない
    requestAnimationFrame(() => {
      if (exists) {
        // 既に存在するならフォーカス
        rootNav.dispatch(CommonActions.navigate('ModalStack' as never));
      } else {
        // 無ければ積む
        rootNav.dispatch(StackActions.push('ModalStack'));
      }
    });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: 現行の依存配列を意図的に維持する
  const handlePressTaskButton = useCallback(() => {
    dumpNavState('SELF', navigation);
    dumpNavState('PARENT', navigation.getParent?.());
    dumpNavState('ROOT', navigation.getParent?.()?.getParent?.());
    setIsInCalendarTaskSetting(true); // 課題モードかどうか
    setCalendarTaskSettingMode(taskSettingMode.save); // 保存モード
    setTemporaryTaskSetting(initialTaskSetting); // 初期化
    setIsDefaultTitle(true);
    console.log('カレンダー登録画面へ遷移要求');

    openModalStack();
    /*
rootNav?.dispatch(StackActions.push('ModalStack'));

// 直後に状態を再ダンプ（次フレームで routes に ModalStack が増えているか確認）
requestAnimationFrame(() => {
  console.log('After push ROOT', JSON.stringify(rootNav?.getState(), null, 2));
});
*/
  }, [
    initialTaskSetting,
    navigation,
    setCalendarTaskSettingMode,
    setIsDefaultTitle,
    setTemporaryTaskSetting,
    setIsInCalendarTaskSetting,
  ]);
  //  if (!isFocused && !isInCalendarTaskSetting) return <Background />;
  const viewColor = useMemo(() => {
    return `bg-[${getStatusBarBackgroundColor(isModalLikeViewVisibleRef.current || isModalVisibleRef.current)}]`;
  }, [isModalLikeViewVisibleRef, isModalVisibleRef]);

  const bottomTabBarHeight = useBottomTabBarHeight();
  const {height} = useWindowDimensions();
  const buttonPosition = useMemo(() => {
    return height / 20 + bottomTabBarHeight;
  }, [height, bottomTabBarHeight]);

  return (
    <GestureHandlerRootView style={tw`flex-1`}>
      <View style={tw`${viewColor}`}>
        <Background>
          <CompletedTaskModal />
          <UnableToAnswerTaskModal />
          <CustomCalendarContextProvider calendarType={calendarTheme.basic}>
            <HomeCalendar />
          </CustomCalendarContextProvider>
          {/* <View style={tw`border border-quaternary`} /> */}
          <CalendarSelectedDateTaskList />
        </Background>
      </View>
      <ButtonContextProvider
        state={ButtonStates.released}
        onPressOut={handlePressTaskButton}
      >
        <View style={tw`absolute bottom-[${buttonPosition}px] right-5`}>
          <TaskButton type="add" />
        </View>
      </ButtonContextProvider>
    </GestureHandlerRootView>
  );
};

export default CalendarView;
