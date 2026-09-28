import { Checkbox } from '@ui/checkbox';
import { useRowSelection } from 'react-data-grid';

function CustomCheckBox<R extends Record<string, unknown>>({
  row,
  isDisabled,
}: {
  row: R;
  isDisabled?: boolean;
}) {
  const { isRowSelected, onRowSelectionChange } = useRowSelection();
  const disabled = Boolean(isDisabled) && !isRowSelected;

  return (
    <Checkbox
      className="mt-1"
      aria-label="行を選択"
      checked={Boolean(isRowSelected)}
      disabled={disabled}
      onCheckedChange={(checked) => {
        if (disabled) return;
        onRowSelectionChange({
          row,
          checked: Boolean(checked),
          isShiftClick: false,
        });
      }}
    />
  );
}

export default CustomCheckBox;
