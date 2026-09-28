import { RadioGroup, RadioGroupItem } from '@renderer/components/ui/radioGroup';
import type { WorkbookMode } from '@views/createPdf/types/viewState';
import { useId } from 'react';

type Props = {
  workbookMode: WorkbookMode;
  setWorkbookMode: (value: WorkbookMode) => void;
};

const WorkbookQuestionFormat = ({ workbookMode, setWorkbookMode }: Props) => {
  const qaaId = useId();
  const qaaAllTrueId = useId();
  const qaaAllFalseId = useId();
  const multipleChoiceId = useId();

  return (
    <div className="flex flex-col gap-3">
      <div className="text-base font-medium">問題形式</div>
      <div className="flex flex-col gap-3 px-2">
        <fieldset className="space-y-2">
          <legend className="sr-only">問題形式</legend>
          <RadioGroup
            className="space-y-2"
            value={workbookMode}
            onValueChange={(v) => setWorkbookMode(v as WorkbookMode)}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="qaa" id={qaaId} />
              <label htmlFor={qaaId} className="cursor-pointer text-sm">
                一問一答
              </label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="qaaAllTrue" id={qaaAllTrueId} />
              <label htmlFor={qaaAllTrueId} className="cursor-pointer text-sm">
                一問一答（全て◯）
              </label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="qaaAllFalse" id={qaaAllFalseId} />
              <label htmlFor={qaaAllFalseId} className="cursor-pointer text-sm">
                一問一答（全て×）
              </label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="multipleChoice" id={multipleChoiceId} />
              <label
                htmlFor={multipleChoiceId}
                className="cursor-pointer text-sm"
              >
                選択問題
              </label>
            </div>
          </RadioGroup>
        </fieldset>
      </div>
    </div>
  );
};

export default WorkbookQuestionFormat;
