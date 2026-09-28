import Constants from 'expo-constants';
import {Timestamp} from '@react-native-firebase/firestore';
import type * as FirebaseFirestoreTypes from '@react-native-firebase/firestore';
import {
  questionGrade,
  questionMode,
  questionSettingState,
  individualMessageSender,
  messageSender,
} from '../../types/commonUnionType';
import type {
  TestData,
  SettingCardDataMap,
  MessageCardDataMap,
  TestPlayData,
} from '../hooks/useGlobalSaveDataContext';

type SmallCategoryData = Record<string, TestData[]>;
type BigCategoryData = Record<string, SmallCategoryData>;
type CategoryData = Record<string, BigCategoryData>;

export const testDataExample: TestData[] = Constants.expoConfig?.extra
  ?.SECOND_GRADE_DATA as TestData[];

export const CategoryDataExample: CategoryData = {
  学科Ⅰ: {
    作品関連: {
      作品関連保存再生: [],
      都市関連作品: [],
      hogehoge: [],
    },
    建築生産マネジメント: {
      なし: [],
    },
    建築計画: {
      学校教育社会教育施設: [],
      建築士の職責建築設計の手法等: [],
    },
  },
  学科Ⅱ: {
    環境工学: {
      換気: [],
    },
    建築設備: {
      空気調和設備: [],
    },
  },
  学科Ⅲ: {
    建築基準法: {
      用語の定義: [],
    },
  },
  学科Ⅳ: {
    各種構造: {
      荷重外力: [],
    },
    建築材料: {
      木材: [],
    },
  },
  学科Ⅴ: {
    施工計画他: {
      なし: [],
    },
  },
};

// 前回設定したダミーデータ
/** id名: previous-(practice/exam)-number */
export const previousSavedSettingDummyData: SettingCardDataMap = {
  'previous-practice-0': {
    id: 'previous-practice-0',
    title: '前回の設定',
    grade: questionGrade.gradeTwo,
    settingState: questionSettingState.previous,
    questionMode: questionMode.practice,
    practiceQuestionSetting: {
      questionCategory: [
        'small-学科Ⅱ-建築基準法-用語の定義',
        'small-学科Ⅱ-建築基準法-一般構造',
      ],
      qaaQuestionCategory: [],
      questionFormat: ['pqs_questionFormat_qAndA'],
      questionOrder: ['pqs_questionOrder_random'],
      questionDifficulties: ['pqs_questionDifficulties_one'],
      questionCoverage: ['pqs_questionCoverage_all'],
      option: ['pqs_option_shuffleChoices'],
      numberOfQuestions: ['pqs_numberOfQuestions_10'],
      questionTime: ['pqs_questionTime_10'],
    },
    isQaa: false,
    examQuestionSetting: {
      subject: [],
      numberOfQuestions: [],
    },
  },
};

// 中断したダミーデータ
/** id名: interrupted-(practice/exam)-number */
export const interruptedSavedSettingDummyData: TestPlayData = (() => {
  return {
    testId: '',
    testDataNoList: [1, 5, 10, 12, 16, 20],
    answerList: [1, 2, 3, 4, 5, 1],
    selectedAnswerList: [1, 2, 3, 0, 0, 0],
    currentPlayNo: 4,
    isFinished: false,
    correctAnswerCount: 3,
    durationTimePerAnswer: [1000, 2000, 3000, 4000, 5000, 6000],
    questionCount: 6,
    durationTime: 300_000,
    limitTime: 360_000,
    startAt: Timestamp.fromDate(new Date('2021-09-01T00:00:00.000Z')),
    endAt: undefined,
    settingCardData: {
      id: 'interrupted-practice-0',
      grade: questionGrade.gradeTwo,
      settingState: questionSettingState.interrupted,
      questionMode: questionMode.practice,
      practiceQuestionSetting: {
        questionCategory: [
          'big-学科Ⅰ-計画原論',
          'small-学科Ⅰ-計画原論-光',
          'small-学科Ⅰ-計画原論-気候・空気',
          'small-学科Ⅰ-計画原論-熱',
          'small-学科Ⅰ-計画原論-環境工学全般',
          'small-学科Ⅰ-計画原論-用語・単位',
          'small-学科Ⅰ-計画原論-色彩',
          'small-学科Ⅰ-計画原論-音',
        ],
        qaaQuestionCategory: [],
        questionFormat: ['pqs_questionFormat_qAndA'],
        questionOrder: ['pqs_questionOrder_random'],
        questionDifficulties: ['pqs_questionDifficulties_one'],
        questionCoverage: ['pqs_questionCoverage_all'],
        option: ['pqs_option_shuffleChoices'],
        numberOfQuestions: ['pqs_numberOfQuestions_10'],
        questionTime: ['pqs_questionTime_10'],
      },
      examQuestionSetting: {
        subject: [],
        numberOfQuestions: [],
      },
      isQaa: false,
    },
  };
})();

// 保存した設定のダミーデータ
/** id名: saved-(practice/exam)-number */
export const savedSettingDummyData: SettingCardDataMap = {
  'saved-practice-0': {
    id: 'saved-practice-0',
    title: '保存した設定・練習0',
    grade: questionGrade.gradeTwo,
    settingState: questionSettingState.saved,
    questionMode: questionMode.practice,
    practiceQuestionSetting: {
      questionCategory: [
        'big-学科Ⅰ-計画原論',
        'small-学科Ⅰ-計画原論-光',
        'small-学科Ⅰ-計画原論-気候・空気',
        'small-学科Ⅰ-計画原論-熱',
        'small-学科Ⅰ-計画原論-環境工学全般',
        'small-学科Ⅰ-計画原論-用語・単位',
        'small-学科Ⅰ-計画原論-色彩',
        'small-学科Ⅰ-計画原論-音',
      ],
      qaaQuestionCategory: [],
      questionFormat: ['pqs_questionFormat_qAndA'],
      questionOrder: ['pqs_questionOrder_random'],
      questionDifficulties: ['pqs_questionDifficulties_one'],
      questionCoverage: ['pqs_questionCoverage_all'],
      option: ['pqs_option_shuffleChoices'],
      numberOfQuestions: ['pqs_numberOfQuestions_10'],
      questionTime: ['pqs_questionTime_10'],
    },
    isQaa: false,
    examQuestionSetting: {
      subject: [],
      numberOfQuestions: [],
    },
  },
  'saved-practice-1': {
    id: 'saved-practice-1',
    title: '保存した設定・練習1',
    grade: questionGrade.gradeTwo,
    settingState: questionSettingState.saved,
    questionMode: questionMode.practice,
    practiceQuestionSetting: {
      questionCategory: [
        'small-学科Ⅰ-計画原論-気候・空気',
        'small-学科Ⅰ-計画原論-熱',
        'small-学科Ⅰ-計画原論-環境工学全般',
        'small-学科Ⅰ-計画原論-用語・単位',
        'small-学科Ⅰ-計画原論-色彩',
        'small-学科Ⅰ-計画原論-音',
      ],
      qaaQuestionCategory: [],
      questionFormat: ['pqs_questionFormat_qAndA'],
      questionOrder: ['pqs_questionOrder_inOrder'],
      questionDifficulties: ['pqs_questionDifficulties_one'],
      questionCoverage: ['pqs_questionCoverage_all'],
      option: ['pqs_option_shuffleChoices'],
      numberOfQuestions: ['pqs_numberOfQuestions_30'],
      questionTime: ['pqs_questionTime_20'],
    },
    isQaa: false,
    examQuestionSetting: {
      subject: [],
      numberOfQuestions: [],
    },
  },
  'saved-exam-0': {
    id: 'saved-exam-0',
    title: '保存した設定・模擬試験0',
    grade: questionGrade.gradeTwo,
    settingState: questionSettingState.saved,
    questionMode: questionMode.exam,
    practiceQuestionSetting: {
      questionCategory: [],
      qaaQuestionCategory: [],
      questionFormat: [],
      questionOrder: [],
      questionDifficulties: [],
      questionCoverage: [],
      option: [],
      numberOfQuestions: [],
      questionTime: [],
    },
    isQaa: false,
    examQuestionSetting: {
      subject: ['eqs_2級_subjectOneTwo'],
      numberOfQuestions: ['eqs_2級_subjectOneTwo_NumberOfQuestions_half'],
    },
  },
  'saved-exam-1': {
    id: 'saved-exam-1',
    title: '保存した設定・模擬試験1',
    grade: questionGrade.gradeTwo,
    settingState: questionSettingState.saved,
    questionMode: questionMode.exam,
    practiceQuestionSetting: {
      questionCategory: [],
      qaaQuestionCategory: [],
      questionFormat: [],
      questionOrder: [],
      questionDifficulties: [],
      questionCoverage: [],
      option: [],
      numberOfQuestions: [],
      questionTime: [],
    },
    isQaa: false,
    examQuestionSetting: {
      subject: ['eqs_2級_subjectOneTwo'],
      numberOfQuestions: ['eqs_2級_subjectOneTwo_NumberOfQuestions_full'],
    },
  },
};

/** ↑ここまではつなぎ込み対応済↑ */

// データ分析のダミーデータ
// 総合成績：円グラフ
export const dataAnalysisHomeDummyData = {
  multipleChoice: {
    totalSolvedQuestions: 2000,
    pieChartData: [
      {
        name: '正解',
        numberOfQuestions: 600,
      },
      {
        name: '苦手',
        numberOfQuestions: 100,
      },
      {
        name: '未回答',
        numberOfQuestions: 300,
      },
    ],
  },
  qAndA: {
    totalSolvedQuestions: 800,
    pieChartData: [
      {
        name: '正解',
        numberOfQuestions: 1800,
      },
      {
        name: '苦手',
        numberOfQuestions: 200,
      },
      {
        name: '未回答',
        numberOfQuestions: 100,
      },
    ],
  },
};
// 総合成績：レーダーチャート

// カテゴリ成績
export const dataAnalysisRaderChartGradeOneDummyData = {
  user: {計画: 0.7, 環境設備: 1, 法規: 0.9, 構造: 0.67, 施工: 0.8},
  goal: {計画: 0.2, 環境設備: 0.5, 法規: 0.8, 構造: 0.7, 施工: 0.6},
};

export const dataAnalysisRaderChartGradTwoDummyData = {
  // 0~1
  user: {計画: 0.7, 法規: 0.9, 構造: 0.67, 施工: 0.8},
  goal: {計画: 0.2, 法規: 0.8, 構造: 0.7, 施工: 0.6},
};

export const dataAnalysisCategoryDummyData = {
  'subject-学科Ⅰ': {
    id: 'subject-学科Ⅰ',
    multipleChoice: [120, 0, 0],
    qAndA: [100, 120, 50],
  },
  'big-学科Ⅰ-作品関連': {
    id: 'big-学科Ⅰ-作品関連',
    multipleChoice: [120, 0, 0],
    qAndA: [100, 120, 50],
  },
  'small-学科Ⅰ-作品関連-作品関連保存再生': {
    id: 'small-学科Ⅰ-作品関連-作品関連保存再生',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },

  'small-学科Ⅰ-作品関連-都市関連作品': {
    id: 'small-学科Ⅰ-作品関連-都市関連作品',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },
  'small-学科Ⅰ-作品関連-hogehoge': {
    id: 'small-学科Ⅰ-作品関連-hogehoge',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },
  'big-学科Ⅰ-建築生産マネジメント': {
    id: 'big-学科Ⅰ-建築生産マネジメント',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },
  'small-学科Ⅰ-建築生産マネジメント-なし': {
    id: 'small-学科Ⅰ-建築生産マネジメント-なし',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },
  'big-学科Ⅰ-建築計画': {
    id: 'big-学科Ⅰ-建築計画',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },
  'small-学科Ⅰ-建築計画-学校教育社会教育施設': {
    id: 'small-学科Ⅰ-建築計画-学校教育社会教育施設',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },
  'small-学科Ⅰ-建築計画-建築士の職責建築設計の手法等': {
    id: 'small-学科Ⅰ-建築計画-建築士の職責建築設計の手法等',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },

  'subject-学科Ⅱ': {
    id: 'subject-学科Ⅱ',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },
  'big-学科Ⅱ-環境工学': {
    id: 'big-学科Ⅱ-環境工学',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },
  'small-学科Ⅱ-環境工学-換気': {
    id: 'small-学科Ⅱ-環境工学-換気',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },

  'big-学科Ⅱ-建築設備': {
    id: 'big-学科Ⅱ-建築設備',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },
  'small-学科Ⅱ-建築設備-空気調和設備': {
    id: 'small-学科Ⅱ-建築設備-空気調和設備',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },
  'subject-学科Ⅲ': {
    id: 'subject-学科Ⅲ',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },

  'big-学科Ⅲ-建築基準法': {
    id: 'big-学科Ⅲ-建築基準法',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },
  'small-学科Ⅲ-建築基準法-用語の定義': {
    id: 'small-学科Ⅲ-建築基準法-用語の定義',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },
  'subject-学科Ⅳ': {
    id: 'subject-学科Ⅳ',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },
  'big-学科Ⅳ-各種構造': {
    id: 'big-学科Ⅳ-各種構造',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },
  'small-学科Ⅳ-各種構造-荷重外力': {
    id: 'small-学科Ⅳ-各種構造-荷重外力',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },
  'big-学科Ⅳ-建築材料': {
    id: 'big-学科Ⅳ-建築材料',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },

  'small-学科Ⅳ-建築材料-木材': {
    id: 'small-学科Ⅳ-建築材料-木材',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },
  'subject-学科Ⅴ': {
    id: 'subject-学科Ⅴ',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },
  'big-学科Ⅴ-施工計画他': {
    id: 'big-学科Ⅴ-施工計画他',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },
  'small-学科Ⅴ-施工計画他-なし': {
    id: 'small-学科Ⅴ-施工計画他-なし',
    multipleChoice: [120, 0, 0],
    qAndA: [120, 120, 50],
  },
};

// 学習時間
export const studyHoursDummyData = {
  consecutiveStudyDays: 7,
  todaysStudyHours: 2_000_000,
  totalStudyDays: 25,
  totalStudyHours: 100_000_000,
};

// 今日を含む7日間の学習時間
export const sevenDaysStudyHoursDummyData: Array<
  [FirebaseFirestoreTypes.Timestamp, number]
> = (() => {
  const _d: Array<[Date, number]> = [
    [new Date('2023-07-03T00:00:00'), 1_000_000],
    [new Date('2023-07-04T00:00:00'), 2_000_000],
    [new Date('2023-07-05T00:00:00'), 2_000_000],
    [new Date('2023-07-06T00:00:00'), 3_000_000],
    [new Date('2023-07-07T00:00:00'), 3_000_000],
    [new Date('2023-07-08T00:00:00'), 3_000_000],
    [new Date('2023-07-09T00:00:00'), 2_000_000],
  ];
  return _d.map(([date, hours]) => [Timestamp.fromDate(date), hours]);
})();

// メッセージのダミーデータ
/** id名: message-(app/teacher)-number */
export const messageDummyData: MessageCardDataMap = (() => {
  return {
    'message-app-0': {
      id: 'message-app-0',
      isOpen: true,
      sender: individualMessageSender.app,
      senderType: messageSender.app,
      date: Timestamp.fromDate(new Date('2023-06-01T03:24:00')),
      title: 'アプリからのお知らせ',
      content:
        'この文章はダミーです。文字の大きさ、量、字間、行間等を確認するために入れています。この文章はダミーです。文字の大きさ、量、字間、行間等を確認するために入れています。この文章はダミーです。文字の大きさ、量、字間、行間等を確認するために入れています。この文章はダミーです。文字の大きさ、量、字間、行間等を確認するために入れています。この文章はダミーです。文字の大きさ、量、字間、行間等を確認するために入れています。',
    },
    'message-teacher-1': {
      id: 'message-teacher-1',
      isOpen: true,
      linkedTaskId: 'task-practice-7',
      sender: individualMessageSender.teacher,
      senderType: messageSender.teacher,
      date: Timestamp.fromDate(new Date('2023-05-01T23:59:00')),
      title: '課題',
      content:
        '今週末までの課題を追加しました。提出期限は金曜日の23時59分までです',
    },
    'message-teacher-2': {
      id: 'message-teacher-2',
      sender: individualMessageSender.teacher,
      senderType: messageSender.teacher,
      isOpen: false,
      linkedTaskId: 'task-exam-1',
      date: Timestamp.fromDate(new Date('2023-05-01T23:59:00')),
      title: '課題',
      content:
        '今週末までの課題を追加しました。提出期限は金曜日の23時59分までです',
    },
  };
})();
