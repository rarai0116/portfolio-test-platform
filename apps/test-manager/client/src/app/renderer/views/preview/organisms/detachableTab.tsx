import CrossIcon from '@components/icons/crossIcon';
import FloatIcon from '@components/icons/floatIcon';
import { panel } from '@views/testDataEditor/types/dockviewType';
import type { IDockviewPanelHeaderProps } from 'dockview-react';
import { useEffect, useRef } from 'react';

const PREVIEW_DETACH_EVENT = 'preview:detach-request';

export const PreviewDetachableTab = ({
  props,
}: {
  props: IDockviewPanelHeaderProps;
}) => {
  const isPointerDownRef = useRef(false);

  const {
    api,
    containerApi: _containerApi,
    params: _params,
    tabLocation: _tabLocation,
  } = props;

  useEffect(() => {
    const handleDragEnd = (event: DragEvent) => {
      console.info('Preview tab drag ended event:', event);

      if (!isPointerDownRef.current) return;
      isPointerDownRef.current = false;

      if (api.id !== panel.preview) return;

      const outerLeft = window.screenX;
      const outerTop = window.screenY;

      const frameX = Math.max(0, (window.outerWidth - window.innerWidth) / 2);
      const frameBottom = frameX;
      const frameTop = Math.max(
        0,
        window.outerHeight - window.innerHeight - frameBottom,
      );

      const contentLeft = outerLeft + frameX;
      const contentTop = outerTop + frameTop;
      const contentRight = contentLeft + window.innerWidth;
      const contentBottom = contentTop + window.innerHeight;

      const detachMargin = 24;
      const { screenX, screenY } = event;

      const isOutsideWindow =
        screenX < contentLeft - detachMargin ||
        screenX > contentRight + detachMargin ||
        screenY < contentTop - detachMargin ||
        screenY > contentBottom + detachMargin;

      console.log(
        'Preview tab drag ended:',
        { screenX, screenY },
        'Content bounds:',
        {
          contentLeft,
          contentRight,
          contentTop,
          contentBottom,
          frameX,
          frameTop,
          frameBottom,
          detachMargin,
        },
        'Is outside window:',
        isOutsideWindow,
      );

      if (!isOutsideWindow) return;

      console.log('Detaching preview panel to new window');
      window.dispatchEvent(new CustomEvent(PREVIEW_DETACH_EVENT));
    };

    /*
    const handleWindowBlur = () => {
      if (!isPointerDownRef.current) return;

      isPointerDownRef.current = false;

      if (api.id !== panel.preview) return;

      console.log('Window blurred while dragging preview tab, detaching');
      window.dispatchEvent(new CustomEvent(PREVIEW_DETACH_EVENT));
    };
    */

    document.addEventListener('dragend', handleDragEnd, true);
    // window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('dragend', handleDragEnd, true);
      // window.removeEventListener('blur', handleWindowBlur);
    };
  }, [api.id]);

  return (
    <div
      data-testid="dockview-dv-default-tab"
      className="dv-default-tab"
      onPointerDown={(event) => {
        if (api.id === panel.preview && event.button === 0) {
          isPointerDownRef.current = true;
          console.info('Preview tab pointer down:', event.button);
        }
      }}
      onPointerUp={() => {
        console.info('Preview tab pointer up');
        isPointerDownRef.current = false;
      }}
    >
      <span className="dv-default-tab-content">{api.title}</span>

      {api.location.type === 'grid' && (
        <button
          type="button"
          className="dv-default-tab-action"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            window.dispatchEvent(new CustomEvent(PREVIEW_DETACH_EVENT));
          }}
          title="別ウィンドウで表示"
          aria-label="別ウィンドウで表示"
        >
          <FloatIcon />
        </button>
      )}

      <button
        type="button"
        className="dv-default-tab-action"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          api.close();
        }}
        title="閉じる"
        aria-label="閉じる"
      >
        <CrossIcon />
      </button>
    </div>
  );
};
