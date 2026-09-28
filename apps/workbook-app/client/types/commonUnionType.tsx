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

export type GradeNumber = 1 | 2;

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
  bothUnCorrectlyAndWeakSpot: '苦手または未回答問題',
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
  // expired: '期限切れ',
} as const;
export type TaskDeadlineStateType =
  (typeof taskDeadlineState)[keyof typeof taskDeadlineState];

export const taskAuthor = {
  user: 'あなた',
  teacher: '講師',
} as const;
export type TaskAuthorType = (typeof taskAuthor)[keyof typeof taskAuthor];

export const individualMessageSender = {
  app: 'アプリ',
  teacher: '講師',
} as const;
export type IndividualMessageSenderType =
  (typeof individualMessageSender)[keyof typeof individualMessageSender];

export const messageSender = {
  app: 'アプリ',
  teacher: '講師',
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

export const taskSettingMode = {
  save: '保存',
  edit: '編集',
} as const;

export type TaskSettingModeType =
  (typeof taskSettingMode)[keyof typeof taskSettingMode];

export const inquiryFormModalStates = {
  inquiryFormViewModal: 'inquiryFormViewModal',
  askSubmit: 'askSubmit',
  submitCompleted: 'submitCompleted',
  submitFailed: 'submitFailed',
  askClose: 'askClose',
};

export const errorReportFormModalStates = {
  viewModal: 'errorReportFormViewModal',
  askSubmit: 'askSubmit',
  submitCompleted: 'submitCompleted',
  submitFailed: 'submitFailed',
  askClose: 'askClose',
};

export const questionHomeViewModalStates = {
  TodayTask: 'TodayTask',
  InterruptedData: 'InterruptedData',
  QuestionStartFailed: 'QuestionStartFailed',
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
  // 演習開始失敗
  notEnoughQuestionSettingCondition: 'notEnoughQuestionSettingCondition',
  noQuestionSettingCondition: 'noQuestionSettingCondition',
  QuestionStartFailed: 'QuestionStartFailed',
};

export const savedSettingModalStates = {
  viewModal: 'savedSettingViewModal',
};

export const taskSettingModalStates = {
  viewModal: 'taskSetting-viewModal',
  todayModal: 'taskSetting-todayModal',
};

export const settingCardModalStates = {
  completedTaskModal: 'completedTaskModal',
  unableToAnswerModal: 'unableToAnswerModal',
  deleteSettingModal: 'deleteSettingModal',
};

export const dataAnalysisModalStates = {
  viewModal: 'dataAnalysisViewModal',
  interruptedDataModal: 'interruptedDataModal',
};

export const calendarTaskSettingModalStates = {
  notSetTaskSetting: 'notSetTaskSetting',
  askSaveSetting: 'askSaveSetting',
  saveCompleted: 'saveCompleted',
  savedSettingViewModal: 'savedSettingViewModal',
  discardChanges: 'discardChanges',
  askDelete: 'askDelete',
  deleteCompleted: 'deleteCompleted',
  saveFailed: 'saveFailed',
};

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

export type ApiInfo = {
  /*
  API_KEY: string;
  AUTH_DOMAIN: string;
  DATABASE_URL: string;
  PROJECT_ID: string;
  STORAGE_BUCKET: string;
  MESSAGING_SENDER_ID: string;
  APP_ID: string;
  MEASUREMENT_ID: string;
  IOS_CLIENT_ID: string;
  ANDROID_CLIENT_ID: string;
  REDIRECT_URI: string;
  */
  WEB_CLIENT_ID: string;
};
/* export const taskCalendarcolor = {
  red: 'R',
  redOrange: 'RO',
  orange: 'O',
  yellow: 'Y',
  yellowGreen: 'YG',
  green: 'G',
  blueGreen: 'BG',
  blue: 'B',
  blueViolet: 'BV',
  violet: 'V',
  redViolet: 'RV',
  gray: 'quaternary',
  black: 'secondary',
} as const;
export type TaskCalendarColor = (typeof taskCalendarColor)[keyof typeof taskCalendarColor]; */
