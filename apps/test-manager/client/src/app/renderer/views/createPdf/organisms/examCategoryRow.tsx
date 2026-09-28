import CategoryCascadeMultiSelect from '@components/organism/categoryCascadeMultiSelect';

type Props = {
  qnumber: number;
  selectedCategories: string[];
  categoryTree: { big: string; small: string[] }[];
  onUpdateConditions: (selected: string[]) => void;
};

const ExamCategoryRow = ({
  qnumber,
  selectedCategories,
  categoryTree,
  onUpdateConditions,
}: Props) => {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-sm">問{qnumber}</span>
      <div className="w-full">
        <CategoryCascadeMultiSelect
          categoryTree={categoryTree}
          selectedCategories={selectedCategories}
          onUpdateConditions={onUpdateConditions}
        />
      </div>
    </div>
  );
};

export default ExamCategoryRow;
