import useCreatePdfDockviewStore from '@views/createPdf/store/useCreatePdfDockviewStore';
import {
  type CreatePdfPanelId,
  createPdfPanel,
} from '@views/createPdf/types/dockviewType';
import type { CreatePdfRouteMode } from '@views/createPdf/types/viewState';
import type { AddPanelOptions, Direction, Parameters } from 'dockview-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type PanelPositionRule = Record<
  CreatePdfPanelId,
  {
    primary: { referencePanel: CreatePdfPanelId; direction: Direction };
    fallback: { direction: Direction };
  }
>;

const useCreatePdfDockviewPanelManager = (routeMode: CreatePdfRouteMode) => {
  const dockviewApi = useCreatePdfDockviewStore((state) => state.dockviewApi);
  const [openPanelIds, setOpenPanelIds] = useState<Set<CreatePdfPanelId>>(
    new Set(),
  );

  // routeMode に対応するメインパネル ID
  const mainPanelId =
    routeMode === 'tempExam'
      ? createPdfPanel.tempExam
      : routeMode === 'exam'
        ? createPdfPanel.exam
        : routeMode === 'tempWorkbook'
          ? createPdfPanel.tempWorkbook
          : createPdfPanel.workbook;

  const defaultPanelOptions = useMemo<
    Record<string, AddPanelOptions<Parameters>>
  >(
    () => ({
      [mainPanelId]: {
        id: mainPanelId,
        component: mainPanelId,
        title: '条件設定',
        position: { direction: 'left' },
      },
      [createPdfPanel.testTable]: {
        id: createPdfPanel.testTable,
        component: createPdfPanel.testTable,
        title: '問題テーブル',
        position: {
          direction: 'right',
          referencePanel: mainPanelId,
        },
      },
    }),
    [mainPanelId],
  );

  const panelRules: PanelPositionRule = useMemo(
    () => ({
      [createPdfPanel.exam]: {
        primary: {
          referencePanel: mainPanelId,
          direction: 'left',
        },
        fallback: {
          direction: 'left',
        },
      },
      [createPdfPanel.tempExam]: {
        primary: {
          referencePanel: mainPanelId,
          direction: 'left',
        },
        fallback: {
          direction: 'left',
        },
      },
      [createPdfPanel.tempWorkbook]: {
        primary: {
          referencePanel: mainPanelId,
          direction: 'left',
        },
        fallback: {
          direction: 'left',
        },
      },
      [createPdfPanel.workbook]: {
        primary: {
          referencePanel: mainPanelId,
          direction: 'left',
        },
        fallback: {
          direction: 'left',
        },
      },
      [createPdfPanel.testTable]: {
        primary: {
          referencePanel: mainPanelId,
          direction: 'right',
        },
        fallback: {
          direction: 'right',
        },
      },
    }),
    [mainPanelId],
  );

  useEffect(() => {
    if (!dockviewApi) {
      setOpenPanelIds(new Set());
      return;
    }

    const syncOpenPanels = () => {
      const nextOpenPanelIds = new Set<CreatePdfPanelId>();

      for (const panelId of Object.values(createPdfPanel)) {
        if (dockviewApi.getPanel(panelId)) {
          nextOpenPanelIds.add(panelId);
        }
      }

      setOpenPanelIds(nextOpenPanelIds);
    };

    syncOpenPanels();

    const disposeAddPanel = dockviewApi.onDidAddPanel(syncOpenPanels);
    const disposeRemovePanel = dockviewApi.onDidRemovePanel(syncOpenPanels);

    return () => {
      disposeAddPanel.dispose();
      disposeRemovePanel.dispose();
    };
  }, [dockviewApi]);

  // パネルを開く関数。すでに開いている場合は何もしない。将来で使用予定
  const addPanelWithPosition = useCallback(
    (panelId: CreatePdfPanelId) => {
      const rule = panelRules[panelId];
      const referencePanel = dockviewApi?.getPanel(rule.primary.referencePanel);
      const targetPanel = dockviewApi?.getPanel(panelId);
      const option = defaultPanelOptions[panelId];

      // 現在のモードにないパネルは追加しない
      if (!option) return;

      if (!targetPanel) {
        dockviewApi?.addPanel({
          ...option,
          floating: false,
          position: referencePanel ? rule.primary : rule.fallback,
        });
      }
    },
    [defaultPanelOptions, dockviewApi, panelRules],
  );

  // パネルを閉じる関数。将来で使用予定
  const closePanel = useCallback(
    (panelId: CreatePdfPanelId) => {
      const targetPanel = dockviewApi?.getPanel(panelId);
      if (!targetPanel) return;
      dockviewApi?.removePanel(targetPanel);
    },
    [dockviewApi],
  );

  // 指定したパネルが開いているか。将来で使用予定
  const isPanelOpen = useCallback(
    (panelId: CreatePdfPanelId) => openPanelIds.has(panelId),
    [openPanelIds],
  );

  return {
    defaultPanelOptions,
    addPanelWithPosition,
    closePanel,
    isPanelOpen,
  };
};

export default useCreatePdfDockviewPanelManager;
