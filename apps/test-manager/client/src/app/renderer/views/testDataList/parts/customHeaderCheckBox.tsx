import { Checkbox } from '@ui/checkbox';
import type { Row } from '@views/testDataList/types/reactGridDataTypes';
import { useMemo } from 'react';

export type SelectionMode = 'stopped' | 'notStopped' | null;

const isStoppedStatus = (v: unknown): boolean => v === '停止中';

const deriveModeFromFirstRow = (rows: Row[]): SelectionMode => {
  const first = rows[0];
  if (!first) return null;
  return isStoppedStatus(first.status) ? 'stopped' : 'notStopped';
};

const modeMatchesStatus = (
  status: unknown,
  mode: Exclude<SelectionMode, null>,
): boolean => {
  return mode === 'stopped'
    ? isStoppedStatus(status)
    : !isStoppedStatus(status);
};

const CustomHeaderCheckBox = ({
  rows,
  selectionMode,
  selectedRows,
  setSelectedRows,
}: {
  rows: Row[];
  selectionMode: SelectionMode;
  selectedRows: Set<string>;
  setSelectedRows: (rows: Set<string>) => void;
}) => {
  const mode = useMemo(
    () => selectionMode ?? deriveModeFromFirstRow(rows),
    [selectionMode, rows],
  );

  const targetIds = useMemo(
    () =>
      mode === null
        ? []
        : rows
            .filter((r) => modeMatchesStatus(r.status, mode))
            .map((r) => r.id),
    [mode, rows],
  );

  const selectedCount = useMemo(
    () => targetIds.filter((id) => selectedRows.has(id)).length,
    [targetIds, selectedRows],
  );

  const checked = useMemo(() => {
    if (targetIds.length === 0) return false;
    if (selectedCount === targetIds.length) return true;
    if (selectedCount > 0) return 'indeterminate';
    return false;
  }, [targetIds.length, selectedCount]);

  return (
    <Checkbox
      className="mt-1"
      aria-label="表示中の一致する行だけ全選択"
      checked={checked}
      onCheckedChange={(nextChecked) => {
        const shouldCheck = nextChecked === true;
        if (mode === null) return;

        if (shouldCheck) {
          setSelectedRows(new Set(targetIds));
        } else {
          setSelectedRows(new Set());
        }
      }}
    />
  );
};

export default CustomHeaderCheckBox;
