import {
  type AnswerFormatDisplay,
  answerFormatDisplay,
} from '@views/testDataList/types/reactGridDataTypes';
import { memo } from 'react';

type Props = {
  value: AnswerFormatDisplay;
};

const AnswerFormatPill = memo(({ value }: Props) => {
  const isIncorrect = value === answerFormatDisplay.incorrect;

  return (
    <span
      className={[
        'inline-flex items-center justify-center rounded-full px-2 py-1 text-xs font-medium text-nowrap',
        isIncorrect
          ? 'bg-secondary text-secondary-foreground'
          : 'bg-success-bg text-success-text',
      ].join(' ')}
    >
      {value}
    </span>
  );
});

AnswerFormatPill.displayName = 'AnswerFormatPill';

export default AnswerFormatPill;
