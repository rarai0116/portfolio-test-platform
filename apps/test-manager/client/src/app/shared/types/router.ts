import type { GradeId, TestDataStatus } from '@shared/types/contracts';

export type QuestionEditorLocationState = {
  grade: GradeId;
  idList: Array<{
    no: number;
    name: string;
    status: TestDataStatus;
  }>;
};
