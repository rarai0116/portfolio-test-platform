import type { BasicSingleCreatableSelectOption } from '@components/organism/basicSingleCreatableSelect';
import type { TestSubject } from '@shared/types/contracts';
import type { UseExamStepTwoOutput } from '@views/createPdf/hooks/useExamStepTwo';
import type { UseTestYearsOutput } from '@views/createPdf/hooks/useTestYears';
import type { UseWorkbookStepTwoOutput } from '@views/createPdf/hooks/useWorkbookStepTwo';
import type {
  CreatePdfBasicDraftState,
  CreatePdfOutputDraftState,
} from './draftState';
import type { CreatePdfPreviewHealth, WorkbookMode } from './viewState';

export type ResetPanelTarget =
  | 'title'
  | 'selectedYears'
  | 'options'
  | 'difficulty'
  | 'category'
  | 'testTable'
  | 'stepThree'
  | 'preview';

export type ResetPanelOptions = {
  grade?: 1 | 2;
  workbookMode?: WorkbookMode;
};

export type ExamSubjectForUI = {
  id: string;
  label: TestSubject;
  count: number;
};

export type CreatePdfStepOneAdapter = {
  basic: CreatePdfBasicDraftState;
  output: CreatePdfOutputDraftState;
  onTitleChange: (value: string) => void;
  onRequestGradeChange: (value: 1 | 2) => void;
  onRequestReset: () => void;
  yearFilter: UseTestYearsOutput;
};

export type CreatePdfExamStepTwoAdapter = UseExamStepTwoOutput & {
  tagOptions: BasicSingleCreatableSelectOption[];
  subjectsForUi: ExamSubjectForUI[];
};

export type CreatePdfWorkbookStepTwoAdapter = UseWorkbookStepTwoOutput & {
  tagOptions: BasicSingleCreatableSelectOption[];
  selectedSubject: TestSubject | null;
  onSubjectChange: (value: TestSubject) => void;
};

export type CreatePdfStepThreeAdapter = {
  output: CreatePdfOutputDraftState;
  previewHealth: CreatePdfPreviewHealth;
  /** 問題テーブルが最後の保存/復元から変更されているかどうか */
  hasUnsavedTableChanges: boolean;
  canExport: boolean;
  onOutputChange: (patch: Partial<CreatePdfOutputDraftState>) => void;
};
