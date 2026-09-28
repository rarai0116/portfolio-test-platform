import useDataGridStyleStore from '@views/testDataList/stores/useDataGridStyleStore';
import { useCallback, useMemo } from 'react';
import type { DataGridHandle } from 'react-data-grid';

type DataGridStyleState = {
  renderBorder: (dataGridRef: React.RefObject<DataGridHandle | null>) => void;
};

const useDataGridStyle = (): DataGridStyleState => {
  const { frozenIndex } = useDataGridStyleStore();

  // aria-colindexは1始まりなので、frozenIndexに1を足す
  const selectors = useMemo(() => {
    return {
      header: `[role="columnheader"][aria-colindex="${frozenIndex + 1}"]`,
      cell: `[aria-colindex="${frozenIndex + 1}"]:not([role="columnheader"])`,
    };
  }, [frozenIndex]);

  const renderBorder = useCallback(
    (dataGridRef: React.RefObject<DataGridHandle | null>) => {
      const element = dataGridRef.current?.element;
      if (!element) return;
      const allCells = element.querySelectorAll(
        `.custom-frozen-header-border, .custom-frozen-border, ${selectors.header}, ${selectors.cell}`,
      );
      Array.from(allCells).forEach((cell) => {
        if (!(cell instanceof HTMLElement)) return;

        // 全てのカスタムクラスをremove
        cell.classList.remove(
          'custom-frozen-header-border',
          'custom-frozen-border',
        );

        // 必要なクラスをadd
        if (cell.matches(selectors.header)) {
          cell.classList.add('custom-frozen-header-border');
        } else if (cell.matches(selectors.cell)) {
          cell.classList.add('custom-frozen-border');
        }
      });
    },
    [selectors],
  );

  return { renderBorder };
};

export default useDataGridStyle;
