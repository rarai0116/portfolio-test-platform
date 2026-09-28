import IntegerInput from '@components/parts/integerInput';
import { Checkbox } from '@ui/checkbox';
import { useId } from 'react';

type Props = {
  label: string;
  checked: boolean;
  count: number;
  maxCount: number;
  onCheck: () => void;
  onUncheck: () => void;
  onCountChange: (n: number) => void;
};

const WorkbookSmallCategory = ({
  label,
  checked,
  count,
  maxCount,
  onCheck,
  onUncheck,
  onCountChange,
}: Props) => {
  const checkboxId = useId();

  return (
    <div className="w-full flex items-center justify-between text-sm gap-2 flex-wrap">
      <div className="flex items-center gap-2">
        <Checkbox
          id={checkboxId}
          checked={checked}
          onCheckedChange={(v) => (v ? onCheck() : onUncheck())}
        />
        <label htmlFor={checkboxId} className="cursor-pointer">
          {label}
        </label>
      </div>
      <div className="flex items-center gap-2">
        <IntegerInput
          value={count}
          onChange={onCountChange}
          disabled={!checked}
          hasError={checked && (count > maxCount || count < 1)}
          min={1}
          max={maxCount}
        />
        <div className="flex mr-2">
          <span>問 /</span>

          <div className="w-10 flex gap-1 justify-end">
            <span>{maxCount}</span>
            <span>問</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkbookSmallCategory;
