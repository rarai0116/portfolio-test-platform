import type {Timestamp} from 'firebase-admin/firestore';
import type {GradeStr} from './grade';
import type {ButtonInfoList} from './button';

export const questionGrade = {
  gradeOne: '1級',
  gradeTwo: '2級',
} as const;
export type QuestionGradeType =
  (typeof questionGrade)[keyof typeof questionGrade];

export const gradeCommonStates = {
  firstGrade: 'firstGrade',
  secondGrade: 'secondGrade',
} as const;
export type GradeCommonType =
  (typeof gradeCommonStates)[keyof typeof gradeCommonStates];

export const questionSubject = {
  subjectOne: '学科Ⅰ',
  subjectTwo: '学科Ⅱ',
  subjectThree: '学科Ⅲ',
  subjectFour: '学科Ⅳ',
  subjectFive: '学科Ⅴ',
} as const;
export type QuestionSubjectType =
  (typeof questionSubject)[keyof typeof questionSubject];

export const questionData = {
  /* eraName: '元号', */
  year: '年',
  /* questionNumber: '問題番号',
	currentQuestionNumber: '現在の問題番号',
	numberOfQuestions: '問題数',
	totalNumberOfQuestionsinTest: '合計問題数',
	numberOfCorrectAnswers: '正解数',
	pastexamQuestionNumber: '過去問題番号', */

  answer: '解答',
  img: '画像',
  questionSentence: '問題文',
  choiceOneSentence: '選択肢1',
  choiceTwoSentence: '選択肢2',
  choiceThreeSentence: '選択肢3',
  choiceFourSentence: '選択肢4',
  choiceFiveSentence: '選択肢5',

  generalExplanationSentence: '全体解説',
  explanationOneSentence: '解説1',
  explanationTwoSentence: '解説2',
  explanationThreeSentence: '解説3',
  explanationFourSentence: '解説4',
  explanationFiveSentence: '解説5',
  other: 'その他',
} as const;
export type QuestionDataType = (typeof questionData)[keyof typeof questionData];

// CategoryData
export const questionCategoryName = {
  subject: '学科',
  bigCategory: '大カテゴリ―',
  smallCategory: '小カテゴリ―',
} as const;

// 問題設定
export type CategoryNameType =
  (typeof questionCategoryName)[keyof typeof questionCategoryName];

export const questionSettingState = {
  initial: '初期設定',
  task: '課題',
  saved: '保存した設定',
  previous: '前回の設定',
  interrupted: '中断した設定',
  categoryDataAnalysis: 'カテゴリ―データ分析',
} as const;
export type QuestionSettingStateType =
  (typeof questionSettingState)[keyof typeof questionSettingState];

export const questionMode = {
  practice: '練習モード',
  exam: '模擬試験モード',
  /* taskPractice: '<課題>練習モード',
	taskExam: '<課題>模擬試験モード', */
  /* savedSetting: '保存した設定', */
} as const;
export type QuestionModeType = (typeof questionMode)[keyof typeof questionMode];

export const questionFormat = {
  fourChoices: '四択',
  fiveChoices: '五択',
  qAndA: '一問一答(〇✕)',
} as const;
export type QuestionFormatType =
  (typeof questionFormat)[keyof typeof questionFormat];

export const questionOrder = {
  inOrder: '試験問題順',
  inRandomOrder: 'ランダム',
} as const;
export type QuestionOrderType =
  (typeof questionOrder)[keyof typeof questionOrder];

export const questionDifficulties = {
  one: '☆',
  two: '☆☆',
  three: '☆☆☆',
} as const;
export type QuestionDifficultiesType =
  (typeof questionDifficulties)[keyof typeof questionDifficulties];

export const questionCoverage = {
  onlyWeakSpot: '苦手問題のみ',
  onlyUnanswered: '未回答問題のみ',
  bothWeakSpotAndUnanswered: '苦手・未回答のみ',
  all: 'すべて出題',
} as const;
export type QuestionCoverageType =
  (typeof questionCoverage)[keyof typeof questionCoverage];

export const questionState = {
  notStarted: '未着手',
  progress: '途中',
  completed: '完了',
} as const;
export type QuestionStateType =
  (typeof questionState)[keyof typeof questionState];

export const taskPrimaryTab = {
  today: '今日',
  user: 'あなた',
  teacher: '講師',
} as const;

export type TaskPrimaryTabType =
  (typeof taskPrimaryTab)[keyof typeof taskPrimaryTab];

export const taskDeadlineState = {
  inComplete: '未完了',
  completed: '完了',
  all: 'すべて',
  /* today: '今日',
	afterTomorrow: '明日～', */
  expired: '期限切れ',
} as const;
export type TaskDeadlineStateType =
  (typeof taskDeadlineState)[keyof typeof taskDeadlineState];

export const taskAuthor = {
  user: 'あなた',
  teacherTanaka: '田中先生',
  teacherSuzuki: '鈴木先生',
} as const;
export type TaskAuthorType = (typeof taskAuthor)[keyof typeof taskAuthor];

export const individualMessageSender = {
  app: 'アプリ',
  teacherTanaka: '田中先生',
  teacherSuzuki: '鈴木先生',
} as const;
export type IndividualMessageSenderType =
  (typeof individualMessageSender)[keyof typeof individualMessageSender];

export const messageSender = {
  app: 'アプリ',
  teacher: '先生',
} as const;
export type MessageSenderType =
  (typeof messageSender)[keyof typeof messageSender];

export const messageCardStyle = {
  summary: '概要',
  detail: '詳細',
} as const;
export type MessageCardStyleType =
  (typeof messageCardStyle)[keyof typeof messageCardStyle];

export const SettingCardState = {
  task: '課題',
  saved: '保存した設定',
  previous: '前回の設定',
} as const;
export type SettingCardType =
  (typeof SettingCardState)[keyof typeof SettingCardState];

export const inquiryFormModalStates = {
  inquiryFormViewModal: 'inquiryFormViewModal',
  askSubmit: 'askSubmit',
  submitCompleted: 'submitCompleted',
  submitFailed: 'submitFailed',
};

export const questionSettingModalStates = {
  viewModal: 'questionSettingViewModal',
  /* viewModal_save:'viewModal_save',
	viewModal_task:'viewModal_task',
	viewModal_analysis:'viewModal_analysis', */

  // 初期設定
  askInitialSaveSetting: 'askInitialSaveSetting',
  // 保存した設定
  askSaveSetting: 'askSaveSetting',
  askStart: 'askStart',
  saveAsNewCompleted: 'savedAsNewCompleted',
  overwriteCompleted: 'overwriteCompleted',
  saveAsNewTextInput: 'saveAsNewTextInput',
};

export const savedSettingModalStates = {
  viewModal: 'savedSettingViewModal',
};

export type PracticeSettingKey =
  | 'qaaQuestionCategory'
  | 'questionCategory'
  | 'questionFormat'
  | 'questionOrder'
  | 'questionDifficulties'
  | 'questionCoverage'
  | 'option'
  | 'numberOfQuestions'
  | 'questionTime';
export type PracticeQuestionSettingType = {
  [key in PracticeSettingKey]: ButtonInfoList;
};
export type PracticeQuestionSettingIdList = Record<
  PracticeSettingKey,
  string[]
>;
export type ExamSettingKey = 'subject' | 'numberOfQuestions';
export type ExamQuestionSettingType = {
  [key in ExamSettingKey]: ButtonInfoList;
};
export type ExamQuestionSettingIdType = Record<ExamSettingKey, string[]>;
export const taskCalendarColor = {
  red: 'bg-calendar-R',
  redOrange: 'bg-calendar-RO',
  orange: 'bg-calendar-O',
  yellow: 'bg-calendar-Y',
  yellowGreen: 'bg-calendar-YG',
  green: 'bg-calendar-G',
  blueGreen: 'bg-calendar-BG',
  workbookBlue: 'bg-workbookblue-300',
  blue: 'bg-calendar-B',
  blueViolet: 'bg-calendar-BV',
  violet: 'bg-calendar-V',
  redViolet: 'bg-calendar-RV',
  gray: 'bg-quaternary',
  black: 'bg-secondary',
  white: 'bg-white',
} as const;
export type TaskCalendarColor =
  (typeof taskCalendarColor)[keyof typeof taskCalendarColor];
// 課題情報
export type TaskSettingType = {
  testId?: string;
  isTeacher: boolean;
  isOpen?: boolean;
  taskState: QuestionStateType;
  author: TaskAuthorType;
  /** 新しいdeadlineDateは基本的に先生からのみ指定される
   * taskDateが設定されず、deadlineDateのみが設定されている場合、カレンダーには
   * [タイトル名]〆切という名前で表示される
   * なおtaskDateもdeadlineDateも設定されていない場合、カレンダーには表示されない
   * (現在の仕様ではどちらもないタスクは想定していない)
   */
  deadlineDate?: Timestamp;
  /** 現deadlineDateをtaskDateに変更する
   *  複数日にまたがるタスクは8月版の段階では作らないが、9月以降に実装する
   *  単日のタスクの場合、startAtとendAtはそれぞれ同じ日付の00:00:00.000と23:59:59.999に設定する
   *  なお時間指定は現状実装していないので基本的にstartAtは00:00:00.000、endAtは23:59:59.999に設定する
   */
  taskDate?: Array<{
    startAt: Timestamp;
    endAt: Timestamp;
  }>;
  isAbleToAnswerAfterDeadline: boolean | undefined; // falseの場合は解けないようにする
  isExpired: boolean | undefined;
  taskNotification: boolean;
  taskCalendarColor: TaskCalendarColor;
  taskMemo: string;
  hasTask: boolean;
};
export type SettingCardData = {
  [key: string]:
    | string
    | number
    | boolean
    | undefined
    | PracticeQuestionSettingIdList
    | ExamQuestionSettingIdType
    | TaskSettingType
    | Date
    | string[];
  // 共通props
  id: string;
  grade: QuestionGradeType;
  title?: string;
  settingState: QuestionSettingStateType;
  questionMode: QuestionModeType; // taskにも？
  practiceQuestionSetting: PracticeQuestionSettingIdList;
  examQuestionSetting: ExamQuestionSettingIdType;
  isQaa?: boolean;
  // taskのみ
  isTeacher?: boolean;
  isNew?: boolean;
  taskState?: QuestionStateType;
  author?: TaskAuthorType;
  deadlineDate?: Date;
  isAbleToAnswerAfterDeadline?: boolean; // falseの場合は解けないようにする
  isExpired?: boolean | undefined;
  isInModal?: boolean;
  // taskのみ
  taskSetting?: TaskSettingType;
  // savedのみ
  isPreviousSetting?: boolean; // 前回の設定をフラグで管理しようとすると誤作動を起こすのでこのパラメータは保存しないで読み込み時に付与する
  // 選択可能か
  disablePress?: boolean | undefined;
};

export type TestPlayDataLog = {
  [key: string]:
    | string
    | number[]
    | boolean
    | Timestamp
    | number
    | SettingCardData
    | null
    | undefined;
  testId: string;
  uid: string;
  controll: 'create' | 'update' | 'delete';
  changeAt: Timestamp; // 更新日時
  grade: GradeStr; // 級
  type: 'exam' | 'practice'; // テスト種別 'exam' | 'practice'
  testDataNoList: number[]; // テストデータNoのリスト
  answerList?: number[]; // 解答リスト
  durationTimePerAnswer: number[]; // 解答ごとの経過時間(ms)
  selectedAnswerList?: number[]; // 選択した解答リスト
  currentPlayNo?: number; // 現在の問題番号
  isFinished?: boolean; // テストが終了したかどうか(isCompletedに)
  // isCompleted?: boolean; // テストが完了したかどうか
  correctAnswerCount?: number; // 正解数
  questionCount: number; // 問題数
  durationTime?: number; // 経過時間(ms)
  limitTime: number; // 制限時間(ms)
  startAt: Timestamp; // テスト開始日時
  endAt?: Timestamp | null; // テスト終了日時
  isQaa?: boolean; // QAAモードかどうか
  settingCardData?: SettingCardData; // テスト設定情報
};
