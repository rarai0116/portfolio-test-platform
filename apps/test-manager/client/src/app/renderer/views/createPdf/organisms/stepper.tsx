import { cn } from '@renderer/api/utils';

type StepItem = {
  label: string;
};

type StepperProps = {
  steps: StepItem[];
  currentStep: number; // 1始まり
};

const Stepper = ({ steps, currentStep }: StepperProps) => {
  return (
    <div className="w-full flex bg-background items-center">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;

        return (
          <div key={stepNumber} className="flex">
            <div className="flex gap-1 items-center">
              <div
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-xs',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-muted-foreground',
                )}
              >
                {stepNumber}
              </div>
              <div
                className={cn(
                  'text-xs',
                  isActive ? ' text-foreground' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </div>
            </div>
            {index < steps.length - 1 && (
              // mt-2: circle 高さ(h-4=16px)の中央に合わせる
              <div className="mx-2 mt-2 h-0.5 w-8 shrink-0 bg-border" />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Stepper;
