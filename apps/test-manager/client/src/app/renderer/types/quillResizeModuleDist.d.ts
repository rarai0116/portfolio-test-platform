declare module 'quill-resize-module' {
  import type Quill from 'quill';

  export interface ResizeLimit {
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    ratio?: number;
  }

  export interface ParchmentConfigFor {
    attribute?: string[];
    limit?: ResizeLimit;
  }

  export interface ResizeOptions {
    modules?: Array<'DisplaySize' | 'Toolbar' | 'Resize' | 'Keyboard' | string>;
    keyboardSelect?: boolean;
    selectedClass?: string;
    activeClass?: string;
    embedTags?: string[];
    tools?: Array<string | ToolDefinition>;
    parchment?: {
      // blotName: 'image' | 'video' | custom
      [blotName: string]: ParchmentConfigFor;
    };
    onActive?: (
      this: BaseModuleInstance,
      blot: unknown,
      activeEle: HTMLElement,
    ) => void;
    onInactive?: (
      this: BaseModuleInstance,
      blot?: unknown,
      activeEle?: HTMLElement,
    ) => void;
    onChangeSize?: (
      this: BaseModuleInstance,
      blot: unknown,
      activeEle: HTMLElement,
      size: { width?: string; height?: string },
    ) => void;
  }

  export interface BaseModuleInstance {
    quill: Quill;
    resizer: ResizeManager;
    overlay?: HTMLElement;
    activeEle?: HTMLElement;
    blot?: unknown;
    options: ResizeOptions;
    requestUpdate(force?: boolean): void;
    onCreate(resizer: ResizeManager): void;
    onDestroy(): void;
    onUpdate(): void;
  }

  export interface ToolbarInstance extends BaseModuleInstance {
    toolbar: HTMLElement;
  }

  export interface ToolDefinition {
    toolClass?: string;
    icon?: string;
    text?: string;
    attrs?: Record<string, string>;
    verify?(this: ToolbarInstance, el: HTMLElement, blot: unknown): boolean;
    handler?(
      this: ToolbarInstance,
      evt: Event,
      btn: HTMLButtonElement,
      el?: HTMLElement,
    ): boolean | undefined;
    isApplied?(this: ToolbarInstance, el?: HTMLElement): boolean;
  }

  export interface ToolbarClass {
    new (resizer: ResizeManager): ToolbarInstance;
    Tools: Record<string, ToolDefinition>;
    Icons: Record<string, string>;
  }

  export interface ModulesBag {
    Base: new (resizer: ResizeManager) => BaseModuleInstance;
    DisplaySize: new (resizer: ResizeManager) => BaseModuleInstance;
    Toolbar: ToolbarClass;
    Resize: new (resizer: ResizeManager) => BaseModuleInstance;
    Keyboard: new (resizer: ResizeManager) => BaseModuleInstance;
  }

  export default class ResizeManager {
    static Modules: ModulesBag;
    constructor(quill: Quill, options?: ResizeOptions);
    quill: Quill;
    options: ResizeOptions;
    overlay?: HTMLElement;
    activeEle?: HTMLElement;
    blot?: unknown;
    moduleClasses: Array<
      keyof ModulesBag | (new (resizer: ResizeManager) => BaseModuleInstance)
    >;
    modules: BaseModuleInstance[];
    onUpdate(force?: boolean): void;
    initializeModules(): void;
    removeModules(): void;
    show(el: HTMLElement): void;
    hide(): void;
    judgeShow(blotOrLeaf: unknown, domNode?: HTMLElement): boolean;
  }

  // 互換: 一部コードが named として参照する場合
  export const ResizeModule: typeof ResizeManager;
}

declare module 'quill-resize-module/dist/resize.css' {
  const css: string;
  export default css;
}
