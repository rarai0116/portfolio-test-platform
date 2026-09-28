/// <reference lib="webworker" />

import type { CandidateIndex } from '@views/createPdf/api/candidateIndex';
import type { DrawSlot } from '@views/createPdf/api/drawEngine';
import {
  type DrawWithValidationResult,
  runDrawWithValidation,
} from '@views/createPdf/api/drawWithValidation';
import type { CreatePdfDifficultyDraftState } from '@views/createPdf/types/draftState';
import type { WorkbookMode } from '@views/createPdf/types/viewState';

export type DrawWorkerInput = {
  slots: DrawSlot[];
  candidateIndex: CandidateIndex;
  difficulty: CreatePdfDifficultyDraftState;
  workbookMode?: WorkbookMode;
  maxAttempts?: number;
};

export type DrawWorkerOutput = DrawWithValidationResult;

self.onmessage = (event: MessageEvent<DrawWorkerInput>) => {
  const { slots, candidateIndex, difficulty, workbookMode, maxAttempts } =
    event.data;

  const output: DrawWorkerOutput = runDrawWithValidation({
    slots,
    index: candidateIndex,
    difficulty,
    workbookMode,
    maxAttempts,
  });

  self.postMessage(output);
};
