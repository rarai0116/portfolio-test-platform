import useWorkbookPanelModel from '@views/createPdf/hooks/useWorkbookPanelModel';
import type { CreatePdfPreviewUpdateAdapter } from '@views/createPdf/types/previewUpdate';
import useWorkbookMockStepTwo from './useWorkbookMockStepTwo';

type UseTempWorkbookPanelModelInput = {
  previewUpdate?: Pick<
    CreatePdfPreviewUpdateAdapter,
    'setGradeChangeDialogOpen'
  >;
};

const useTempWorkbookPanelModel = (input?: UseTempWorkbookPanelModelInput) => {
  const baseModel = useWorkbookPanelModel(input);
  const mockStepTwo = useWorkbookMockStepTwo();

  return {
    ...baseModel,
    stepTwo: mockStepTwo,
  };
};

export default useTempWorkbookPanelModel;
