import { generateShuffleSeed } from '@api/shuffleSeed';
import { EMPTY_EXAM_DATE } from '@renderer/api/examDateOption';
import type {
  CreatePdfBasicDraftState,
  CreatePdfCommonOptionDraftState,
  CreatePdfDifficultyDraftState,
  CreatePdfOutputDraftState,
  ExamState,
  ExamStepTwoState,
  WorkbookState,
  WorkbookStepTwoState,
} from '@views/createPdf/types/draftState';

export const createInitialBasicState = (): CreatePdfBasicDraftState => ({
  grade: 1,
  title: '',
  selectedYears: null,
});

export const createInitialOutputState = (): CreatePdfOutputDraftState => ({
  selectedOutputFolder: null,
  includeCover: true,
  excludeMiddleCover: false,
  saveConditionJson: true,
  examDate: EMPTY_EXAM_DATE,
});

export const createInitialCommonOptionState =
  (): CreatePdfCommonOptionDraftState => ({
    excludedTagIds: [],
    excludePastExam: false,
    excludeOriginal: false,
    // デフォルトはシャッフルON・初期シードを生成（executeDraw 時に再生成される）
    isShuffleChoices: true,
    shuffleSeed: generateShuffleSeed(),
  });

export const createInitialDifficultyState =
  (): CreatePdfDifficultyDraftState => ({
    // isEnabled 廃止
    isCalculated: false,
    ratios: [30, 70],
    entityCount: [0, 0, 0],
    settableDifficultyRanges: null, // 計算キャッシュ: calculateDifficulty 呼び出し前は null
  });

export const createInitialWorkbookStepTwoState = (): WorkbookStepTwoState => ({
  workbookMode: 'qaa',
  options: createInitialCommonOptionState(),
  difficulty: createInitialDifficultyState(),
  categoryTable: [],
});

export const createInitialExamStepTwoState = (): ExamStepTwoState => ({
  options: createInitialCommonOptionState(),
  difficulty: createInitialDifficultyState(),
  categoryTable: [],
});

export const createInitialWorkbookState = (): WorkbookState => ({
  basic: createInitialBasicState(),
  stepTwo: createInitialWorkbookStepTwoState(),
  stepThree: createInitialOutputState(),
});

export const createInitialExamState = (): ExamState => ({
  basic: createInitialBasicState(),
  stepTwo: createInitialExamStepTwoState(),
  stepThree: createInitialOutputState(),
});
