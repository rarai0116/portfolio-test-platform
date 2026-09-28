import type { CheckedState } from '@radix-ui/react-checkbox';
import { Label } from '@ui/label';
import DataListContextMenu from '@views/testDataList/organisms/dataListContextMenu';
import DataListMenu from '@views/testDataList/organisms/dataListMenu';
import useDataGridStore from '@views/testDataList/stores/useDataGridStore';
import type { FilterStateKey } from '@views/testDataList/types/reactGridDataTypes';
import React, { useRef } from 'react';
import type { RenderHeaderCellProps, SortDirection } from 'react-data-grid';

interface HeaderCellProps<R> extends RenderHeaderCellProps<R, unknown> {
  allowSort?: boolean;
  onCheckedChange?: (
    key: FilterStateKey,
    value: string,
    checked: CheckedState,
  ) => void;
  filterOption?: string[];
  selectStopPropagation: (event: React.KeyboardEvent<HTMLElement>) => void;
  dragProps?: {
    onDragEnter: (event: React.DragEvent<HTMLDivElement>, idx: number) => void;
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
    onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
    onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  };
  onSortColumns: (clickedKey: string, direction: SortDirection) => void;
}

const HeaderCell = <R,>(props: HeaderCellProps<R>) => {
  const { dragHighLightIndex } = useDataGridStore();
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} className="h-full w-full">
      <DataListContextMenu
        columnKey={props.column.key}
        index={props.column.idx}
      >
        <div className="flex w-full h-full ">
          <div
            className={`${dragHighLightIndex === props.column.idx ? 'custom-drag-over' : ''} w-3 h-full`}
          />
          {/* biome-ignore lint/a11y/noStaticElementInteractions: ドラッグしたか検知するため */}
          <div
            className={`w-[calc(100%-16px)] h-full flex flex-col justify-center py-1 bg-secondary pr-3`}
            onDragEnter={
              props.dragProps
                ? (event) =>
                    props.dragProps?.onDragEnter(event, props.column.idx)
                : undefined
            }
            onDragOver={props.dragProps?.onDragOver}
            onDragLeave={props.dragProps?.onDragLeave}
            onDrop={props.dragProps?.onDrop}
          >
            <div className=" flex justify-between items-center gap-0.5">
              <Label className="w-full block text-foreground text-center font-bold">
                {props.column.name}
              </Label>
              <DataListMenu
                allowSort={props.allowSort}
                columnKey={props.column.key}
                onSortColumns={props.onSortColumns}
                filterOption={props.filterOption}
                onCheckedChange={props.onCheckedChange}
              />
            </div>
          </div>
        </div>
      </DataListContextMenu>
    </div>
  );
};

const HeaderCellMemo = React.memo(HeaderCell) as typeof HeaderCell;

export default HeaderCellMemo as typeof HeaderCell;
