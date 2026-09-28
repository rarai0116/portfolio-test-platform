import 'quill-resize-module/dist/resize.css';
import {
  ensureEditorParchmentRegistered,
  setupEditorClipboardMatchers,
  syncImgStyleToFormats,
} from '@api/editorParchment';
import { installFormulaTooltipExtension } from '@api/quillFormulaTooltip';
import {
  dangerouslyPasteHtmlPreservingSpaces,
  exportHtmlForPreview,
  restoreHtmlFromQuill,
} from '@api/quillUtils';
import { ensureResizeModule } from '@api/resizeModuleCustom';
import type { Delta } from '@renderer/types/quillType';
import Quill from 'quill';
import type { EmitterSource, Range } from 'quill/core';
// import QuillTableBetter from 'quill-table-better';
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type Props = {
  id: string;
  readOnly?: boolean;
  disableResizeModule?: boolean;
  value: string;
  onTextChange?: (delta: Delta, oldDelta: Delta, source: EmitterSource) => void;
  onSelectionChange?: (
    range: Range | null,
    oldRange: Range | null,
    source: EmitterSource,
  ) => void;
  onReady?: () => void;
  onInitError?: (error: unknown) => void;
};

// 親が呼べる命令ハンドル
export type EditorHandle = {
  setHtml: (html: string) => void;
  getHtml: () => string;
  getPreviewHtml: () => string;
  getQuill: () => Quill | null;
  setWidth: (widthPx: number) => void;
  resetHistory: () => void;
};

if (typeof window !== 'undefined' && !window.Quill) {
  window.Quill = Quill;
}

const parsePositiveNumber = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const markNaturalAspectImages = (root: HTMLElement): void => {
  root.querySelectorAll('img').forEach((img) => {
    const image = img as HTMLImageElement;
    if (
      image.classList.contains('active') ||
      image.classList.contains('selected') ||
      image.hasAttribute('data-size')
    ) {
      return;
    }

    const width = parsePositiveNumber(
      image.getAttribute('width') || image.style.width,
    );
    const height = parsePositiveNumber(
      image.getAttribute('height') || image.style.height,
    );

    if (!width || !height) {
      image.dataset.editorNaturalAspect = '1';
      return;
    }

    if (!image.naturalWidth || !image.naturalHeight) return;

    const naturalRatio = image.naturalWidth / image.naturalHeight;
    const specifiedRatio = width / height;
    const ratioDiff = Math.abs(specifiedRatio - naturalRatio) / naturalRatio;

    if (ratioDiff <= 0.02) {
      image.dataset.editorNaturalAspect = '1';
    } else {
      delete image.dataset.editorNaturalAspect;
    }
  });
};

// forwardRef の型を EditorHandle に
const Editor = forwardRef<EditorHandle, Props>(
  (
    {
      readOnly,
      disableResizeModule,
      value,
      onTextChange,
      onSelectionChange,
      onReady,
      onInitError,
    },
    ref,
  ) => {
    const id = useId();
    const containerRef = useRef<HTMLDivElement>(null);
    const quillRef = useRef<Quill | null>(null); // Quillインスタンスの保持
    const eventsBoundRef = useRef(false); // イベント多重登録防止
    const [resizeModuleState, setResizeModuleState] = useState<
      'pending' | 'enabled' | 'disabled'
    >(disableResizeModule ? 'disabled' : 'pending');

    const readyFiredRef = useRef(false); // onReadyの一度だけ送る準備完了発火フラグ

    const onTextChangeRef = useRef<Props['onTextChange']>(onTextChange);
    const onSelectionChangeRef =
      useRef<Props['onSelectionChange']>(onSelectionChange);

    const quillFormulaTooltipCleanupRef = useRef<(() => void) | null>(null);
    const normalizeImagesRafRef = useRef<number | null>(null);

    const scheduleNaturalAspectMarking = useCallback(() => {
      if (typeof window === 'undefined') return;
      if (normalizeImagesRafRef.current !== null) {
        window.cancelAnimationFrame(normalizeImagesRafRef.current);
      }
      normalizeImagesRafRef.current = window.requestAnimationFrame(() => {
        normalizeImagesRafRef.current = null;
        const root = quillRef.current?.root as HTMLElement | undefined;
        if (root) markNaturalAspectImages(root);
      });
    }, []);

    useLayoutEffect(() => {
      onTextChangeRef.current = onTextChange;
      onSelectionChangeRef.current = onSelectionChange;
    });

    // 読み取り専用切替は内部のquillRefで実行
    useEffect(() => {
      if (quillRef.current) {
        quillRef.current.enable(!readOnly);
        if (readOnly) {
          const resizer = (
            quillRef.current as Quill & {
              resizer?: { hide?: () => void };
            }
          ).resizer;
          resizer?.hide?.();
        }
      }
    }, [readOnly]);

    const toolbarOptions = useMemo(() => {
      return [
        [{ header: [1, 2, 3, 4, 5, 6, false] }],
        [{ align: [] }],
        ['bold', 'italic', 'underline', 'formula'],
        [{ script: 'sub' }, { script: 'super' }],
        [{ indent: '-1' }, { indent: '+1' }],
        //        ['table-better'],
        ['clean'],
      ];
    }, []);

    const isResizeModuleEnabled = resizeModuleState === 'enabled';
    const isEditorBootReady = resizeModuleState !== 'pending';

    const options = useMemo(() => {
      const modules: {
        table: false;
        toolbar: typeof toolbarOptions;
        history: {
          userOnly: true;
          delay: number;
          maxStack: number;
        };
        resize?: {
          modules: string[];
          keyboardSelect: false;
          selectedClass: string;
          activeClass: string;
          embedTags: string[];
          tools: string[];
          onActive?: (_blot: unknown, activeEle: HTMLElement) => void;
          onChangeSize?: (_blot: unknown, activeEle: HTMLElement) => void;
          parchment: {
            image: {
              attribute: string[];
              limit: {
                minWidth: number;
                ratio?: number;
              };
            };
          };
        };
      } = {
        table: false,
        toolbar: toolbarOptions,
        history: {
          userOnly: true,
          delay: 1000,
          maxStack: 2000,
        },
      };

      if (isResizeModuleEnabled) {
        modules.resize = {
          // Enable feature modules
          modules: ['DisplaySize', 'Toolbar', 'Resize'],

          // Enable keyboard arrow keys for selection
          keyboardSelect: false,

          // CSS classes for selected and active states
          selectedClass: 'selected',
          activeClass: 'active',

          // Resizable embedded tags (video and iframe by default)
          embedTags: ['VIDEO', 'IFRAME'],

          // Toolbar buttons (default: left align, center, right align, full width, edit)
          tools: ['left', 'center', 'right', 'resetSize'],

          onActive: (_blot, activeEle) => {
            const width = activeEle.offsetWidth;
            const height = activeEle.offsetHeight;
            const ratio = width > 0 && height > 0 ? height / width : 0;

            if (!modules.resize) return;

            if (ratio > 0) {
              modules.resize.parchment.image.limit.ratio = ratio;
            } else {
              delete modules.resize.parchment.image.limit.ratio;
            }
          },

          onChangeSize: (_blot, activeEle) => {
            delete activeEle.dataset.editorNaturalAspect;
            const quill = quillRef.current;
            if (quill) syncImgStyleToFormats(quill, activeEle);
          },

          // Parchment configuration: set attributes and limits for different element types
          parchment: {
            // Image configuration
            image: {
              attribute: ['width', 'height'], // Adjustable attributes
              limit: {
                minWidth: 10, // Minimum width limit
              },
            },
          },
        };
      }

      return {
        theme: 'snow',
        modules,
      };
    }, [isResizeModuleEnabled, toolbarOptions]);
    // 外部から固定幅を強制するための記憶＋適用
    const forcedWidthRef = useRef<number | null>(null);
    const applyWidthPx = useCallback((w: number) => {
      forcedWidthRef.current = Number.isFinite(w)
        ? Math.max(0, Math.floor(w))
        : null;
      const el = quillRef.current?.root as HTMLElement | undefined;
      if (!el || forcedWidthRef.current == null) return;
      el.style.boxSizing = 'border-box';
      el.style.width = `${forcedWidthRef.current}px`;
    }, []);

    // エディタ構築 + 初期HTMLセット
    const updateContainer = useCallback(
      (html: string) => {
        const container = containerRef.current;
        if (!container) return { quill: null, container: null };

        if (!quillRef.current) {
          const toolTip = container.parentNode?.querySelector('.ql-toolbar');
          if (toolTip) container.parentNode?.removeChild(toolTip);

          ensureEditorParchmentRegistered();
          const boundsElement = container.closest(
            '[data-editor-bounds]',
          ) as HTMLElement | null;
          const quill = new Quill(container, {
            ...options,
            bounds: boundsElement ?? undefined,
          });

          setupEditorClipboardMatchers(quill);

          quillFormulaTooltipCleanupRef.current?.();
          quillFormulaTooltipCleanupRef.current =
            installFormulaTooltipExtension(quill);

          if (html) dangerouslyPasteHtmlPreservingSpaces(quill, html, 'api');
          scheduleNaturalAspectMarking();

          if (!eventsBoundRef.current) {
            quill.on(Quill.events.TEXT_CHANGE, (...args) => {
              onTextChangeRef.current?.(...args);
              scheduleNaturalAspectMarking();
            });
            quill.on(Quill.events.SELECTION_CHANGE, (...args) => {
              onSelectionChangeRef.current?.(...args);
            });
            eventsBoundRef.current = true;
          }

          quillRef.current = quill;
          quill.root.addEventListener(
            'load',
            scheduleNaturalAspectMarking,
            true,
          );

          // 外部制御が入っていれば適用（入っていなければ CSS に任せる）
          if (forcedWidthRef.current != null)
            applyWidthPx(forcedWidthRef.current);

          return { quill, container };
        } else {
          dangerouslyPasteHtmlPreservingSpaces(quillRef.current, html, 'api');
          scheduleNaturalAspectMarking();
          if (forcedWidthRef.current != null)
            applyWidthPx(forcedWidthRef.current);
          return { quill: quillRef.current, container };
        }
      },
      [options, applyWidthPx, scheduleNaturalAspectMarking],
    );

    // 初期構築
    // biome-ignore lint/correctness/useExhaustiveDependencies: optionsの変更時に再構築
    useEffect(() => {
      if (!isEditorBootReady) return;
      const { quill, container } = updateContainer(value);
      if (!quill || !container) return;
      return () => {
        if (normalizeImagesRafRef.current !== null) {
          window.cancelAnimationFrame(normalizeImagesRafRef.current);
          normalizeImagesRafRef.current = null;
        }
        quill.root.removeEventListener(
          'load',
          scheduleNaturalAspectMarking,
          true,
        );
        quillFormulaTooltipCleanupRef.current?.();
        quillFormulaTooltipCleanupRef.current = null;
        quillRef.current = null;
        eventsBoundRef.current = false;
        if (container) container.innerHTML = '';
      };
    }, [options, isEditorBootReady]);

    // リサイズモジュールの準備を最初に実行
    useEffect(() => {
      if (disableResizeModule) {
        setResizeModuleState('disabled');
        return;
      }

      let mounted = true;
      (async () => {
        try {
          await ensureResizeModule();
          if (mounted) setResizeModuleState('enabled');
        } catch (e) {
          console.error('Failed to load image resize module:', e);
          onInitError?.(e);
          if (mounted) setResizeModuleState('disabled');
        }
      })();
      return () => {
        mounted = false;
      };
    }, [disableResizeModule, onInitError]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: 準備完了時に一度だけ
    useEffect(() => {
      if (!isEditorBootReady) return;
      const { quill, container } = updateContainer(value);
      if (!quill || !container) return;

      // 初期化完了を一度だけ通知
      if (!readyFiredRef.current) {
        readyFiredRef.current = true;
        try {
          onReady?.();
        } catch {
          // ignore
        }
      }

      return () => {
        if (normalizeImagesRafRef.current !== null) {
          window.cancelAnimationFrame(normalizeImagesRafRef.current);
          normalizeImagesRafRef.current = null;
        }
        quill.root.removeEventListener(
          'load',
          scheduleNaturalAspectMarking,
          true,
        );
        quillFormulaTooltipCleanupRef.current?.();
        quillFormulaTooltipCleanupRef.current = null;
        quillRef.current = null;
        eventsBoundRef.current = false;
        if (container) container.innerHTML = '';
      };
    }, [options, isEditorBootReady]);

    // 親に公開する命令ハンドル
    useImperativeHandle(
      ref,
      () => ({
        setHtml: (html: string, isApi?: boolean) => {
          const q = quillRef.current;
          const prevSel = q?.getSelection();
          const prevScrollTop = q?.root?.scrollTop ?? 0;

          if (q) {
            dangerouslyPasteHtmlPreservingSpaces(
              q,
              html,
              isApi ? 'api' : 'silent',
            );
            if (forcedWidthRef.current != null)
              applyWidthPx(forcedWidthRef.current);
            try {
              if (prevSel)
                q.setSelection(prevSel.index, prevSel.length, 'silent');
              if (q.root) q.root.scrollTop = prevScrollTop;
            } catch {
              // ignore
            }
          } else {
            updateContainer(html);
          }
        },
        getHtml: () => {
          const result = quillRef.current
            ? restoreHtmlFromQuill(quillRef.current.root.innerHTML)
            : '';
          return result;
        },
        getPreviewHtml: () => {
          return quillRef.current
            ? exportHtmlForPreview(quillRef.current.root.innerHTML)
            : '';
        },
        getQuill: () => quillRef.current,
        setWidth: (widthPx: number) => {
          applyWidthPx(widthPx);
        },
        resetHistory: () => {
          const mod = quillRef.current?.getModule('history') as
            | { clear: () => void }
            | undefined;
          mod?.clear();
        },
      }),
      [updateContainer, applyWidthPx],
    );

    return (
      <div
        ref={containerRef}
        id={id}
        className="editor-container w-full min-w-0"
      ></div>
    );
  },
);

Editor.displayName = 'Editor';
export default Editor;
