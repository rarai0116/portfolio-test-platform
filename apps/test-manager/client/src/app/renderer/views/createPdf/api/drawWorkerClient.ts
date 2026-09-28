import type { CandidateIndex } from '@views/createPdf/api/candidateIndex';
import type { DrawSlot } from '@views/createPdf/api/drawEngine';
import type { DrawWithValidationResult } from '@views/createPdf/api/drawWithValidation';
import type {
  DrawWorkerInput,
  DrawWorkerOutput,
} from '@views/createPdf/api/drawWorker';
import {
  BFS_WORKER_COST_THRESHOLD,
  estimateBfsCost,
  prepareBfsFeasibility,
} from '@views/createPdf/api/difficultyUtils';
import type { CreatePdfDifficultyDraftState } from '@views/createPdf/types/draftState';
import type { WorkbookMode } from '@views/createPdf/types/viewState';

export type RunDrawWithValidationInWorkerParams = {
  slots: readonly DrawSlot[];
  index: CandidateIndex;
  difficulty: CreatePdfDifficultyDraftState;
  workbookMode?: WorkbookMode;
  maxAttempts?: number;
};

export type DrawWithValidationWorkerTask = {
  promise: Promise<DrawWithValidationResult>;
  terminate: () => void;
};

export const shouldRunDrawInWorker = (params: {
  slots: readonly DrawSlot[];
  index: CandidateIndex;
}): boolean => {
  const phase1 = prepareBfsFeasibility({
    slots: params.slots,
    candidateIndex: params.index,
  });
  const cost = estimateBfsCost(
    phase1.remainingSlotDifficulties.length,
    phase1.remainingCaps,
  );
  return cost >= BFS_WORKER_COST_THRESHOLD;
};

export const runDrawWithValidationInWorker = ({
  slots,
  index,
  difficulty,
  workbookMode,
  maxAttempts,
}: RunDrawWithValidationInWorkerParams): Promise<DrawWithValidationResult> =>
  createDrawWithValidationWorkerTask({
    slots,
    index,
    difficulty,
    workbookMode,
    maxAttempts,
  }).promise;

export const createDrawWithValidationWorkerTask = ({
  slots,
  index,
  difficulty,
  workbookMode,
  maxAttempts,
}: RunDrawWithValidationInWorkerParams): DrawWithValidationWorkerTask => {
  let worker: Worker | null = new Worker(
    new URL('./drawWorker.ts', import.meta.url),
    {
      type: 'module',
    },
  );
  let rejectTask: ((reason?: unknown) => void) | null = null;

  const cleanup = () => {
    worker?.terminate();
    worker = null;
    rejectTask = null;
  };

  const promise = new Promise<DrawWithValidationResult>((resolve, reject) => {
    rejectTask = reject;
    const activeWorker = worker;
    if (activeWorker === null) {
      reject(new Error('drawWorker: worker unavailable'));
      return;
    }

    activeWorker.onmessage = (event: MessageEvent<DrawWorkerOutput>) => {
      if (worker !== activeWorker) return;
      cleanup();
      resolve(event.data);
    };
    activeWorker.onerror = (event) => {
      if (worker !== activeWorker) return;
      cleanup();
      reject(event.error ?? new Error(event.message));
    };
    activeWorker.onmessageerror = () => {
      if (worker !== activeWorker) return;
      cleanup();
      reject(new Error('drawWorker: message cloning failed'));
    };

    const input: DrawWorkerInput = {
      slots: [...slots],
      candidateIndex: index,
      difficulty,
      workbookMode,
      maxAttempts,
    };
    activeWorker.postMessage(input);
  });

  return {
    promise,
    terminate: () => {
      if (worker === null) return;
      const reject = rejectTask;
      cleanup();
      reject?.(new Error('drawWorker: terminated'));
    },
  };
};
