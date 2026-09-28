import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@ui/contextMenu';
import useDataGridStyleStore from '@views/testDataList/stores/useDataGridStyleStore';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  columnKey: string;
  index: number;
};

const DataListContextMenu = (props: Props) => {
  const { setFrozenIndex } = useDataGridStyleStore();
  return (
    <ContextMenu>
      <ContextMenuTrigger>{props.children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={() => {
            setFrozenIndex(props.index);
          }}
        >
          この列で固定
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default DataListContextMenu;
