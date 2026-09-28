import { useTypedFirestoreHandler } from '@hooks/useTypedFirestoreHandler';
import type { TestData, Version } from '@shared/types/contracts';
import useDataGridColumns from '@views/testDataList/hooks/useDataGridColumns';
import useDataGridRows from '@views/testDataList/hooks/useDataGridRows';
import useDataGridStore from '@views/testDataList/stores/useDataGridStore';
import useDataGridStyleStore from '@views/testDataList/stores/useDataGridStyleStore';
import type { Row } from '@views/testDataList/types/reactGridDataTypes';
import { useCallback } from 'react';
import type { Column } from 'react-data-grid';
import { useShallow } from 'zustand/react/shallow'; // 追加

type GridData = {
  docs: { path: string; data?: TestData; updateTime: Version }[];
  loading: boolean;
  filteredAndSortedRows: Row[];
  reorderedColumns: Column<Row>[];
  onColumnsReorder: (sourceKey: string, targetKey: string) => void;
  resetOrderAndWidths: () => void;
  unsubscribe: () => Promise<void>;
  subscribe: () => Promise<void>;
  refresh: () => Promise<void>;
  update: (idOrPath: string, data: Partial<TestData>) => Promise<string>;
};

const useDataGrid = (): GridData => {
  const { grade } = useDataGridStore(
    useShallow((s) => ({
      grade: s.grade,
      sortColumns: s.sortColumns,
    })),
  );
  const { setColumnWidths, setColumnsOrder } = useDataGridStyleStore(
    useShallow((s) => ({
      setColumnWidths: s.setColumnWidths,
      setColumnsOrder: s.setColumnsOrder,
    })),
  );
  const handler = useTypedFirestoreHandler(grade, {
    autoSubscribe: true,
    includeOutbox: true,
  });

  const { docs, loading } = handler;

  const { filteredAndSortedRows } = useDataGridRows(docs);
  const { reorderedColumns, onColumnsReorder, initialColumnsOrder } =
    useDataGridColumns(docs, filteredAndSortedRows, loading);

  const resetOrderAndWidths = useCallback(() => {
    setColumnsOrder(initialColumnsOrder);
    setColumnWidths(new Map());
  }, [initialColumnsOrder, setColumnWidths, setColumnsOrder]);

  return {
    docs,
    loading: handler.loading,
    filteredAndSortedRows,
    reorderedColumns,
    onColumnsReorder,
    resetOrderAndWidths,
    unsubscribe: handler.unsubscribe,
    subscribe: handler.subscribe,
    refresh: handler.refresh,
    update: handler.update,
  };
};

export default useDataGrid;
