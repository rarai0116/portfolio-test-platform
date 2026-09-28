import CrossIcon from '@components/icons/crossIcon';
import IntegerInput from '@parts/integerInput';
import { cn } from '@renderer/api/utils';
import { Checkbox } from '@ui/checkbox';
import { TableCell, TableRow } from '@ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui/tooltip';
import QuestionNoSuggestInput from '@views/createPdf/parts/questionNoSuggestInput';
import type { CreatePdfPreviewUpdateAdapter } from '@views/createPdf/types/previewUpdate';
import type { CreatePdfTestTableRowStatus } from '@views/createPdf/types/statusState';
import type { TestCategoryCondition } from '@views/createPdf/types/testTable';
import type { Grade } from '@views/createPdf/types/viewState';
import { AlertTriangle, CircleIcon } from 'lucide-react';
import { memo, useCallback, useId, useState } from 'react';

type Props = {
  rowId?: string;
  rowNumber?: number;
  rowStatus?: CreatePdfTestTableRowStatus;
  /** 確定値（0 = 空欄）。外部（ストア）で管理する */
  selectedNo: number;
  onSelectedNoChange: (value: number) => void;
  isFixed: boolean;
  onIsFixedChange: (value: boolean) => void;
  pageBreakBefore: boolean;
  onPageBreakBeforeChange: (value: boolean) => void;
  showQaaChoiceIndex?: boolean;
  qaaChoiceIndex?: number | null;
  onQaaChoiceIndexChange?: (value: number | null) => void;
  /** シャッフル列を表示するかどうか */
  showShuffleColumn?: boolean;
  /** 選択肢シャッフル機能の ON/OFF */
  isShuffleChoices?: boolean;
  /** 対象問題がシャッフル可能かどうか（TestData.isShuffleable の値） */
  isShuffleable?: boolean;
  /** 問題の難易度（TestData.difficult の値）。1〜3 を ☆ 表示、範囲外/未設定は ー */
  difficult?: string;
  categoryTable?: TestCategoryCondition[];
  /** 出題オプション・使用済みNo除外済みの候補No一覧。空のときはサジェストを非表示 */
  suggestedNos?: readonly number[];
  previewUpdate?: Pick<
    CreatePdfPreviewUpdateAdapter,
    'beginGuardedEdit' | 'endGuardedEdit'
  >;
  grade: Grade;
};

/** 1〜3 → ☆〜☆☆☆、それ以外（0・未設定・範囲外・非整数）→ ー */
const formatDifficult = (val?: string): string => {
  const n = Math.floor(Number(val));
  if (!Number.isFinite(n) || n < 1 || n > 3) return 'ー';
  return '☆'.repeat(n);
};

const formatCategoryLabel = (cond: TestCategoryCondition): string => {
  if (!cond.bigCategoryTag) return '--';
  return cond.smallCategoryTag
    ? `${cond.bigCategoryTag} / ${cond.smallCategoryTag}`
    : cond.bigCategoryTag;
};

const ExamTestTableRow = ({
  rowId = 'exam-row',
  rowNumber = 1,
  rowStatus,
  selectedNo,
  onSelectedNoChange,
  isFixed,
  onIsFixedChange,
  pageBreakBefore,
  onPageBreakBeforeChange,
  showQaaChoiceIndex,
  qaaChoiceIndex,
  onQaaChoiceIndexChange,
  showShuffleColumn,
  isShuffleChoices,
  isShuffleable,
  difficult,
  categoryTable,
  suggestedNos = [],
  previewUpdate,
  grade,
}: Props) => {
  const fixedId = useId();
  const pageBreakId = useId();

  // staged input を local に閉じ、確定値だけを外部へ流す。
  const [selectedNoInput, setSelectedNoInput] = useState<number | null>(null);

  const editKey = `${rowId}:selected-no`;
  const blockingMarkers = rowStatus?.markers.filter(
    (marker) => marker.severity === 'blocking' || marker.severity === 'error',
  );
  const warningMarkers = rowStatus?.markers.filter(
    (marker) => marker.severity === 'warning',
  );
  const hasNoBlocking = blockingMarkers?.some(
    (marker) => marker.targetCell === 'no' || marker.targetCell === 'row',
  );
  const hasChoiceBlocking = blockingMarkers?.some(
    (marker) => marker.targetCell === 'choice' || marker.targetCell === 'row',
  );

  const finalizeSelectedNo = useCallback(() => {
    const nextSelectedNo = selectedNoInput ?? selectedNo;

    if (nextSelectedNo !== selectedNo) {
      onSelectedNoChange(nextSelectedNo);
    }

    setSelectedNoInput(null);
    previewUpdate?.endGuardedEdit(editKey);
  }, [selectedNoInput, selectedNo, onSelectedNoChange, previewUpdate, editKey]);

  return (
    <TableRow
      className={cn(
        'flex w-full border-l-4 border-l-transparent',
        (blockingMarkers?.length ?? 0) > 0 &&
          'border-l-error-border border-l-4',
        (warningMarkers?.length ?? 0) > 0 &&
          (blockingMarkers?.length ?? 0) === 0 &&
          'border-l-warning-border border-l-4',
      )}
    >
      <TableCell className="flex w-12 items-center justify-center">
        {rowNumber}
      </TableCell>
      <TableCell className={cn('flex-1 flex items-center justify-start px-4')}>
        {categoryTable && categoryTable.length > 0
          ? formatCategoryLabel(categoryTable[0])
          : 'ー'}
        {(blockingMarkers?.length ?? 0) > 0 ? (
          // blocking があれば赤バッジを優先表示し、warning は非表示
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertTriangle
                aria-label="エラー"
                color="var(--color-background)"
                fill="var(--color-destructive)"
                className="ml-2 size-4 shrink-0"
              />
            </TooltipTrigger>
            <TooltipContent>
              <div className="flex flex-col gap-1 text-xs">
                {blockingMarkers?.map((marker) => (
                  <div key={`${marker.code}:${marker.message}`}>
                    {marker.message}
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        ) : (warningMarkers?.length ?? 0) > 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertTriangle
                aria-label="固定行の注意"
                color="var(--color-foreground)"
                fill="var(--color-warning-bg)"
                className="ml-2 size-4 shrink-0"
              />
            </TooltipTrigger>
            <TooltipContent>
              <div className="flex flex-col gap-1 text-left text-xs whitespace-nowrap">
                {warningMarkers?.map((marker) => (
                  <div key={`${marker.code}:${marker.message}`}>
                    {marker.message}
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </TableCell>
      <TableCell className="flex w-22 items-center justify-center">
        <QuestionNoSuggestInput
          aria-label="問題No"
          className="h-7 w-full"
          hasError={hasNoBlocking}
          value={selectedNoInput ?? selectedNo}
          suggestedNos={suggestedNos}
          onBlur={finalizeSelectedNo}
          onChange={(value) => setSelectedNoInput(value)}
          onChoose={(value) => {
            // リストから選択した時点で即確定する
            setSelectedNoInput(value);
            if (value !== selectedNo) {
              onSelectedNoChange(value);
            }
            setSelectedNoInput(null);
            previewUpdate?.endGuardedEdit(editKey);
          }}
          onFocus={() => {
            setSelectedNoInput(selectedNo);
            previewUpdate?.beginGuardedEdit(editKey);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              finalizeSelectedNo();
            }
            if (event.key === 'Escape') {
              setSelectedNoInput(null);
              previewUpdate?.endGuardedEdit(editKey);
            }
          }}
          min={1}
          max={9999}
        />
      </TableCell>
      {showQaaChoiceIndex && (
        <TableCell className="flex w-18 items-center justify-center">
          <IntegerInput
            aria-label="選択肢No"
            className={cn(
              'h-7 w-full',
              hasChoiceBlocking && 'border-error-border',
            )}
            value={qaaChoiceIndex ?? 0}
            onChange={(value) =>
              onQaaChoiceIndexChange?.(value === 0 ? null : value)
            }
            min={1}
            max={grade === 1 ? 4 : 5}
          />
        </TableCell>
      )}
      {showShuffleColumn && (
        <TableCell className="flex w-16 items-center justify-center">
          {isShuffleChoices && isShuffleable ? (
            <CircleIcon size={14} color="var(--color-icon)" />
          ) : (
            <CrossIcon size={14} fill="var(--color-icon)" />
          )}
        </TableCell>
      )}
      {showShuffleColumn && (
        <TableCell className="flex w-16 items-center justify-center">
          {selectedNo !== 0 ? formatDifficult(difficult) : 'ー'}
        </TableCell>
      )}
      <TableCell className="flex w-11 items-center justify-center">
        <Checkbox
          id={fixedId}
          checked={isFixed}
          onCheckedChange={(v) => onIsFixedChange(Boolean(v))}
        />
      </TableCell>
      <TableCell className="flex w-18 items-center justify-center">
        <Checkbox
          id={pageBreakId}
          checked={pageBreakBefore}
          onCheckedChange={(v) => onPageBreakBeforeChange(Boolean(v))}
        />
      </TableCell>
    </TableRow>
  );
};

export default memo(ExamTestTableRow);
