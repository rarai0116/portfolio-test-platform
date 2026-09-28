import type {
  ExamState,
  WorkbookState,
} from '@views/createPdf/types/draftState';
import {
  createInitialDifficultyState,
  createInitialExamStepTwoState,
  createInitialWorkbookStepTwoState,
} from './createPdfDraftFactory';

/**
 * 仕様書「級変更時の挙動」に準拠した workbook リセット純粋関数。
 * 保持: タイトル、出力先、問題形式、オプション
 * 初期化: 出題年、難易度、カテゴリ条件（問題テーブルは useTestTableStore で管理）
 */
export const resetWorkbookForGradeChange = (
  current: WorkbookState,
  nextGrade: 1 | 2,
  selectedYears: string[] | null,
): WorkbookState => {
  return {
    ...current,
    basic: { ...current.basic, grade: nextGrade, selectedYears },
    stepTwo: {
      ...createInitialWorkbookStepTwoState(),
      workbookMode: current.stepTwo.workbookMode,
      options: current.stepTwo.options,
      difficulty: createInitialDifficultyState(),
    },
    stepThree: current.stepThree,
  };
};

/**
 * 仕様書「級変更時の挙動」に準拠した exam リセット純粋関数。
 * 保持: タイトル、出力先、オプション
 * 初期化: 出題年、難易度、枠条件（問題テーブルは useTestTableStore で管理）
 */
export const resetExamForGradeChange = (
  current: ExamState,
  nextGrade: 1 | 2,
  selectedYears: string[] | null,
): ExamState => {
  return {
    ...current,
    basic: { ...current.basic, grade: nextGrade, selectedYears },
    stepTwo: {
      ...createInitialExamStepTwoState(),
      options: current.stepTwo.options,
    },
    stepThree: current.stepThree,
  };
};
