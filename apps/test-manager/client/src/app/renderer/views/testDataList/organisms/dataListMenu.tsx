import { createUid } from '@api/utils';
import FilterIcon from '@components/icons/filterIcon';
import type { CheckedState } from '@radix-ui/react-checkbox';
import { Checkbox } from '@ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/dropdownMenu';
import { Label } from '@ui/label';
import { areAllFilterOptionsSelected } from '@views/testDataList/api/filterSelection';
import useDataGridStore from '@views/testDataList/stores/useDataGridStore';
import type { FilterStateKey } from '@views/testDataList/types/reactGridDataTypes';
import { useId, useMemo } from 'react';
import type { SortDirection } from 'react-data-grid';
import { useShallow } from 'zustand/react/shallow';

type Props = {
  allowSort?: boolean;
  columnKey: string;
  filterOption?: string[];
  onSortColumns: (clickedKey: string, direction: SortDirection) => void;
  onCheckedChange?: (
    key: FilterStateKey,
    value: string,
    checked: CheckedState,
  ) => void;
};

const DataListMenu = (props: Props) => {
  const { checkedFilters, updateFilter, setCheckedFilters, setSelectedRows } =
    useDataGridStore(
      useShallow((s) => ({
        checkedFilters: s.checkedFilters,
        updateFilter: s.updateFilter,
        setCheckedFilters: s.setCheckedFilters,
        setSelectedRows: s.setSelectedRows,
      })),
    );

  const id = useId();
  const selectAllId = createUid(id, { prefix: 'filterAll' });
  const filterKey = props.columnKey as FilterStateKey;
  const selectedValues = checkedFilters[filterKey] ?? [];
  const allSelected = useMemo(() => {
    return props.filterOption
      ? areAllFilterOptionsSelected(selectedValues, props.filterOption)
      : false;
  }, [props.filterOption, selectedValues]);
  const isFiltering = useMemo(() => {
    return props.filterOption !== undefined && !allSelected;
  }, [props.filterOption, allSelected]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <div className="min-w-6 min-h-6 cursor-pointer items-center">
          <FilterIcon
            size={24}
            fill={`${isFiltering ? 'var(--color-primary)' : 'var(--color-secondary-hover)'}`}
            hoverFill={`${isFiltering ? 'var(--color-primary-hover)' : 'var(--color-secondary-active)'}`}
          />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {props.allowSort !== false ? (
          <>
            <DropdownMenuItem
              onSelect={() => {
                props.onSortColumns(props.columnKey, 'ASC');
              }}
            >
              昇順で並べ替え
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                props.onSortColumns(props.columnKey, 'DESC');
              }}
            >
              降順で並べ替え
            </DropdownMenuItem>
          </>
        ) : null}

        {props.filterOption && props.allowSort !== false && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>フィルター</DropdownMenuLabel>
          </>
        )}
        {props.filterOption && props.allowSort === false && (
          <DropdownMenuLabel>フィルター</DropdownMenuLabel>
        )}
        {props.filterOption && (
          <div className={`flex px-1 py-1 hover:bg-secondary rounded-sm`}>
            <Checkbox
              id={selectAllId}
              checked={allSelected}
              onCheckedChange={(checked: CheckedState) => {
                if (!props.filterOption) return;

                setSelectedRows(new Set());
                setCheckedFilters({
                  [filterKey]: checked === true ? props.filterOption : [],
                });
              }}
            />
            <Label className="ml-2" htmlFor={selectAllId}>
              すべて表示
            </Label>
          </div>
        )}
        {props.filterOption?.map((filter, index) => {
          const filterId = createUid(id, {
            prefix: 'filter',
            suffix: index.toString(),
          });

          const displayLabel = filter === '' ? '_入力なし' : filter;
          return (
            <div
              key={filterId}
              className={`flex p-1 hover:bg-secondary rounded-sm`}
            >
              <Checkbox
                id={filterId}
                checked={selectedValues.includes(filter)}
                onCheckedChange={(checked: CheckedState) => {
                  setSelectedRows(new Set());
                  updateFilter(filterKey, filter, checked);
                }}
              />
              <Label className="ml-2" htmlFor={filterId}>
                {displayLabel}
              </Label>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default DataListMenu;
