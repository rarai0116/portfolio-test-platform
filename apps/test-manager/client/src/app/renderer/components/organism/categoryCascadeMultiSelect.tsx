import CrossIcon from '@components/icons/crossIcon';
import PlusIcon from '@components/icons/plusIcon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@ui/dropdownMenu';
import { ChevronDownIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

type Props = {
  categoryTree: { big: string; small: string[] }[];
  selectedCategories: string[];
  onUpdateConditions: (selected: string[]) => void;
};

const CategoryCascadeMultiSelect = (props: Props) => {
  const [open, setOpen] = useState(false);

  const filteredCategoryTree = useMemo(
    () =>
      props.categoryTree.map((cat) => ({
        big: cat.big,
        small: cat.small.filter(
          (small) => !props.selectedCategories.includes(`${cat.big}/${small}`),
        ),
      })),
    [props.categoryTree, props.selectedCategories],
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <div
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          tabIndex={0}
          className="bg-white border rounded-md min-h-9.5 pr-2 py-1.5 flex w-full items-center justify-between cursor-pointer"
        >
          <div className="flex flex-wrap gap-1 pl-1.5 ">
            {props.selectedCategories.length > 0 ? (
              props.selectedCategories.map((v, _i) => {
                return (
                  <div
                    key={v}
                    className="flex items-center bg-demoblue-50 rounded-md ml-1"
                  >
                    <div className=" p-1 rounded text-xs">{v}</div>
                    <div className="h-full px-1 flex items-center justify-center hover:bg-demoblue-100">
                      <button
                        type="button"
                        className="w-full h-full"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          props.onUpdateConditions(
                            props.selectedCategories.filter((c) => c !== v),
                          );
                        }}
                        title="閉じる"
                        aria-label="閉じる"
                      >
                        <CrossIcon size={16} fill="var(--color-icon)" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-sm pl-2">分類を選択</div>
            )}
            {props.selectedCategories.length > 0 ? (
              <div className="flex items-center">
                <PlusIcon
                  size={16}
                  fill="var(--color-icon)"
                  hoverFill="var(--color-icon-hover)"
                />
              </div>
            ) : (
              <div />
            )}
          </div>
          <ChevronDownIcon size={16} />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60" align="start">
        {filteredCategoryTree
          .filter((cat) => cat.small.length > 0)
          .map((category) => (
            <DropdownMenuSub key={category.big}>
              <DropdownMenuSubTrigger>{category.big}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="items-start">
                {category.small.map((smallCategory) => {
                  const fullCategory = `${category.big}/${smallCategory}`;
                  return (
                    <DropdownMenuItem
                      key={smallCategory}
                      onSelect={() => {
                        props.onUpdateConditions([
                          ...props.selectedCategories,
                          fullCategory,
                        ]);
                      }}
                    >
                      {smallCategory}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default CategoryCascadeMultiSelect;
