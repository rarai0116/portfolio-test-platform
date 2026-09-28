import type { CandidateIndex } from '@views/createPdf/api/candidateIndex';
import {
  type DrawResult,
  type DrawSlot,
  runDrawEngine,
} from '@views/createPdf/api/drawEngine';
import {
  type CreatePdfDrawValidationError,
  validateDrawResult,
} from '@views/createPdf/api/drawResultValidation';
import type { CreatePdfDifficultyDraftState } from '@views/createPdf/types/draftState';
import type { WorkbookMode } from '@views/createPdf/types/viewState';

export const DRAW_WITH_VALIDATION_FAILURE_MESSAGE =
  '指定の条件で抽選に失敗しました。条件を変えて抽選し直してください';

export type DrawWithValidationResult =
  | { ok: true; result: DrawResult; attempts: number }
  | {
      ok: false;
      attempts: number;
      drawError?: DrawResult;
      validationErrors: CreatePdfDrawValidationError[];
      userMessage: string;
    };

type RunDrawWithValidationParams = {
  slots: readonly DrawSlot[];
  index: CandidateIndex;
  difficulty: CreatePdfDifficultyDraftState;
  workbookMode?: WorkbookMode;
  maxAttempts?: number;
};

export const runDrawWithValidation = ({
  slots,
  index,
  difficulty,
  workbookMode,
  maxAttempts = 20,
}: RunDrawWithValidationParams): DrawWithValidationResult => {
  let lastValidationErrors: CreatePdfDrawValidationError[] = [];

  for (let attemptIndex = 1; attemptIndex <= maxAttempts; attemptIndex += 1) {
    const result = runDrawEngine({ slots, index, difficulty });
    if (result.hasError) {
      console.warn(
        'Draw engine error on attempt',
        attemptIndex,
        result.errorRows,
      );
      // engine error は候補構造の破綻なので、再試行しても成功確率は上がらない。
      return {
        ok: false,
        attempts: attemptIndex,
        drawError: result,
        validationErrors: [],
        userMessage: DRAW_WITH_VALIDATION_FAILURE_MESSAGE,
      };
    }

    console.log('Draw engine result on attempt', attemptIndex, result.rows);
    const validationErrors = validateDrawResult({
      slots,
      rows: result.rows,
      testDataByNo: index.allByNo,
      difficulty,
      workbookMode,
    });
    if (validationErrors.length === 0) {
      return { ok: true, result, attempts: attemptIndex };
    }
    lastValidationErrors = validationErrors;
  }

  return {
    ok: false,
    attempts: maxAttempts,
    validationErrors: lastValidationErrors,
    userMessage: DRAW_WITH_VALIDATION_FAILURE_MESSAGE,
  };
};
