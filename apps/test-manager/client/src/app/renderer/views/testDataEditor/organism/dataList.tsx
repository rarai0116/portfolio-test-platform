import ListItem from '@parts/listItem';
import { getSelectedDataTextClassName } from '@views/testDataEditor/api/selectedDataDisplay';
import useSelectedDataDisplayStore from '@views/testDataEditor/store/useSelectedDataDisplayStore';
import React from 'react';
import { useShallow } from 'zustand/react/shallow';

type Props = {
  idList: string[];
  selectedId: string | undefined;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  dirtyIdSet?: Set<string>;
};

const DataList = React.memo(
  (props: Props) => {
    const displayEntries = useSelectedDataDisplayStore(
      useShallow((state) => props.idList.map((id) => state.displayMap[id])),
    );

    return (
      <div className="flex flex-col">
        {props.idList.map((id, index) => {
          const isDirty = props.dirtyIdSet?.has(id);
          const entry = displayEntries[index];
          // console.log(`Rendering ListItem for id=${id}, isDirty=${isDirty}`);
          // console.log('Current dirtyIdSet:', props.dirtyIdSet); // 追加: dirtyIdSetの内容をログ出力
          return (
            <ListItem
              key={id}
              id={id}
              text={entry?.name ?? ''}
              textClassName={
                entry ? getSelectedDataTextClassName(entry.status) : undefined
              }
              size="small"
              isSelected={id === props.selectedId}
              suffix={
                isDirty ? (
                  <div className="w-2 h-2 rounded-full bg-demoblue-200" />
                ) : entry?.status === '準備中' ? (
                  <div className="w-2 h-2 rounded-full bg-warning-icon" />
                ) : undefined
              }
              onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                props.onClick(event);
              }}
            />
          );
        })}
      </div>
    );
  },
  (prev, next) =>
    prev.idList === next.idList &&
    prev.selectedId === next.selectedId &&
    prev.dirtyIdSet === next.dirtyIdSet &&
    prev.onClick === next.onClick,
);

export default DataList;
