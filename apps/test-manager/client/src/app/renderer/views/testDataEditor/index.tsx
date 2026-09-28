import 'dockview-react/dist/styles/dockview.css';
import usePanelOption from '@views/testDataEditor/hooks/useDockviewPanelManager';
import useDockviewStore from '@views/testDataEditor/store/useDockviewStore';
import useSelectedDataDisplayStore from '@views/testDataEditor/store/useSelectedDataDisplayStore';
import useSelectedIdStore from '@views/testDataEditor/store/useSelectedIdStore';
import {
  DockviewReact,
  type DockviewReadyEvent,
  themeLightSpaced,
} from 'dockview-react';
import { useLocation } from 'react-router';
import 'katex/dist/katex.min.css';
import '@styles/katexFont.css';
import '@styles/katexOverride.css';
import { useGlobalLoading } from '@renderer/hooks/useGlobalLoading';
import type { QuestionEditorLocationState } from '@shared/types/router';
import useImageAssetStore from '@stores/useImageAssetStore';
import { PreviewDetachableTab } from '@views/preview/organisms/detachableTab';
import useImageAssetList from '@views/testDataEditor/hooks/useImageAssetList';
import ImageAssetPanel from '@views/testDataEditor/templates/imageAssetPanel';
import PreviewPanel from '@views/testDataEditor/templates/previewPanel';
import QuestionEditorPanel from '@views/testDataEditor/templates/questionEditorPanel';
import { panel } from '@views/testDataEditor/types/dockviewType';
import {
  DockviewDefaultTab,
  type IDockviewPanelHeaderProps,
  type IDockviewPanelProps,
} from 'dockview-react';
import katex from 'katex';
import { useCallback, useEffect, useMemo, useRef } from 'react';

window.katex = katex;

const QuestionEditor = () => {
  const { setDockviewApi } = useDockviewStore();
  const { defaultPanelOptions, addPanelWithPosition } = usePanelOption();
  const { grade, idList } = useLocation().state as QuestionEditorLocationState;
  const { setSelectedIdList, setSelectedDataId, setSelectedGrade } =
    useSelectedIdStore();
  const setDisplayEntries = useSelectedDataDisplayStore(
    (state) => state.setDisplayEntries,
  );
  const setImageItems = useImageAssetStore((s) => s.setImageItems);
  const { _imageItems } = useImageAssetList();

  const { show, hide } = useGlobalLoading();

  const loadingIdRef = useRef<string | null>(null);
  const dockviewWrapperRef = useRef<HTMLDivElement | null>(null);
  const quillReadyRef = useRef(false);
  const previewReadyRef = useRef(false);
  const imagesReadyRef = useRef(false);
  const initialLoadingClosedRef = useRef(false);

  const tryCloseInitialLoading = useCallback(() => {
    if (initialLoadingClosedRef.current) return;
    if (
      !quillReadyRef.current
      //      || !previewReadyRef.current
      //      || !imagesReadyRef.current
    )
      return;

    initialLoadingClosedRef.current = true;

    if (loadingIdRef.current) {
      hide(loadingIdRef.current);
      loadingIdRef.current = null;
    }
  }, [hide]);

  const stringIdList = useMemo(
    () => idList.map((item) => item.no.toString()),
    [idList],
  );

  const components = useMemo(
    () => ({
      questionEditor: (_props: IDockviewPanelProps) => (
        <QuestionEditorPanel
          onInitialEditorsReady={() => {
            quillReadyRef.current = true;
            tryCloseInitialLoading();
          }}
          onInitialEmbeddedImagesReady={() => {
            imagesReadyRef.current = true;
            tryCloseInitialLoading();
          }}
        />
      ),
      imageAsset: (_props: IDockviewPanelProps) => <ImageAssetPanel />,
      preview: (_props: IDockviewPanelProps) => (
        <PreviewPanel
          onInitialFullRenderDone={() => {
            previewReadyRef.current = true;
            tryCloseInitialLoading();
          }}
        />
      ),
    }),
    [tryCloseInitialLoading],
  );

  const tabComponents = useMemo(
    () => ({
      hideClose: (props: IDockviewPanelHeaderProps) => {
        return <DockviewDefaultTab hideClose={true} {...props} />;
      },
      previewDetachable: (props: IDockviewPanelHeaderProps) => {
        return <PreviewDetachableTab props={props} />;
      },
    }),
    [],
  );

  // 初回ローディング開始
  // biome-ignore lint/correctness/useExhaustiveDependencies: idList変更時・初回のみ実行したい
  useEffect(() => {
    quillReadyRef.current = false;
    previewReadyRef.current = false;
    initialLoadingClosedRef.current = false;
    imagesReadyRef.current = false;

    loadingIdRef.current = show('問題編集画面を初期化中…');

    return () => {
      if (loadingIdRef.current) {
        hide(loadingIdRef.current);
        loadingIdRef.current = null;
      }
    };
  }, [stringIdList]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: useEffectのため
  useEffect(() => {
    setImageItems(() => _imageItems);
  }, [_imageItems]);

  useEffect(() => {
    const off = window.preview.onWindowClosed(() => {
      addPanelWithPosition(panel.preview);
    });

    return () => off();
  }, [addPanelWithPosition]);

  const onReady = (event: DockviewReadyEvent) => {
    /*
    const stringIdList = idList.map((id) =>
      id === null ? 'null' : id.toString(),
    );
    */
    setSelectedGrade(grade);
    setSelectedIdList(stringIdList);
    console.warn('Setting selected data ID list:', idList);
    setDisplayEntries(
      idList.map((item) => ({
        id: item.no.toString(),
        name: item.name,
        status: item.status,
      })),
    );
    setSelectedDataId(stringIdList[0]);
    setDockviewApi(event.api);
    Object.values(defaultPanelOptions).forEach((option) => {
      event.api.addPanel(option);
    });
  };
  return (
    <div ref={dockviewWrapperRef} className="h-full w-full">
      <DockviewReact
        singleTabMode="fullwidth"
        theme={themeLightSpaced}
        components={components}
        tabComponents={tabComponents}
        onReady={onReady}
      />
    </div>
  );
};

export default QuestionEditor;
