import {Timestamp} from '@react-native-firebase/firestore';
import type {
  TestData,
  TestPlayData,
} from '../../components/hooks/useGlobalSaveDataContext';
import {questionMode} from '../../types/commonUnionType';

const answersByNo: Record<number, string> = {
  28: '3',
  29: '4',
  30: '2',
  31: '4',
};

export const makeResumeQuestions = (): TestData[] =>
  Array.from({length: 32}, (_, no) => {
    return {
      no,
      answer: answersByNo[no] ?? '1',
      ch1: 'choice 1',
      ch2: 'choice 2',
      ch3: 'choice 3',
      ch4: 'choice 4',
      ch5: 'choice 5',
      answerText1: 'answer 1',
      answerText2: 'answer 2',
      answerText3: 'answer 3',
      answerText4: 'answer 4',
      answerText5: 'answer 5',
      subject: 'subject',
      nengo: 'R',
      year: '2026',
      testNo: String(no),
      grade: 1,
    } as TestData;
  });

export const makeResumePlayData = (
  overrides: Partial<TestPlayData> = {},
): TestPlayData => ({
  testId: 'resume-test',
  baseSeed: 56_453,
  testDataNoList: [30, 31, 28, 29],
  answerList: [2, 4, 3, 4],
  selectedAnswerList: [2, 2, 2, 4],
  currentPlayNo: 0,
  isFinished: false,
  correctAnswerCount: 0,
  questionCount: 4,
  durationTime: 0,
  durationTimePerAnswer: [],
  limitTime: 0,
  startAt: Timestamp.now(),
  endAt: null,
  settingCardData: {
    id: 'setting',
    grade: '1級',
    isQaa: false,
    questionMode: questionMode.practice,
    practiceQuestionSetting: {
      questionCategory: [],
      qaaQuestionCategory: [],
    },
    examQuestionSetting: {},
    settingState: '初期設定',
  } as unknown as TestPlayData['settingCardData'],
  ...overrides,
});
