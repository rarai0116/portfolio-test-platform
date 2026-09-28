// import StatusMessage from '@parts/statusMessage';
import StatusPill from '@parts/statusPill';
import type { TestData } from '@shared/types/contracts';
import {
  LineTabs,
  LineTabsContent,
  LineTabsList,
  LineTabsTrigger,
} from '@ui/lineTabs';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@ui/table';
import { TooltipProvider } from '@ui/tooltip';
import {
  type CandidateIndex,
  resolveCandidates,
} from '@views/createPdf/api/candidateIndex';
import type { CategoryCondition } from '@views/createPdf/types/draftState';
import type { ExamSubjectForUI } from '@views/createPdf/types/panelModel';
import type { CreatePdfPreviewUpdateAdapter } from '@views/createPdf/types/previewUpdate';
import type { CreatePdfTestTableRowStatus } from '@views/createPdf/types/statusState';
import type {
  TestTableRow,
  TestTableSection,
} from '@views/createPdf/types/testTable';
import { memo, useCallback, useMemo, useRef } from 'react';
import type { Grade } from '../types/viewState';
import ExamTestTableRow from './examTestTableRow';

type Props = {
  sectionNames: ExamSubjectForUI[];
  tableSections: TestTableSection[];
  showQaaChoiceIndex?: boolean;
  /** 選択肢シャッフル ON/OFF。undefined の場合はシャッフル列を非表示 */
  isShuffleChoices?: boolean;
  /** 問題No → TestData のルックアップ用マップ。isShuffleable の解決に使用 */
  testDataByNo?: ReadonlyMap<number, TestData>;
  /** 出題オプション・年度フィルタ済み候補Index。渡されたときのみ問題Noサジェストを表示 */
  candidateIndex?: CandidateIndex;
  rowStatuses?: readonly CreatePdfTestTableRowStatus[];
  grade: Grade;
  /** 行の selectedNo / isFixed / pageBreakBefore / qaaChoiceIndex 変更時に呼ばれる */
  onRowChange?: (
    sectionId: string,
    rowId: string,
    patch: Partial<
      Pick<
        TestTableRow,
        'selectedNo' | 'isFixed' | 'pageBreakBefore' | 'qaaChoiceIndex'
      >
    >,
  ) => void;
  previewUpdate?: Pick<
    CreatePdfPreviewUpdateAdapter,
    'beginGuardedEdit' | 'endGuardedEdit'
  >;
};

// sectionId 未一致時の fallback（参照を安定させるためモジュールスコープで定義）
const EMPTY_STATUS_MAP = new Map<string, CreatePdfTestTableRowStatus>();

type RowItemProps = {
  row: TestTableRow;
  rowNumber: number;
  sectionId: string;
  rowStatus?: CreatePdfTestTableRowStatus;
  suggestedNos?: readonly number[];
  showQaaChoiceIndex?: boolean;
  showShuffleColumn: boolean;
  isShuffleChoices?: boolean;
  isShuffleable: boolean;
  difficult?: string;
  grade: Grade;
  previewUpdate?: Pick<
    CreatePdfPreviewUpdateAdapter,
    'beginGuardedEdit' | 'endGuardedEdit'
  >;
  onRowChange?: Props['onRowChange'];
};

const EMPTY_SUGGESTED_NOS: readonly number[] = [];

// .map() 内の inline arrow fn を避け、ExamTestTableRow の memo が有効になるラッパー
const ExamTestTableRowItem = memo(
  ({
    row,
    rowNumber,
    sectionId,
    rowStatus,
    suggestedNos,
    showQaaChoiceIndex,
    showShuffleColumn,
    isShuffleChoices,
    isShuffleable,
    difficult,
    grade,
    previewUpdate,
    onRowChange,
  }: RowItemProps) => {
    const _prevRef = useRef<{
      row: typeof row;
      onRowChange: typeof onRowChange;
      rowStatus: typeof rowStatus;
      suggestedNos: typeof suggestedNos;
      previewUpdate: typeof previewUpdate;
    } | null>(null);
    const _prev = _prevRef.current;
    if (_prev) {
      const changed: string[] = [];
      if (_prev.row !== row) changed.push('row');
      if (_prev.onRowChange !== onRowChange) changed.push('onRowChange');
      if (_prev.rowStatus !== rowStatus) changed.push('rowStatus');
      if (_prev.suggestedNos !== suggestedNos) changed.push('suggestedNos');
      if (_prev.previewUpdate !== previewUpdate) changed.push('previewUpdate');
      if (changed.length > 0) {
        console.log('[RowItem memo突破]', row.id, changed);
      }
    }
    _prevRef.current = {
      row,
      onRowChange,
      rowStatus,
      suggestedNos,
      previewUpdate,
    };

    const handleSelectedNoChange = useCallback(
      (value: number) => {
        onRowChange?.(sectionId, row.id, {
          selectedNo: value === 0 ? null : String(value),
          ...(value !== 0 && { isFixed: true }),
        });
      },
      [sectionId, row.id, onRowChange],
    );

    const handleIsFixedChange = useCallback(
      (value: boolean) => {
        onRowChange?.(sectionId, row.id, { isFixed: value });
      },
      [sectionId, row.id, onRowChange],
    );

    const handlePageBreakBeforeChange = useCallback(
      (value: boolean) => {
        onRowChange?.(sectionId, row.id, { pageBreakBefore: value });
      },
      [sectionId, row.id, onRowChange],
    );

    const handleQaaChoiceIndexChange = useCallback(
      (value: number | null) => {
        onRowChange?.(sectionId, row.id, { qaaChoiceIndex: value });
      },
      [sectionId, row.id, onRowChange],
    );

    return (
      <ExamTestTableRow
        rowId={row.id}
        rowNumber={rowNumber}
        rowStatus={rowStatus}
        grade={grade}
        showQaaChoiceIndex={showQaaChoiceIndex}
        qaaChoiceIndex={row.qaaChoiceIndex}
        showShuffleColumn={showShuffleColumn}
        isShuffleChoices={isShuffleChoices}
        isShuffleable={isShuffleable}
        difficult={difficult}
        selectedNo={Number(row.selectedNo ?? '0') || 0}
        onSelectedNoChange={handleSelectedNoChange}
        isFixed={row.isFixed}
        onIsFixedChange={handleIsFixedChange}
        pageBreakBefore={row.pageBreakBefore}
        onPageBreakBeforeChange={handlePageBreakBeforeChange}
        onQaaChoiceIndexChange={handleQaaChoiceIndexChange}
        categoryTable={row.categoryTable}
        suggestedNos={suggestedNos ?? EMPTY_SUGGESTED_NOS}
        previewUpdate={previewUpdate}
      />
    );
  },
);

const ExamTestTable = ({
  sectionNames,
  tableSections,
  showQaaChoiceIndex,
  isShuffleChoices,
  testDataByNo,
  candidateIndex,
  rowStatuses = [],
  onRowChange,
  previewUpdate,
  grade,
}: Props) => {
  // シャッフル列は testDataByNo が渡されているときに表示する
  const showShuffleColumn = testDataByNo !== undefined;

  // 候補Noマップ: rowId -> number[]
  // candidateIndex がないときは全行空配列（サジェスト非表示）
  const prevSuggestedRef = useRef(new Map<string, readonly number[]>());

  const suggestedNosByRowId = useMemo(() => {
    if (!candidateIndex) {
      prevSuggestedRef.current = new Map();
      return prevSuggestedRef.current;
    }
    const prev = prevSuggestedRef.current;
    const result = new Map<string, readonly number[]>();
    for (const section of tableSections) {
      const usedNos = new Set<number>();
      for (const row of section.rows) {
        const n = Number(row.selectedNo ?? '0');
        if (n > 0) usedNos.add(n);
      }
      for (const row of section.rows) {
        const subject = row.categoryTable[0]?.subject ?? section.label;
        const thisNo = Number(row.selectedNo ?? '0');
        const conditions: CategoryCondition[] = row.categoryTable
          .filter(
            (c): c is typeof c & { bigCategoryTag: string } =>
              c.bigCategoryTag !== null,
          )
          .map((c) => ({ big: c.bigCategoryTag, small: c.smallCategoryTag }));
        if (conditions.length === 0) {
          // カテゴリ未指定はサジェスト対象外（前回参照を再利用）
          result.set(row.id, prev.get(row.id) ?? []);
          continue;
        }
        const candidates = resolveCandidates(
          candidateIndex,
          subject,
          conditions,
        );
        const suggested = [...new Set(candidates.map((e) => e.no))].filter(
          (n) => !usedNos.has(n) || n === thisNo,
        );
        // 内容が前回と同じなら配列参照を再利用 → ExamTestTableRowItem の memo を突破しない
        const prevArr = prev.get(row.id);
        if (
          prevArr !== undefined &&
          prevArr.length === suggested.length &&
          suggested.every((n, i) => prevArr[i] === n)
        ) {
          result.set(row.id, prevArr);
        } else {
          result.set(row.id, suggested);
        }
      }
    }
    prevSuggestedRef.current = result;
    return result;
  }, [tableSections, candidateIndex]);
  // rowStatuses を sectionId ごとにインデックス化し、ExamTestTableRow の rowStatus prop 参照を安定させる
  const rowStatusBySectionId = useMemo(() => {
    const result = new Map<string, Map<string, CreatePdfTestTableRowStatus>>();
    for (const status of rowStatuses) {
      let byRow = result.get(status.sectionId);
      if (!byRow) {
        byRow = new Map();
        result.set(status.sectionId, byRow);
      }
      byRow.set(status.rowId, status);
    }
    return result;
  }, [rowStatuses]);
  const totalCount = tableSections.reduce((sum, s) => sum + s.rows.length, 0);
  // rowStatuses が空（抽選前）は非表示。error/blocking があればエラー扱い
  const showTableStatus = rowStatuses.length > 0;
  const hasRowError = rowStatuses.some(
    (s) => s.severity === 'error' || s.severity === 'blocking',
  );
  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div className="flex gap-4 items-center pr-2">
            <div className="text-lg text-primary text-nowrap">問題テーブル</div>
            {showTableStatus && (
              <StatusPill
                kind={hasRowError ? 'error' : 'ok'}
                text={hasRowError ? 'エラーあり' : undefined}
              />
            )}
          </div>
          <div className="text-sm text-nowrap">合計 {totalCount}問</div>
        </div>

        <LineTabs
          key={sectionNames[0]?.id ?? 'empty'}
          defaultValue={sectionNames[0]?.id}
          className="w-full"
        >
          <LineTabsList className="w-full">
            {sectionNames.map((sectionName) => (
              <LineTabsTrigger key={sectionName.id} value={sectionName.id}>
                {sectionName.label}
              </LineTabsTrigger>
            ))}
          </LineTabsList>

          {sectionNames.map((sectionName) => {
            const section = tableSections.find(
              (s) => s.label === sectionName.label,
            );
            const rows = section?.rows ?? [];
            const rowStatusById =
              rowStatusBySectionId.get(section?.id ?? '') ?? EMPTY_STATUS_MAP;
            return (
              <LineTabsContent key={sectionName.id} value={sectionName.id}>
                <div className="flex flex-col gap-3 w-full py-3">
                  <div className="*:data-[slot=table-container]:overflow-x-visible">
                    <Table>
                      <TableHeader>
                        <TableRow className="flex w-full">
                          <TableHead className="flex w-12 items-center justify-center text-xs">
                            No.
                          </TableHead>
                          <TableHead className="flex-1 flex items-center justify-start text-xs px-5">
                            指定カテゴリー
                          </TableHead>
                          <TableHead className="flex w-24 items-center justify-center text-xs">
                            問題No
                          </TableHead>
                          {showQaaChoiceIndex && (
                            <TableHead className="flex w-18 items-center justify-center text-xs">
                              選択肢No
                            </TableHead>
                          )}
                          {showShuffleColumn && (
                            <TableHead className="flex w-16 items-center justify-center text-xs tracking-tighter">
                              シャッフル
                            </TableHead>
                          )}
                          {showShuffleColumn && (
                            <TableHead className="flex w-16 items-center justify-center text-xs">
                              難易度
                            </TableHead>
                          )}
                          <TableHead className="flex w-11 items-center justify-center text-xs">
                            固定
                          </TableHead>
                          <TableHead className="flex w-18 items-center justify-center text-xs">
                            改ページ
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row, i) => (
                          <ExamTestTableRowItem
                            key={row.id}
                            row={row}
                            rowNumber={i + 1}
                            sectionId={section?.id ?? ''}
                            rowStatus={rowStatusById.get(row.id)}
                            suggestedNos={suggestedNosByRowId.get(row.id)} // ?? [] 不要
                            showQaaChoiceIndex={showQaaChoiceIndex}
                            showShuffleColumn={showShuffleColumn}
                            isShuffleChoices={isShuffleChoices}
                            isShuffleable={
                              row.selectedNo !== null
                                ? (testDataByNo?.get(Number(row.selectedNo))
                                    ?.isShuffleable ?? false)
                                : false
                            }
                            difficult={
                              testDataByNo?.get(Number(row.selectedNo))
                                ?.difficult
                            }
                            grade={grade}
                            previewUpdate={previewUpdate}
                            onRowChange={onRowChange}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </LineTabsContent>
            );
          })}
        </LineTabs>
      </div>
    </TooltipProvider>
  );
};

export default ExamTestTable;
