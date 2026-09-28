import type { TestDataStatus, TestSubject } from '@shared/types/contracts';

export const originalDisplay = {
  true: 'オリジナル',
  false: '本試験',
} as const;

export type OriginalDisplay =
  (typeof originalDisplay)[keyof typeof originalDisplay];

export const autoCheckDisplay = {
  true: '✓',
  false: 'ー',
} as const;

export type AutoCheckDisplay =
  (typeof autoCheckDisplay)[keyof typeof autoCheckDisplay];

export const booleanMarkDisplay = {
  true: '◯',
  false: '×',
} as const;

export type BooleanMarkDisplay =
  (typeof booleanMarkDisplay)[keyof typeof booleanMarkDisplay];

export const answerFormatDisplay = {
  correct: '正答形式',
  incorrect: '誤答形式',
} as const;

export type AnswerFormatDisplay =
  (typeof answerFormatDisplay)[keyof typeof answerFormatDisplay];

export const manualCheckDisplay = {
  lock: 'ロック中',
  unlock: 'ロックなし',
} as const;

export type ManualCheckDisplay =
  (typeof manualCheckDisplay)[keyof typeof manualCheckDisplay];

export type Row = {
  id: string; // ドキュメントのパスをidとして利用
  no: number;
  year: string;
  publicationYear: string;
  publicationNo: string;
  subject: TestSubject;
  bigCategory: string;
  smallCategory: string;
  theme: string;
  otherTags: string[];
  testNo: string;
  status: TestDataStatus;
  original: OriginalDisplay;
  autoCheck: AutoCheckDisplay;
  shuffleable: BooleanMarkDisplay;
  convertibleQaa: BooleanMarkDisplay;
  answerFormat: AnswerFormatDisplay;
  manualCheck: ManualCheckDisplay;
  lastUpdated: string;
};

export const filterKeys = [
  'year',
  'publicationYear',
  'subject',
  'bigCategory',
  'smallCategory',
  'otherTags',
  'original',
  'autoCheck',
  'shuffleable',
  'convertibleQaa',
  'answerFormat',
  'manualCheck',
  'status',
] as const;

export type FilterStateKey = (typeof filterKeys)[number];

export type FilterOptions = Record<FilterStateKey, string[]>;
