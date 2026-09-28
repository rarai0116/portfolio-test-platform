import { createUid } from '@api/utils';
import { Checkbox } from '@renderer/components/ui/checkbox';
import { formatYearLabelWithSeireki } from '@views/createPdf/api/yearFilterUtils';
import { useCallback, useId, useMemo } from 'react';

/** 「直近N年」ショートカットの件数。useTestYears の DEFAULT_DISPLAY_LIMIT と一致させる */
const RECENT_YEAR_LIMIT = 11;

type ExamYearFilterProps = {
  sortedLabels: string[];
  /** effectiveSelectedYears が渡される。null = 全年対象（全件チェック扱い）。 */
  selectedYears: string[] | null;
  onSelectedYearsChange: (value: string[] | null) => void;
  isLoading: boolean;
};

const ExamYearFilter = ({
  sortedLabels,
  selectedYears,
  onSelectedYearsChange,
  isLoading,
}: ExamYearFilterProps) => {
  const id = useId();
  const allCheckId = createUid(id, { prefix: 'yearAll' });
  const recentCheckId = createUid(id, { prefix: 'yearRecent' });

  const checkedSet = useMemo(
    () => (selectedYears === null ? null : new Set(selectedYears)),
    [selectedYears],
  );

  const isChecked = useCallback(
    (label: string) => (checkedSet === null ? true : checkedSet.has(label)),
    [checkedSet],
  );

  const checkedCount = useMemo(
    () =>
      checkedSet === null
        ? sortedLabels.length
        : sortedLabels.filter((l) => checkedSet.has(l)).length,
    [checkedSet, sortedLabels],
  );

  // 全て選択チェックボックスの状態
  const allCheckedState: boolean | 'indeterminate' = useMemo(() => {
    return checkedCount === 0
      ? false
      : checkedCount === sortedLabels.length
        ? true
        : 'indeterminate';
  }, [checkedCount, sortedLabels.length]);

  // 直近N年（先頭N件）。選択がちょうどこの集合と一致するときのみチェック状態。
  const recentLabels = useMemo(
    () => sortedLabels.slice(0, RECENT_YEAR_LIMIT),
    [sortedLabels],
  );
  const isRecentExact = useMemo(
    () =>
      recentLabels.length > 0 &&
      checkedCount === recentLabels.length &&
      recentLabels.every((l) => isChecked(l)),
    [recentLabels, checkedCount, isChecked],
  );

  const handleAllToggle = useCallback(() => {
    if (allCheckedState === true) {
      onSelectedYearsChange([]);
    } else {
      onSelectedYearsChange([...sortedLabels]);
    }
  }, [allCheckedState, onSelectedYearsChange, sortedLabels]);

  const handleRecentToggle = useCallback(() => {
    if (isRecentExact) {
      onSelectedYearsChange([]);
    } else {
      onSelectedYearsChange([...recentLabels]);
    }
  }, [isRecentExact, onSelectedYearsChange, recentLabels]);

  const handleYearToggle = useCallback(
    (label: string, checked: boolean) => {
      const current = selectedYears ?? sortedLabels;
      if (checked) {
        onSelectedYearsChange([...new Set([...current, label])]);
      } else {
        onSelectedYearsChange(current.filter((y) => y !== label));
      }
    },
    [selectedYears, sortedLabels, onSelectedYearsChange],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="text-base font-medium">出題年</div>
      <div className="@container flex flex-col gap-2 px-2">
        <div className="grid grid-cols-1 @[400px]:grid-cols-4 gap-x-3 gap-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id={allCheckId}
              checked={allCheckedState}
              disabled={isLoading || sortedLabels.length === 0}
              onCheckedChange={handleAllToggle}
            />
            <label
              htmlFor={allCheckId}
              className="cursor-pointer text-sm font-medium"
            >
              全て選択
            </label>
          </div>
          {/* 直近N年ショートカット */}
          <div className="flex items-center gap-2">
            <Checkbox
              id={recentCheckId}
              checked={isRecentExact}
              disabled={isLoading || recentLabels.length === 0}
              onCheckedChange={handleRecentToggle}
            />
            <label
              htmlFor={recentCheckId}
              className="cursor-pointer text-sm font-medium"
            >
              直近{RECENT_YEAR_LIMIT}年
            </label>
          </div>
        </div>

        <div className="border-t border-border my-1" />
        {/* 年ラベル一覧（4列グリッド・西暦併記） */}
        {isLoading ? (
          <div className="text-sm text-muted-foreground">読み込み中...</div>
        ) : sortedLabels.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            出題年データがありません
          </div>
        ) : (
          <div className="grid grid-cols-1 @[400px]:grid-cols-4 gap-x-3 gap-y-2">
            {sortedLabels.map((label) => {
              const checkId = createUid(id, { prefix: `year_${label}` });
              return (
                <div key={label} className="flex items-center gap-2 min-w-0">
                  <Checkbox
                    id={checkId}
                    checked={isChecked(label)}
                    onCheckedChange={(v) => handleYearToggle(label, Boolean(v))}
                  />
                  <label
                    htmlFor={checkId}
                    className="cursor-pointer text-sm truncate"
                  >
                    {formatYearLabelWithSeireki(label)}
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamYearFilter;
