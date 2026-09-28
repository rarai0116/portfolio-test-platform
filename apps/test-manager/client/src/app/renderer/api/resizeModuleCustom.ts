import { syncImgStyleToFormats } from '@api/editorParchment';
import Quill from 'quill';

if (typeof window !== 'undefined' && !window.Quill) {
  window.Quill = Quill;
}

// 画像リサイズモジュールの初期化完了フラグ
const resizeReadyRef = { current: false };

type AlignmentToolName = 'left' | 'center' | 'right';
type QuillResizeClassLike = {
  prototype: {
    quill?: Quill;
    hide?: () => void;
    handleClick?: (evt: MouseEvent) => void;
  };
  Modules?: {
    Toolbar?: ToolbarClassLike;
    Resize?: {
      prototype: {
        quill?: Quill;
        handleMousedown?: (evt: MouseEvent) => void;
      };
    };
  };
};
type ToolbarClassLike = import('quill-resize-module').ToolbarClass;

function isQuillEditable(quill?: Quill | null): boolean {
  return typeof quill?.isEnabled === 'function' ? quill.isEnabled() : true;
}

export async function ensureResizeModule(): Promise<void> {
  if (resizeReadyRef.current) return;

  // 変更: dist の JS を動的 import（SCSSを読まない）
  await import('quill-resize-module');

  type ToolbarClass = import('quill-resize-module').ToolbarClass;
  type ToolbarInstance = import('quill-resize-module').ToolbarInstance;
  type ResizeImport = {
    Modules?: {
      Toolbar?: ToolbarClass;
    };
  };
  // export 形の差を吸収
  /* const Resize =
    mod?.default ??
    mod?.ResizeModule ??
    (typeof mod === 'function' ? mod : undefined);
    */

  // 登録済みモジュール名の候補（ライブラリ差異に対応）
  const moduleNames = ['modules/resize', 'modules/imageResize'];

  // 自己登録済みなら Quill.import 経由でクラスを取得
  let ResizeClass: unknown = null; //Resize;
  let _RegisteredName: string | null = null;
  //  if (!ResizeClass) {
  for (const name of moduleNames) {
    try {
      const cls = Quill.import(name);
      if (cls) {
        ResizeClass = cls;
        _RegisteredName = name;
        break;
      }
    } catch {
      // Quill.import で未登録の場合は例外になるため無視して次へ
    }
  }
  if (!ResizeClass) {
    throw new Error('Resize module export not found.');
  }

  const resizeModuleClass = ResizeClass as QuillResizeClassLike;
  const originalHandleClick = resizeModuleClass.prototype.handleClick;
  if (originalHandleClick) {
    resizeModuleClass.prototype.handleClick = function (evt: MouseEvent) {
      if (!isQuillEditable(this.quill)) {
        this.hide?.();
        return;
      }

      return originalHandleClick.call(this, evt);
    };
  }

  const resizeDragModule = resizeModuleClass.Modules?.Resize;
  const originalHandleMousedown = resizeDragModule?.prototype.handleMousedown;
  if (resizeDragModule && originalHandleMousedown) {
    resizeDragModule.prototype.handleMousedown = function (evt: MouseEvent) {
      if (!isQuillEditable(this.quill)) return;

      return originalHandleMousedown.call(this, evt);
    };
  }
  /*  } else {
    // エクスポートから取得できた場合は念のため登録（重複時は Quill 側が上書き扱い）
    Quill.register('modules/resize', ResizeClass);
  }
*/
  //  console.warn('Resize module class:', RegistedName);

  // ツールバー拡張（存在する場合のみ）
  try {
    const mod = Quill.import(
      _RegisteredName ?? 'modules/resize',
    ) as ResizeImport;
    // hoge
    const Toolbar: ToolbarClass | undefined =
      //      Resize?.Modules?.Toolbar ??
      mod.Modules?.Toolbar;
    if (Toolbar) {
      const setToolbarButtonActive = (
        toolbar: HTMLElement,
        name: AlignmentToolName,
        active: boolean,
      ) => {
        const button = toolbar.querySelector(
          `.ql-resize-toolbar-${name}`,
        ) as HTMLButtonElement | null;
        button?.classList.toggle('active', active);
      };

      const isLeft = (img?: HTMLElement | null) => {
        if (!img) return false;
        const s = img.style;
        return (
          s.display === 'inline' &&
          s.float === 'left' &&
          s.marginTop === '0px' &&
          s.marginRight === '1em' &&
          s.marginBottom === '1em' &&
          s.marginLeft === '0px'
        );
      };

      const isRight = (img?: HTMLElement | null) => {
        if (!img) return false;
        const s = img.style;
        return (
          s.display === 'inline' &&
          s.float === 'right' &&
          s.marginTop === '0px' &&
          s.marginRight === '0px' &&
          s.marginBottom === '1em' &&
          s.marginLeft === '1em'
        );
      };

      const isCenter = (img?: HTMLElement | null) => {
        if (!img) return false;
        const s = img.style;
        return (
          s.display === 'block' &&
          !s.float &&
          s.marginLeft === 'auto' &&
          s.marginRight === 'auto'
        );
      };

      const refreshAlignmentButtonState = (
        toolbar: HTMLElement,
        img?: HTMLElement | null,
      ) => {
        setToolbarButtonActive(toolbar, 'left', isLeft(img));
        setToolbarButtonActive(toolbar, 'center', isCenter(img));
        setToolbarButtonActive(toolbar, 'right', isRight(img));
      };

      const toggleLeft = (img: HTMLElement) => {
        const s = img.style;
        const on = isLeft(img);
        if (on) {
          s.removeProperty('float');
          s.removeProperty('margin');
          s.removeProperty('display');
        } else {
          s.display = 'inline';
          s.float = 'left';
          s.margin = '0 1em 1em 0';
        }
      };

      const toggleRight = (img: HTMLElement) => {
        const s = img.style;
        const on = isRight(img);
        if (on) {
          s.removeProperty('float');
          s.removeProperty('margin');
          s.removeProperty('display');
        } else {
          s.display = 'inline';
          s.float = 'right';
          s.margin = '0 0 1em 1em';
        }
      };

      const toggleCenter = (img: HTMLElement) => {
        const s = img.style;
        const on = isCenter(img);
        if (on) {
          s.removeProperty('float');
          s.removeProperty('margin');
          s.removeProperty('display');
        } else {
          s.removeProperty('float');
          s.display = 'block';
          s.margin = '0 auto';
        }
      };

      const clearSize = (img: HTMLElement) => {
        img.removeAttribute('width');
        img.removeAttribute('height');
        img.style.removeProperty('width');
        img.style.removeProperty('height');
      };

      Toolbar.Tools = {
        ...Toolbar.Tools,
        left: {
          toolClass: 'left',
          handler: function (this: ToolbarInstance, _evt, _btn, el?): false {
            const img = el ?? (this.activeEle as HTMLElement | null);
            if (!img) return false;

            toggleLeft(img);
            syncImgStyleToFormats(this.quill, img);
            refreshAlignmentButtonState(this.toolbar, img);
            this.requestUpdate?.();
            return false;
          },
          isApplied: function (this: ToolbarInstance, el?: HTMLElement) {
            return isLeft(el ?? (this.activeEle as HTMLElement | null));
          },
        },
        right: {
          toolClass: 'right',
          handler: function (this: ToolbarInstance, _evt, _btn, el?): false {
            const img = el ?? (this.activeEle as HTMLElement | null);
            if (!img) return false;

            toggleRight(img);
            syncImgStyleToFormats(this.quill, img);
            refreshAlignmentButtonState(this.toolbar, img);
            this.requestUpdate?.();
            return false;
          },
          isApplied: function (this: ToolbarInstance, el?: HTMLElement) {
            return isRight(el ?? (this.activeEle as HTMLElement | null));
          },
        },
        center: {
          toolClass: 'center',
          handler: function (this: ToolbarInstance, _evt, _btn, el?): false {
            const img = el ?? (this.activeEle as HTMLElement | null);
            if (!img) return false;

            toggleCenter(img);
            syncImgStyleToFormats(this.quill, img);
            refreshAlignmentButtonState(this.toolbar, img);
            this.requestUpdate?.();
            return false;
          },
          isApplied: function (this: ToolbarInstance, el?: HTMLElement) {
            return isCenter(el ?? (this.activeEle as HTMLElement | null));
          },
        },
        resetSize: {
          text: 'Clear',
          attrs: {
            title: 'リサイズ解除',
            'aria-label': 'リサイズ解除',
          },
          handler: function (this: ToolbarInstance, _evt, _btn, el?): false {
            const img = el ?? (this.activeEle as HTMLElement | null);
            if (!img) return false;

            clearSize(img);
            syncImgStyleToFormats(this.quill, img);
            refreshAlignmentButtonState(this.toolbar, img);
            this.requestUpdate?.();
            return false;
          },
        },
      };
    }
  } catch (e) {
    console.warn('Failed to override resize toolbar tools:', e);
  }

  // 重複登録を避けるため、ここでの register は削除（上で済ませているため）
  resizeReadyRef.current = true;
}
