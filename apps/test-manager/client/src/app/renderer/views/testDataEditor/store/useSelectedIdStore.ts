import type { GradeId } from '@shared/types/contracts';
import { create } from 'zustand';

type SelectedIdState = {
  selectedDataIdList: string[];
  setSelectedIdList: (selectedDataIdList: string[]) => void;
  selectedDataId: string | undefined;
  setSelectedDataId: (selectedDataId: string | undefined) => void;
  selectedGrade: GradeId;
  setSelectedGrade: (selectedGrade: GradeId) => void;
};

const useSelectedIdStore = create<SelectedIdState>((set) => ({
  selectedDataIdList: [],
  setSelectedIdList: (selectedDataIdList) => set({ selectedDataIdList }),
  selectedDataId: undefined,
  setSelectedDataId: (selectedDataId) => set({ selectedDataId }),
  selectedGrade: 'firstGrade',
  setSelectedGrade: (selectedGrade) => set({ selectedGrade }),
}));

export default useSelectedIdStore;
