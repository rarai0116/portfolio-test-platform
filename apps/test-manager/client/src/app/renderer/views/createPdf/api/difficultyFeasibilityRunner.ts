import { serializePreparedDifficultyAssignmentInput } from '@views/createPdf/api/difficultyAssignment';
import {
  assembleDifficultyFeasibility,
  assembleDifficultyFeasibilityFromWorker,
  BFS_WORKER_COST_THRESHOLD,
  type BfsFeasibilityPhase1,
  type BfsWorkerOutput,
  type DifficultyFeasibility,
  estimateBfsCost,
  runBfsFeasibility,
} from '@views/createPdf/api/difficultyUtils';
import type { DrawSlot } from '@views/createPdf/api/drawEngine';

export type RunDifficultyFeasibilityResult = {
  feasibility: DifficultyFeasibility;
  usedWorker: boolean;
};

export type DifficultyFeasibilityTask = {
  promise: Promise<RunDifficultyFeasibilityResult>;
  terminate: () => void;
  usedWorker: boolean;
};

export const createFixedDrawSlotsSignature = (
  slots: readonly DrawSlot[],
): string =>
  JSON.stringify(
    slots.map((slot, index) => ({
      index,
      sourceConditionId: slot.sourceConditionId,
      subject: slot.subject,
      conditions: slot.conditions.map((condition) => ({
        big: condition.big,
        small: condition.small,
      })),
      fixedNo: slot.fixedNo,
      fixedChoiceIndex: slot.fixedChoiceIndex,
    })),
  );

export const shouldRunDifficultyFeasibilityInWorker = (
  phase1: Pick<
    BfsFeasibilityPhase1,
    'remainingSlotDifficulties' | 'remainingCaps'
  >,
): boolean => {
  const cost = estimateBfsCost(
    phase1.remainingSlotDifficulties.length,
    phase1.remainingCaps,
  );
  return cost >= BFS_WORKER_COST_THRESHOLD;
};

export const createDifficultyFeasibilityTask = (
  phase1: BfsFeasibilityPhase1,
): DifficultyFeasibilityTask => {
  if (!shouldRunDifficultyFeasibilityInWorker(phase1)) {
    const states = runBfsFeasibility(phase1);
    const feasibility = assembleDifficultyFeasibility(phase1, states);
    return {
      promise: Promise.resolve({ feasibility, usedWorker: false }),
      terminate: () => undefined,
      usedWorker: false,
    };
  }

  let worker: Worker | null = new Worker(
    new URL('./difficultyFeasibilityWorker.ts', import.meta.url),
    { type: 'module' },
  );
  let rejectTask: ((reason?: unknown) => void) | null = null;

  const cleanup = () => {
    worker?.terminate();
    worker = null;
    rejectTask = null;
  };

  const promise = new Promise<RunDifficultyFeasibilityResult>(
    (resolve, reject) => {
      rejectTask = reject;
      const activeWorker = worker;
      if (activeWorker === null) {
        reject(new Error('difficultyFeasibilityRunner: worker unavailable'));
        return;
      }

      activeWorker.onmessage = (event: MessageEvent<BfsWorkerOutput>) => {
        if (worker !== activeWorker) return;
        const feasibility = assembleDifficultyFeasibilityFromWorker(
          phase1,
          event.data,
        );
        cleanup();
        resolve({ feasibility, usedWorker: true });
      };
      activeWorker.onerror = (event) => {
        if (worker !== activeWorker) return;
        cleanup();
        reject(event.error ?? new Error(event.message));
      };
      activeWorker.onmessageerror = () => {
        if (worker !== activeWorker) return;
        cleanup();
        reject(
          new Error('difficultyFeasibilityRunner: message cloning failed'),
        );
      };

      activeWorker.postMessage({
        remainingSlotDifficulties: phase1.remainingSlotDifficulties.map((s) => [
          ...s,
        ]),
        remainingCaps: phase1.remainingCaps,
        fixedCounts: phase1.fixedCounts,
        totalCount: phase1.totalCount,
        ...serializePreparedDifficultyAssignmentInput(phase1.assignmentInput),
      });
    },
  );

  return {
    promise,
    usedWorker: true,
    terminate: () => {
      if (worker === null) return;
      const reject = rejectTask;
      cleanup();
      reject?.(new Error('difficultyFeasibilityRunner: terminated'));
    },
  };
};
