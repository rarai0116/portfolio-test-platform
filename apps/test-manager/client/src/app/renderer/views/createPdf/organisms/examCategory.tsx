import type { TestSubject } from '@shared/types/contracts';
import {
  LineTabs,
  LineTabsContent,
  LineTabsList,
  LineTabsTrigger,
} from '@ui/lineTabs';
import type { CategoryTreeBySubject } from '@views/createPdf/api/categoryUtils';
import type { CategoryRowForUI } from '@views/createPdf/hooks/useExamStepTwo';
import type { ExamSubjectForUI } from '@views/createPdf/types/panelModel';
import ExamCategoryRow from './examCategoryRow';

type Props = {
  subjects: ExamSubjectForUI[];
  categoryTableForUI: CategoryRowForUI[];
  categoryTreeBySubject: CategoryTreeBySubject;
  onUpdateConditions: (conditionId: string, selected: string[]) => void;
  /** demand >= supply に達したカテゴリの "big/small" キー集合（学科別） */
  exhaustedCategoryKeysBySubject: Record<TestSubject, ReadonlySet<string>>;
};

const ExamCategory = ({
  subjects,
  categoryTableForUI,
  categoryTreeBySubject,
  onUpdateConditions,
  exhaustedCategoryKeysBySubject,
}: Props) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-base font-medium">カテゴリー</div>
      <LineTabs defaultValue={subjects[0]?.id} className="w-full">
        <LineTabsList className="w-full">
          {subjects.map((subject) => (
            <LineTabsTrigger key={subject.id} value={subject.id}>
              {subject.label}
            </LineTabsTrigger>
          ))}
        </LineTabsList>

        {subjects.map((subject) => {
          const categoryTree = categoryTreeBySubject[subject.label] ?? [];
          const exhaustedKeys =
            exhaustedCategoryKeysBySubject[subject.label as TestSubject] ??
            new Set<string>();
          // 学科ごとに行をフィルタリング
          const rowsForSubject = categoryTableForUI.filter(
            (r) => r.subject === subject.label,
          );
          return (
            <LineTabsContent key={subject.label} value={subject.id}>
              <div className="flex flex-col w-full gap-3 px-2 pt-3">
                {rowsForSubject.map((row, i) => {
                  // 上限到達済みかつ自行未選択のカテゴリーをドロップダウンから除外
                  const filteredCategoryTree = categoryTree.map((cat) => ({
                    big: cat.big,
                    small: cat.small.filter((small) => {
                      const key = `${cat.big}/${small}`;
                      return (
                        !exhaustedKeys.has(key) ||
                        row.selectedCategories.includes(key)
                      );
                    }),
                  }));
                  return (
                    <ExamCategoryRow
                      key={row.id}
                      qnumber={i + 1}
                      categoryTree={filteredCategoryTree}
                      selectedCategories={row.selectedCategories}
                      onUpdateConditions={(selected) =>
                        onUpdateConditions(row.id, selected)
                      }
                    />
                  );
                })}
              </div>
            </LineTabsContent>
          );
        })}
      </LineTabs>
    </div>
  );
};

export default ExamCategory;
