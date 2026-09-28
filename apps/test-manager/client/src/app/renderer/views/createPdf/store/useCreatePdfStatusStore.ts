import type { CreatePdfUserStatusSnapshot } from '@views/createPdf/types/statusState';
import { create } from 'zustand';

const INITIAL_STATUS_SNAPSHOT: CreatePdfUserStatusSnapshot = {
  exportStatus: {
    kind: 'blocked',
    canExport: false,
    blockingReasons: [],
    warningReasons: [],
  },
  previewStatus: {
    kind: 'not-updated',
    canUseForExport: false,
    reasons: [],
    issues: [],
  },
  drawStatus: {
    kind: 'blocked',
    canDraw: false,
    blockingReasons: [],
  },
  drawConditionChangeStatus: {
    kind: 'not-drawn',
    hasUnappliedDrawConditions: false,
    currentDrawConditionKey: null,
    lastAppliedDrawConditionKey: null,
  },
  meta: {
    computedAt: 0,
    creationType: 'exam',
    slotKey: '',
    sourceRevision: '',
  },
};

type CreatePdfStatusStore = CreatePdfUserStatusSnapshot & {
  actions: {
    /** status store への書き込み口。呼び出しは useCreatePdfStatusController に限定する。 */
    replaceSnapshot: (snapshot: CreatePdfUserStatusSnapshot) => void;
    reset: () => void;
  };
};

const useCreatePdfStatusStore = create<CreatePdfStatusStore>((set) => ({
  ...INITIAL_STATUS_SNAPSHOT,
  actions: {
    replaceSnapshot: (snapshot) => set(snapshot),
    reset: () => set(INITIAL_STATUS_SNAPSHOT),
  },
}));

export default useCreatePdfStatusStore;
