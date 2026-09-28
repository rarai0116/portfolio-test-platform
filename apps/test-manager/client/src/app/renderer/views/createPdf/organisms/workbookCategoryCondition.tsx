import type { TestSubject } from '@shared/types/contracts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/select';
import { Separator } from '@ui/separator';
import type { CategoryTreeBySubject } from '@views/createPdf/api/categoryUtils';
import type { WorkbookCategoryTableRow as WorkbookCategoryTableRowData } from '@views/createPdf/types/viewState';
import { useMemo, useState } from 'react';
import WorkbookBigCategory from './workbookBigCategory';
import WorkbookSmallCategory from './workbookSmallCategory';

type Props = {
  categoryTable: WorkbookCategoryTableRowData[];
  categoryTreeBySubject: CategoryTreeBySubject;
  maxCountBySmallKey: ReadonlyMap<string, number>;
  onAddCondition: (
    initial: Pick<
      WorkbookCategoryTableRowData,
      'subject' | 'bigCategoryTag' | 'smallCategoryTag' | 'count'
    >,
  ) => void;
  /** 大カテゴリ全選択用: 複数の小分類を一括追加する */
  onAddConditions: (
    initials: Array<
      Pick<
        WorkbookCategoryTableRowData,
        'subject' | 'bigCategoryTag' | 'smallCategoryTag' | 'count'
      >
    >,
  ) => void;
  onUpdateCondition: (
    id: string,
    updater: (c: WorkbookCategoryTableRowData) => WorkbookCategoryTableRowData,
  ) => void;
  onRemoveCondition: (id: string) => void;
  /** 大カテゴリ全解除用: 複数の小分類条件を一括削除する */
  onRemoveConditions: (ids: string[]) => void;
  selectedSubject: TestSubject | null;
  onSubjectChange: (subject: TestSubject) => void;
};

const WorkbookCategoryTableRow = ({
  categoryTable,
  categoryTreeBySubject,
  maxCountBySmallKey,
  onAddCondition,
  onAddConditions,
  onUpdateCondition,
  onRemoveCondition,
  onRemoveConditions,
  selectedSubject,
  onSubjectChange,
}: Props) => {
  const subjects = Object.keys(categoryTreeBySubject) as TestSubject[];
  /** チェック解除時の問題数を保持し、再チェック時に復元する。key: "subject::big::small" */
  const [savedCounts, setSavedCounts] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );

  const categories = useMemo(() => {
    return selectedSubject != null
      ? (categoryTreeBySubject[selectedSubject] ?? [])
      : [];
  }, [selectedSubject, categoryTreeBySubject]);

  return (
    <div>
      <div className="flex flex-col gap-2 pb-9">
        <div className="text-base font-medium">学科</div>
        <div className="flex flex-col gap-5 px-2">
          <fieldset className="space-y-2">
            <Select
              value={selectedSubject ?? undefined}
              onValueChange={(v) => onSubjectChange(v as TestSubject)}
            >
              <SelectTrigger className="w-30">
                <SelectValue placeholder="学科を選択" />
              </SelectTrigger>
              <SelectContent className="w-30">
                {subjects.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>
        </div>
      </div>
      <Separator />
      <div className="flex flex-col gap-2 pt-6">
        <div className="text-base font-medium">カテゴリー</div>
        <fieldset className="space-y-2">
          {categories.map(({ big, small }) => {
            // maxCount > 0 の小分類（選択可能な小分類）
            const selectableSmall = small.filter(
              (s) =>
                (maxCountBySmallKey.get(`${selectedSubject}::${big}::${s}`) ??
                  0) > 0,
            );
            // 現在チェック済みの selectable 小分類
            const checkedSmall = selectableSmall.filter((s) =>
              categoryTable.some(
                (r) =>
                  r.subject === selectedSubject &&
                  r.bigCategoryTag === big &&
                  r.smallCategoryTag === s,
              ),
            );
            const bigChecked =
              selectableSmall.length > 0 &&
              checkedSmall.length === selectableSmall.length;
            // 一部チェック済みで全選択でない場合に indeterminate 表示
            const bigIndeterminate = checkedSmall.length > 0 && !bigChecked;

            // 大カテゴリヘッダーで表示する選択問題数 / 上限合計
            const selectedCount = categoryTable
              .filter(
                (r) =>
                  r.subject === selectedSubject && r.bigCategoryTag === big,
              )
              .reduce((sum, r) => sum + r.count, 0);
            const bigTotalCount = small.reduce(
              (sum, s) =>
                sum +
                (maxCountBySmallKey.get(`${selectedSubject}::${big}::${s}`) ??
                  0),
              0,
            );

            const handleBigCheck = () => {
              // 未チェックの selectable 小分類を一括追加（保存済み count あれば復元、なければ maxCount）
              const toAdd = selectableSmall
                .filter(
                  (s) =>
                    !categoryTable.some(
                      (r) =>
                        r.subject === selectedSubject &&
                        r.bigCategoryTag === big &&
                        r.smallCategoryTag === s,
                    ),
                )
                .map((s) => {
                  const key = `${selectedSubject}::${big}::${s}`;
                  return {
                    subject: selectedSubject as TestSubject,
                    bigCategoryTag: big,
                    smallCategoryTag: s,
                    count:
                      savedCounts.get(key) ?? maxCountBySmallKey.get(key) ?? 1,
                  };
                });
              if (toAdd.length > 0) onAddConditions(toAdd);
            };

            const handleBigUncheck = () => {
              // チェック解除前に count を保存し、一括削除
              const toRemove = categoryTable.filter(
                (r) =>
                  r.subject === selectedSubject && r.bigCategoryTag === big,
              );
              if (toRemove.length > 0) {
                setSavedCounts((prev) => {
                  const next = new Map(prev);
                  for (const r of toRemove) {
                    if (r.smallCategoryTag != null) {
                      next.set(
                        `${r.subject}::${r.bigCategoryTag}::${r.smallCategoryTag}`,
                        r.count,
                      );
                    }
                  }
                  return next;
                });
                onRemoveConditions(toRemove.map((r) => r.id));
              }
            };

            return (
              <WorkbookBigCategory
                key={big}
                big={big}
                checked={bigChecked}
                indeterminate={bigIndeterminate}
                selectedCount={selectedCount}
                bigTotalCount={bigTotalCount}
                onBigCheck={handleBigCheck}
                onBigUncheck={handleBigUncheck}
              >
                {small.map((s) => {
                  const key = `${selectedSubject}::${big}::${s}`;
                  const row = categoryTable.find(
                    (r) =>
                      r.subject === selectedSubject &&
                      r.bigCategoryTag === big &&
                      r.smallCategoryTag === s,
                  );
                  const maxCount = maxCountBySmallKey.get(key) ?? 0;
                  return (
                    <WorkbookSmallCategory
                      key={s}
                      label={s}
                      checked={row != null}
                      count={row?.count ?? savedCounts.get(key) ?? maxCount}
                      maxCount={maxCount}
                      onCheck={() => {
                        // selectedSubject は Select で確定済み（保存済み count あれば復元、なければ maxCount）
                        onAddCondition({
                          subject: selectedSubject as TestSubject,
                          bigCategoryTag: big,
                          smallCategoryTag: s,
                          count: savedCounts.get(key) ?? maxCount,
                        });
                      }}
                      onUncheck={() => {
                        if (row) {
                          // チェック解除前に count を保存
                          setSavedCounts((prev) =>
                            new Map(prev).set(key, row.count),
                          );
                          onRemoveCondition(row.id);
                        }
                      }}
                      onCountChange={(n) =>
                        row &&
                        onUpdateCondition(row.id, (r) => ({ ...r, count: n }))
                      }
                    />
                  );
                })}
              </WorkbookBigCategory>
            );
          })}
        </fieldset>
      </div>
    </div>
  );
};

export default WorkbookCategoryTableRow;
