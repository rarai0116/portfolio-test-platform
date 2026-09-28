import { Button } from '@ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/dropdownMenu';
import { useCsvIo } from '@views/testDataList/hooks/useCsvIo';
import useDataGrid from '@views/testDataList/hooks/useDataGrid';
import useDataGridStyle from '@views/testDataList/hooks/useDataGridStyle';
import { useStopToggle } from '@views/testDataList/hooks/useStopToggle';
import useDataGridStore from '@views/testDataList/stores/useDataGridStore';
import useDataGridStyleStore from '@views/testDataList/stores/useDataGridStyleStore';
import type { Row } from '@views/testDataList/types/reactGridDataTypes';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DataGrid, type DataGridHandle } from 'react-data-grid';
import { useNavigate } from 'react-router';

export type BusyKind =
  | 'export'
  | 'import'
  | 'stopToggle'
  | 'createOriginal'
  | null;

import CrossIcon from '@components/icons/crossIcon';
import ExportIcon from '@components/icons/exportIcon';
import ImportIcon from '@components/icons/importIcon';
import MoreIcon from '@components/icons/moreIcon';
import RadioGroupCards from '@parts/radioGroupCards';
import { buildTestDataDisplayName } from '@renderer/api/testDataDisplayName';
import { useGlobalLoading } from '@renderer/hooks/useGlobalLoading';
import type { GradeId } from '@shared/types/contracts';
import { useOriginalTestDataCreate } from '@views/testDataList/hooks/useOriginalTestDataCreate';

const formatNos = (nos: number[], perLine = 20) => {
  const clean = nos.filter((n) => Number.isFinite(n));
  const lines: string[] = [];
  for (let i = 0; i < clean.length; i += perLine) {
    lines.push(clean.slice(i, i + perLine).join(', ')); // 変更: カンマ後にスペース
  }
  return lines.join('\n');
};

const compareNullable = <T,>(
  _left: T | null | undefined,
  _right: T | null | undefined,
  compare: (a: T, b: T) => number,
) => {
  const left = _left === '' ? null : _left;
  const right = _right === '' ? null : _right;

  if (left == null && right == null) return 0;
  if (left == null) return -1;
  if (right == null) return 1;
  return compare(left, right);
};

const TestDataList = () => {
  const navigate = useNavigate();
  const {
    filteredAndSortedRows,
    reorderedColumns,
    onColumnsReorder,
    resetOrderAndWidths,
    docs,
    loading,
    unsubscribe,
    subscribe,
    refresh,
    update,
  } = useDataGrid();
  const {
    sortColumns,
    grade,
    setGrade,
    selectedRows,
    setSelectedRows,
    clearFilters,
    //    checkedFilters,
    //    filterSelectionInitialized,
    setFilterSelectionInitialized,
  } = useDataGridStore();
  const { show, hide } = useGlobalLoading();

  const { setColumnWidths, columnWidths } = useDataGridStyleStore();
  const dataGridRef = useRef<DataGridHandle | null>(null);
  const { renderBorder } = useDataGridStyle();
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [busy, setBusy] = useState<BusyKind>(null);

  const {
    importDialogOpen,
    importFormatErrorDialogOpen,
    importFormatErrorMessage,
    importPlan,
    setImportPlan,
    setImportDialogOpen,
    setImportFormatErrorDialogOpen,
    handleExportCsv,
    handleImportCsv,
    importSummary,
    setImportSummary,
    startImport,
  } = useCsvIo({
    docs,
    setStatusMessage,
    selectedRows,
    grade,
    unsubscribe,
    busy,
    setBusy,
    refresh,
    subscribe,
  });

  const {
    stopDialogOpen,
    setStopDialogOpen,
    stopActionLabel,
    selectionMode,
    selectedNos,
    startStopToggle,
    confirmStopToggle,
    onSelectedRowsChangeGuarded,
  } = useStopToggle({
    docs,
    selectedRows,
    setSelectedRows,
    update,
    busy,
    setBusy,
    setStatusMessage,
    formatNos,
  });
  const {
    createDialogOpen,
    setCreateDialogOpen,
    createMode,
    createTargetNos,
    createSourceNos,
    startCreateDialog,
    confirmCreate,
  } = useOriginalTestDataCreate({
    docs,
    grade,
    selectedRows,
    busy,
    setBusy,
    setStatusMessage,
    formatNos,
  });

  const initialLoadingIdRef = useRef<string | null>(null);
  const hasClosedInitialLoadingRef = useRef(false);
  const hasRenderedGridRef = useRef(false);

  const rowToTestNums = useCallback(() => {
    const collator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: 'base',
    });

    const rowMap = new Map(filteredAndSortedRows.map((row) => [row.id, row]));

    const idList = Array.from(selectedRows)
      .map((id) => rowMap.get(id))
      .filter((row): row is Row => row != null)
      .toSorted((a, b) => {
        const byId = compareNullable(a.id, b.id, (left, right) =>
          collator.compare(left, right),
        );
        return byId;
      })
      .toSorted((a, b) => {
        const byPublicationNo = compareNullable(
          a.publicationNo || null,
          b.publicationNo || null,
          (left, right) => collator.compare(left, right),
        );
        return byPublicationNo;
      })
      .toSorted((a, b) => {
        const bySubject = compareNullable(a.subject, b.subject, (left, right) =>
          collator.compare(left, right),
        );
        return bySubject;
      })
      .toSorted((a, b) => {
        const aIsOriginal = a.original;
        const bIsOriginal = b.original;
        if (aIsOriginal !== bIsOriginal) {
          return aIsOriginal ? -1 : 1;
        }

        return 0;
      })
      .map((row) => {
        const no = row.no;
        const isOriginal = row.original === 'オリジナル';

        const name = buildTestDataDisplayName({
          isOriginal,
          subject: row.subject,
          no: row.no,
          year: row.year,
          testNo: row.testNo,
        });

        // 旧表示形式（保存）
        // const id = isOriginal
        //   ? row.no
        //   : row.publicationNo === ''
        //     ? '不明'
        //     : row.publicationNo;
        // const name = isOriginal
        //   ? `${row.subject} No.${id}`
        //   : `${row.subject} 資料No.${id}`;

        return { no, name, status: row.status };
      });
    return idList;
  }, [selectedRows, filteredAndSortedRows]);

  //  const id = useId();
  //  const gradeOneId = createUid(id, { prefix: 'grade1' });
  //  const gradeTwoId = createUid(id, { prefix: 'grade2' });

  // 同一性のより強いID基準によるキーの付与
  const rowKeyGetter = (row: Row): string => {
    return row.id;
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: DataGridのレンダリング後に実行したいため
  useEffect(() => {
    renderBorder(dataGridRef);
  }, [filteredAndSortedRows, renderBorder]);

  // 初期化
  // biome-ignore lint/correctness/useExhaustiveDependencies: 初期化のため
  useEffect(() => {
    setSelectedRows(new Set());

    hasClosedInitialLoadingRef.current = false;
    hasRenderedGridRef.current = false;

    initialLoadingIdRef.current = show('問題データリストを読み込み中…');

    return () => {
      setSelectedRows(new Set());

      if (initialLoadingIdRef.current) {
        hide(initialLoadingIdRef.current);
        initialLoadingIdRef.current = null;
      }
    };
  }, [grade]);

  // 初回描画完了でローディング終了
  // biome-ignore lint/correctness/useExhaustiveDependencies: 初回終了判定のみ行いたいため
  useEffect(() => {
    if (hasClosedInitialLoadingRef.current) return;
    if (loading) return;

    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (hasClosedInitialLoadingRef.current) return;

        hasRenderedGridRef.current = true;
        hasClosedInitialLoadingRef.current = true;

        if (initialLoadingIdRef.current) {
          console.info('Initial loading complete, hiding loading indicator');
          hide(initialLoadingIdRef.current);
          initialLoadingIdRef.current = null;
        }
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [loading, filteredAndSortedRows]);

  const handleCloseStatusMessage = useCallback(() => {
    setStatusMessage('');
  }, []);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="text-lg flex justify-between items-end px-12 py-5 bg-background">
        <div className="flex  items-center gap-6">
          <RadioGroupCards
            options={[
              { value: 'firstGrade', label: '1級' },
              { value: 'secondGrade', label: '2級' },
            ]}
            value={grade}
            onValueChange={(v) => {
              if (v === grade) return;
              clearFilters();
              setGrade(v as GradeId);
              setFilterSelectionInitialized(false);
            }}
          />
        </div>
        <div className="flex h-full items-center gap-4">
          {statusMessage ? (
            <div className="flex h-full items-center text-sm text-muted-foreground">
              <div>{statusMessage}</div>
              <button
                type="button"
                aria-label="ステータスメッセージを閉じる"
                className="w-8 h-full px-2"
                onClick={handleCloseStatusMessage}
              >
                <CrossIcon
                  size={12}
                  fill="var(--color-icon)"
                  hoverFill="var(--color-icon-hover)"
                />
              </button>
            </div>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger>
              <div className="min-w-6 min-h-6 cursor-pointer">
                <MoreIcon
                  fill="var(--color-icon)"
                  hoverFill="var(--color-icon-hover)"
                  size={30}
                />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>表</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => {
                  clearFilters();
                  setFilterSelectionInitialized(false);
                }}
              >
                絞り込みのリセット
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  resetOrderAndWidths();
                }}
              >
                レイアウトのリセット
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>問題</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={busy !== null || selectionMode === null}
                onSelect={startStopToggle}
              >
                {stopActionLabel}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>CSV</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={busy !== null || selectedRows.size === 0}
                onSelect={() => {
                  handleExportCsv();
                }}
              >
                <ExportIcon fill="var(--color-icon)" />
                エクスポート
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={busy !== null}
                onSelect={() => {
                  handleImportCsv('normal');
                }}
              >
                <ImportIcon fill="var(--color-icon)" />
                インポート
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-error-text hover:text-error-text!"
                disabled={busy !== null}
                onSelect={() => {
                  handleImportCsv('force');
                }}
              >
                <ImportIcon fill="var(--color-error-text)" />
                強制CSVインポート
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={startCreateDialog}
          >
            {selectedRows.size > 0 ? 'コピーして新規作成' : '新規作成'}
          </Button>
          <Button
            disabled={selectedRows.size === 0}
            onClick={() => {
              navigate('/testDataEditor', {
                state: { grade, idList: rowToTestNums() },
              });
            }}
          >
            編集
          </Button>
        </div>
      </div>

      <DataGrid
        ref={dataGridRef}
        aria-label="問題データリスト"
        columns={reorderedColumns}
        rows={filteredAndSortedRows}
        headerRowHeight={72}
        rowHeight={36}
        rowKeyGetter={rowKeyGetter}
        defaultColumnOptions={{
          sortable: true,
          draggable: true,
          resizable: true,
        }}
        selectedRows={selectedRows}
        onSelectedRowsChange={onSelectedRowsChangeGuarded}
        sortColumns={sortColumns}
        onColumnsReorder={onColumnsReorder}
        columnWidths={columnWidths}
        onColumnWidthsChange={setColumnWidths}
        onScroll={() => {
          renderBorder(dataGridRef);
        }}
      />

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[80vh] flex-col overflow-hidden"
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>CSVインポートの確認</DialogTitle>
          </DialogHeader>
          <DialogDescription asChild>
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              {/* 上: 固定メッセージ */}
              <div className="shrink-0 text-foreground">
                このインポート操作によって、以下の問題データが書き変わります
              </div>

              {/* 中: No一覧だけスクロール */}
              <div className="min-h-0 flex-1 overflow-y-auto pr-4">
                <div className="text-foreground">
                  変更({importSummary?.changedNos.length ?? 0}件):
                  <pre className="mt-1 whitespace-pre-wrap break-all text-sm text-muted-foreground">
                    {formatNos(importSummary?.changedNos ?? [])}
                  </pre>
                </div>

                <div className="mt-4 text-foreground">
                  新規({importSummary?.newNos.length ?? 0}件):
                  <pre className="mt-1 whitespace-pre-wrap break-all text-sm text-muted-foreground">
                    {formatNos(importSummary?.newNos ?? [])}
                  </pre>
                </div>
              </div>

              {/* 下: 固定メッセージ */}
              <div className="shrink-0 text-foreground">
                この操作は、サーバーのデータを書き換えます。取り消しができません。
                <br />
                必ずバックアップをとってから、行なってください。
                <br />
                本当に実行しますか？
              </div>
            </div>
          </DialogDescription>

          <DialogFooter className="shrink-0 border-t bg-background pt-4">
            <Button
              variant="outline"
              onClick={() => {
                // いいえ
                setImportDialogOpen(false);
                setImportPlan([]);
                setImportSummary(null);
              }}
            >
              いいえ
            </Button>
            <Button
              disabled={busy !== null || importPlan.length === 0}
              onClick={startImport}
            >
              はい
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={importFormatErrorDialogOpen}
        onOpenChange={setImportFormatErrorDialogOpen}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>CSV形式エラー</DialogTitle>
          </DialogHeader>

          <DialogDescription className="text-sm text-foreground">
            {importFormatErrorMessage}
          </DialogDescription>

          <DialogFooter className="border-t bg-background pt-4">
            <Button
              onClick={() => {
                setImportFormatErrorDialogOpen(false);
              }}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={stopDialogOpen} onOpenChange={setStopDialogOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[80vh] flex-col overflow-hidden"
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>{stopActionLabel}の確認</DialogTitle>
          </DialogHeader>

          <DialogDescription asChild>
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="shrink-0 text-foreground">
                対象({selectedNos.length}件):
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pr-4">
                <pre className="mt-1 whitespace-pre-wrap break-all text-sm text-muted-foreground">
                  {formatNos(selectedNos)}
                </pre>
              </div>

              <div className="shrink-0 text-foreground">
                この操作は、サーバーのデータを書き換えます。取り消しができません。
                <br />
                本当に実行しますか？
              </div>
            </div>
          </DialogDescription>

          <DialogFooter className="shrink-0 border-t bg-background pt-4">
            <Button variant="outline" onClick={() => setStopDialogOpen(false)}>
              いいえ
            </Button>
            <Button
              disabled={
                busy !== null ||
                selectionMode === null ||
                selectedNos.length === 0
              }
              onClick={confirmStopToggle}
            >
              はい
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[80vh] flex-col overflow-hidden"
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {createMode === 'copy'
                ? 'コピーして新規作成の確認'
                : '新規作成の確認'}
            </DialogTitle>
          </DialogHeader>

          <DialogDescription asChild>
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              {createMode === 'copy' ? (
                <>
                  <div className="shrink-0 text-foreground">
                    作成No: {createTargetNos.join(', ')}
                  </div>

                  <div className="shrink-0 text-foreground">
                    コピー元No: {createSourceNos.join(', ')}
                  </div>

                  <div className="shrink-0 text-foreground">
                    合計{createTargetNos.length}
                    問のオリジナル問題をコピーして作成しますがよろしいですか？
                  </div>
                </>
              ) : (
                <div className="shrink-0 text-foreground">
                  No.{createTargetNos[0] ?? ''}{' '}
                  のオリジナル問題を作成しますがよろしいですか？
                </div>
              )}
            </div>
          </DialogDescription>

          <DialogFooter className="shrink-0 border-t bg-background pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
              }}
            >
              いいえ
            </Button>
            <Button
              disabled={
                busy !== null ||
                createMode === null ||
                createTargetNos.length === 0
              }
              onClick={confirmCreate}
            >
              はい
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TestDataList;
