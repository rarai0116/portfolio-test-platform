import type { TestDataStatus } from '@shared/types/contracts';

export const getSelectedDataTextClassName = (
  status: TestDataStatus,
): string => {
  if (status === 'エラー') return 'text-error-text';
  return '';
};
