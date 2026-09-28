import CheckIcon from '@components/icons/checkIcon';
import {
  type AutoCheckDisplay,
  autoCheckDisplay,
} from '@views/testDataList/types/reactGridDataTypes';
import { memo } from 'react';

type Props = {
  value: AutoCheckDisplay;
};

const AutoCheckPill = memo(({ value }: Props) => {
  const isChecked = value === autoCheckDisplay.true;

  return (
    <div className="flex items-center justify-center">
      {isChecked ? (
        <CheckIcon fill="var(--color-success-icon)" size={20} />
      ) : (
        <span className="text-base leading-none text-foreground">
          {autoCheckDisplay.false}
        </span>
      )}
    </div>
  );
});

AutoCheckPill.displayName = 'AutoCheckPill';

export default AutoCheckPill;
