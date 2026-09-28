import { Button } from '@renderer/components/ui/button';

type Props = {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  isDisabled: boolean;
};

const StepperButtons = ({ currentStep, setCurrentStep, isDisabled }: Props) => {
  return (
    <div className="flex gap-3">
      {currentStep !== 1 ? (
        <Button
          size="sm"
          variant="outline"
          className="w-10"
          onClick={() => setCurrentStep(currentStep - 1)}
        >
          前へ
        </Button>
      ) : (
        <Button
          size="sm"
          className="w-10"
          variant="primary"
          onClick={() => setCurrentStep(currentStep + 1)}
          disabled={isDisabled}
        >
          次へ
        </Button>
      )}
    </div>
  );
};

export default StepperButtons;
