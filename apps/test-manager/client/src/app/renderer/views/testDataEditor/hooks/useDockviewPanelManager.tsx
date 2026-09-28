import useDockviewStore from '@views/testDataEditor/store/useDockviewStore';
import {
  type DockViewPanel,
  panel,
} from '@views/testDataEditor/types/dockviewType';
import type { AddPanelOptions, Direction, Parameters } from 'dockview-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type DockViewPanelManager = {
  defaultPanelOptions: Record<string, AddPanelOptions<Parameters>>;
  addPanelWithPosition: (panelName: DockViewPanel) => void;
  closePanel: (panelName: DockViewPanel) => void;
  isPanelOpen: (panelName: DockViewPanel) => boolean;
};

type PanelPositionRule = Record<
  string,
  {
    primary: { referencePanel: DockViewPanel; direction: Direction };
    fallback: { referencePanel: DockViewPanel; direction: Direction };
  }
>;

const useDockviewPanelManager = (): DockViewPanelManager => {
  const { dockviewApi } = useDockviewStore();
  const [openPanelIds, setOpenPanelIds] = useState<Set<DockViewPanel>>(
    new Set(),
  );

  const defaultPanelOptions: Record<
    string,
    AddPanelOptions<Parameters>
  > = useMemo(() => {
    return {
      questionEditor: {
        id: panel.questionEditor,
        component: panel.questionEditor,
        title: '問題編集',
        position: { direction: 'left' },
        tabComponent: 'hideClose',
      },
      imageAsset: {
        id: panel.imageAsset,
        component: panel.imageAsset,
        title: '画像アセット',
        position: {
          referencePanel: panel.questionEditor,
          direction: 'right',
          index: 1,
        },
      },
      preview: {
        id: panel.preview,
        component: panel.preview,
        title: 'プレビュー',
        tabComponent: 'previewDetachable',
        position: {
          referencePanel: panel.imageAsset,
          direction: 'within',
          index: 0,
        },
      },
    };
  }, []);

  const panelRules: PanelPositionRule = useMemo(() => {
    return {
      [panel.imageAsset]: {
        primary: { referencePanel: panel.preview, direction: 'within' },
        fallback: { referencePanel: panel.questionEditor, direction: 'right' },
      },
      [panel.preview]: {
        primary: { referencePanel: panel.imageAsset, direction: 'within' },
        fallback: { referencePanel: panel.questionEditor, direction: 'right' },
      },
    };
  }, []);

  useEffect(() => {
    if (!dockviewApi) {
      setOpenPanelIds(new Set());
      return;
    }

    const syncOpenPanels = () => {
      const nextOpenPanelIds = new Set<DockViewPanel>();

      for (const panelName of Object.values(panel)) {
        if (dockviewApi.getPanel(panelName)) {
          nextOpenPanelIds.add(panelName);
        }
      }

      setOpenPanelIds(nextOpenPanelIds);
    };

    syncOpenPanels();

    const disposeAddPanel = dockviewApi.onDidAddPanel(() => {
      syncOpenPanels();
    });
    const disposeRemovePanel = dockviewApi.onDidRemovePanel(() => {
      syncOpenPanels();
    });

    return () => {
      disposeAddPanel.dispose();
      disposeRemovePanel.dispose();
    };
  }, [dockviewApi]);

  const addPanelWithPosition = useCallback(
    (panelName: DockViewPanel) => {
      const rule = panelRules[panelName];
      const primaryReferencePanel = dockviewApi?.getPanel(
        rule.primary.referencePanel,
      );
      const targetPanel = dockviewApi?.getPanel(panelName);
      if (!targetPanel) {
        dockviewApi?.addPanel({
          ...defaultPanelOptions[panelName],
          floating: false,
          position: primaryReferencePanel ? rule.primary : rule.fallback,
        });
      }
    },
    [dockviewApi, defaultPanelOptions, panelRules],
  );

  const closePanel = useCallback(
    (panelName: DockViewPanel) => {
      const targetPanel = dockviewApi?.getPanel(panelName);
      if (!targetPanel) return;

      dockviewApi?.removePanel(targetPanel);
    },
    [dockviewApi],
  );

  const isPanelOpen = useCallback(
    (panelName: DockViewPanel) => openPanelIds.has(panelName),
    [openPanelIds],
  );

  return {
    defaultPanelOptions,
    addPanelWithPosition,
    closePanel,
    isPanelOpen,
  };
};

export default useDockviewPanelManager;
