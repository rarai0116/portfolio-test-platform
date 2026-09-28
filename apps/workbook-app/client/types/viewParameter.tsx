import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import type {StackScreenProps} from '@react-navigation/stack';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {PracticeQuestionSettingType} from '../components/hooks/useQuestionSettingViewContext';
import type {ButtonStateType} from '../components/hooks/useButtonContext';
import type {QuestionSettingStateType} from './commonUnionType';

type CommonParams = {
  // allScreenIdListの値を指定する
  userId: string;
};

export type RootPagesList = {
  LoadingPage: CommonParams;
  MainPage: NavigatorScreenParams<MainViewsList> & CommonParams;
  Maintenance: CommonParams;
};

export type RootPagesProps<T extends keyof RootPagesList> = StackScreenProps<
  RootPagesList,
  T
>;

export type MainViewsList = {
  ModalStack: NavigatorScreenParams<CalendarModalList> & CommonParams;
  Tab: NavigatorScreenParams<TabViewsList> & CommonParams;
  Test: NavigatorScreenParams<TestViewsList> & CommonParams;
};

export type RootViewsProps<T extends keyof MainViewsList> = StackScreenProps<
  MainViewsList,
  T
>;

// 全画面モーダル
export type ModalViewsList = {
  CalendarSettingModal: NavigatorScreenParams<CalendarModalList> & CommonParams;
};

export type ModalViewsProps<T extends keyof ModalViewsList> = StackScreenProps<
  ModalViewsList,
  T
>;

// カレンダーページのモーダル
export type CalendarModalList = {
  CalendarTaskSetting: {
    isReloadCurrentSettingId: boolean;
  } & CommonParams;
  SelectQuestionMode: CommonParams;
  PracticeQuestionSetting: CommonParams;
  ExamQuestionSetting: CommonParams;
  SavedSetting: CommonParams;
};

export type CalendarModalProps<T extends keyof CalendarModalList> =
  CompositeScreenProps<
    StackScreenProps<CalendarModalList, T>,
    BottomTabScreenProps<MainViewsList>
  >;

// タブ
export type TabViewsList = {
  QuestionTab: NavigatorScreenParams<HomeViewsList> & CommonParams;
  CalenderTab: NavigatorScreenParams<CalendarViewsList> & CommonParams;
  DataAnalysisTab: NavigatorScreenParams<DataAnalysisViewsList> & CommonParams;
  MyPageTab: NavigatorScreenParams<MyPageViewsList> & CommonParams;
};

export type TabViewsProps<T extends keyof TabViewsList> = StackScreenProps<
  TabViewsList,
  T
>;

// ホームViews
export type HomeViewsList = {
  Home: CommonParams;
  TaskMode: CommonParams;
  SavedSetting: CommonParams;
} & HomeViewsListWithoutTab;

export type QuestionViewsProps<T extends keyof HomeViewsList> =
  CompositeScreenProps<
    StackScreenProps<HomeViewsList, T>,
    BottomTabScreenProps<MainViewsList>
  >;

// タブ非表示問題ページ
export type HomeViewsListWithoutTab = {
  QuestionCategoryAccordion: {
    id: string;
    settingState: QuestionSettingStateType;
    checkedCategoryIdList: string[];
    practiceQuestionFirstSettingButtonList: PracticeQuestionSettingType;
  } & CommonParams;
  QuestionSetting: {
    id: string;
    headerTitle: string | undefined;
    checkedCategoryIdList?: string[];
    userId: string;
    // checkedCategoryString?: string;
  } & CommonParams;
};
// 問題プレイ・結果画面
export type TestViewsList = {
  QuestionAndChoicesView: {} & CommonParams;
  QuestionResultView: {
    footerButtonState: ButtonStateType;
  } & CommonParams;
  QuestionResultAnswerView: {
    currentPlayNo: number;
  } & CommonParams;
};

export type TestViewsProps<T extends keyof TestViewsList> = StackScreenProps<
  TestViewsList,
  T
>;

// 分析
export type DataAnalysisViewsList = {
  DataAnalysisHome: CommonParams;
};

export type DataAnalysisViewsProps<T extends keyof DataAnalysisViewsList> =
  CompositeScreenProps<
    StackScreenProps<DataAnalysisViewsList, T>,
    BottomTabScreenProps<MainViewsList>
  >;

// カレンダー
export type CalendarViewsList = {
  CalendarHome: CommonParams;
};

export type CalendarViewsProps<T extends keyof CalendarViewsList> =
  CompositeScreenProps<
    StackScreenProps<CalendarViewsList, T>,
    BottomTabScreenProps<MainViewsList>
  >;

// マイページ
export type MyPageViewsList = {
  MyPageHome: {} & CommonParams;
  MyPageMessage: {} & CommonParams;
  MyPageEachMessage: {
    id: string;
  } & CommonParams;
  MyPageInquiryForm: {} & CommonParams;
  MyPageSetting: {} & CommonParams;
  MyPageChangeGrade: {} & CommonParams;
};

export type MyPageViewsProps<T extends keyof MyPageViewsList> =
  CompositeScreenProps<
    StackScreenProps<MyPageViewsList, T>,
    BottomTabScreenProps<MainViewsList>
  >;

type AllPageList = RootPagesList &
  MainViewsList &
  ModalViewsList &
  TabViewsList &
  HomeViewsList &
  TestViewsList &
  DataAnalysisViewsList &
  CalendarViewsList &
  MyPageViewsList &
  CalendarModalList;

export const allScreenIdList: {
  [K in keyof AllPageList]: string;
} = {
  LoadingPage: 'page-loading',
  MainPage: 'page-main',
  Maintenance: 'page-maintenance',
  ModalStack: 'page-modal',
  Tab: 'page-tab',
  Test: 'page-test',
  CalendarSettingModal: 'page-calendar-setting',
  SavedSetting: 'page-saved-setting',
  QuestionTab: 'page-question-tab',
  CalenderTab: 'page-calendar-tab',
  DataAnalysisTab: 'page-data-analysis-tab',
  MyPageTab: 'page-my-page-tab',
  Home: 'page-home',
  TaskMode: 'page-task-mode',
  QuestionCategoryAccordion: 'page-question-category-accordion',
  QuestionSetting: 'page-question-setting',
  QuestionAndChoicesView: 'page-question-and-choices-view',
  QuestionResultView: 'page-question-result-view',
  QuestionResultAnswerView: 'page-question-result-answer-view',
  DataAnalysisHome: 'page-data-analysis-home',
  CalendarHome: 'page-calendar-home',
  MyPageHome: 'page-my-page-home',
  MyPageMessage: 'page-my-page-message',
  MyPageEachMessage: 'page-my-page-each-message',
  MyPageInquiryForm: 'page-my-page-inquiry-form',
  MyPageSetting: 'page-my-page-setting',
  MyPageChangeGrade: 'page-my-page-change-grade',
  CalendarTaskSetting: 'page-calendar-task-setting',
  SelectQuestionMode: 'page-select-question-mode',
  PracticeQuestionSetting: 'page-practice-question-setting',
  ExamQuestionSetting: 'page-exam-question-setting',
  // ここに新しいページを追加する場合は、上記の型とこのオブジェクトの両方に追加してください
  // 例: NewPage: 'page-new-page',
};
export const allScreenIdListKeys = Object.keys(allScreenIdList) as Array<
  keyof AllPageList
>;

// navigation.navigateの引数を生成する関数
// generatePageParams('MainPage/Tab/QuestionTab/Home') =>
//   {'MainPage', {userId: 'page-main', screen: 'Tab', params: {screen: 'QuestionTab', params: {screen: 'Home'}}}}
/*
export const generatePageParams = (screenPath: string) => {
  const screenNames = screenPath.split('/');
  const firstScreenName = screenNames[0];
  const firstScreenId = allScreenIdList[firstScreenName as keyof AllPageList];
  // screenIdが存在しない場合はエラーを返す
  if (!firstScreenId) {
    throw new Error(`Invalid screen id name: ${firstScreenName}`);
  }

  // screenNameが存在しない場合はエラーを返す
  if (!screenNames.includes(firstScreenName)) {
    throw new Error(`Invalid screen name name: ${firstScreenName}`);
  }

  if (screenNames.length === 1)
    return {firstScreenName, params: {userId: firstScreenId}};

  const params = screenNames.reduceRight<{
    screen: keyof AllPageList;
    params: Record<string, unknown>;
  }>(
    (acc, screenName, index) => {
      // screenNameが存在しない場合はエラーを返す
      if (!screenNames.includes(screenName)) {
        throw new Error(`Invalid screen name name: ${screenName}`);
      }

      const userId = allScreenIdList[screenName as keyof AllPageList];
      // screenIdが存在しない場合はエラーを返す
      if (!userId) {
        throw new Error(`Invalid screen id name: ${screenName}`);
      }

      // 最後のscreenは返さない
      if (index === screenNames.length - 1) return acc;
      return {
        screen: screenName as keyof AllPageList,
        params: {userId, ...acc},
      };
    },
    {screen: lastScreenName, params: {}},
  );
  return params;
};
*/
