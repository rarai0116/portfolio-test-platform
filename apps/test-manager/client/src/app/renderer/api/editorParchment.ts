import Quill, { type Parchment } from 'quill';
import { isAllowedQuillImageSource } from './htmlSanitizer';

let registered = false;

export function ensureEditorParchmentRegistered(): void {
  if (registered) return;

  const Parchment = Quill.import('parchment');
  // biome-ignore lint/suspicious/noExplicitAny: 型情報がないため
  const BaseImage = Quill.import('formats/image') as any;

  const Scope = Parchment.Scope;

  // スタイル系（float/margin/display）
  const FloatStyle = new Parchment.StyleAttributor('float', 'float', {
    scope: Scope.INLINE,
  });
  const MarginStyle = new Parchment.StyleAttributor('margin', 'margin', {
    scope: Scope.INLINE,
  });
  const DisplayStyle = new Parchment.StyleAttributor('display', 'display', {
    scope: Scope.INLINE,
  });

  class ImageEx extends BaseImage {
    /**
     * 正規の demo-asset URL と内部ダミーだけを許可する（設計10.4）。
     * 新しい Image blot は登録せず、width / height / float / margin 契約は維持する。
     */
    static sanitize(url: string) {
      return isAllowedQuillImageSource(url) ? url : '//:0';
    }

    static formats(domNode: HTMLElement) {
      const formats = BaseImage.formats(domNode) || {};
      const s = domNode.style as CSSStyleDeclaration;

      const float = s.float || '';
      const margin = s.margin || '';
      const display = s.display || '';
      const width = domNode.getAttribute('width') || s.width || '';
      const height = domNode.getAttribute('height') || s.height || '';

      if (float) formats.float = float;
      if (margin) formats.margin = margin;
      if (display) formats.display = display;
      if (width) formats.width = width;
      if (height) formats.height = height;
      return formats;
    }

    format(name: string, value: unknown) {
      const node = this.domNode as HTMLElement;
      const s = node.style;

      if (name === 'float') {
        if (value == null || value === false || value === '') {
          s.removeProperty('float');
          return;
        }
        s.float = String(value);
        return;
      }
      if (name === 'margin') {
        if (value == null || value === false || value === '') {
          s.removeProperty('margin');
          return;
        }
        s.margin = String(value);
        return;
      }
      if (name === 'display') {
        if (value == null || value === false || value === '') {
          s.removeProperty('display');
          return;
        }
        s.display = String(value);
        return;
      }
      if (name === 'width') {
        if (value == null || value === false || value === '') {
          node.removeAttribute('width');
          s.removeProperty('width');
          return;
        }
        const v = String(value);
        node.setAttribute('width', v);
        if (/^\d+(\.\d+)?$/.test(v)) s.width = `${v}px`;
        else s.width = v;
        return;
      }
      if (name === 'height') {
        if (value == null || value === false || value === '') {
          node.removeAttribute('height');
          s.removeProperty('height');
          return;
        }
        const v = String(value);
        node.setAttribute('height', v);
        if (/^\d+(\.\d+)?$/.test(v)) s.height = `${v}px`;
        else s.height = v;
        return;
      }
      // 既存の他のフォーマットは親に委譲
      super.format(name, value);
    }
  }

  // 既存のImageフォーマットを拡張せず、Attributorのみ登録（resize-moduleを尊重）
  Quill.register(FloatStyle, true);
  Quill.register(MarginStyle, true);
  Quill.register(DisplayStyle, true);
  //  Quill.register(WidthAttr, true);
  //  Quill.register(HeightAttr, true);

  Quill.register(ImageEx, true);

  registered = true;
}

export function setupEditorClipboardMatchers(quill: Quill): void {
  // IMGタグのstyle/属性をDelta attributesへ変換
  quill.clipboard.addMatcher('IMG', (node, delta) => {
    const el = node as HTMLElement;
    const src = el.getAttribute('src') ?? '';
    const ops = delta.ops as Array<{
      insert: string | { image: string };
      attributes?: Record<string, string>;
    }>;

    // sanitize()だけでは //:0 の壊れた画像が残るため、不許可画像のop自体を除去する。
    if (!isAllowedQuillImageSource(src)) {
      delta.ops = ops.filter(
        (op) =>
          !(typeof op.insert === 'object' && op.insert && 'image' in op.insert),
      );
      return delta;
    }

    const formats: Record<string, string> = {};

    if (el.style.float) formats.float = el.style.float;
    if (el.style.margin) formats.margin = el.style.margin;
    if (el.style.display) formats.display = el.style.display;

    const w = el.getAttribute('width') ?? '';
    const h = el.getAttribute('height') ?? '';
    if (w) formats.width = w;
    if (h) formats.height = h;

    for (const op of ops) {
      if (typeof op.insert === 'object' && op.insert && 'image' in op.insert) {
        op.attributes = { ...(op.attributes || {}), ...formats };
      }
    }
    return delta;
  });
}

/**
 * quill-resize-toolbar でDOMへ適用した style を Delta attributes に同期
 * - embed（画像）は長さ1。blot位置を求めて formatText する
 */
export function syncImgStyleToFormats(quill: Quill, img: HTMLElement): void {
  try {
    const blot = Quill.find(img) as Parchment.Blot | null;
    if (!blot) return;

    const index =
      typeof blot.offset === 'function'
        ? blot.offset(quill.scroll)
        : quill.getIndex(blot);

    const nextFormats: Record<string, string | false> = {
      float: img.style.float || false,
      margin: img.style.margin || false,
      display: img.style.display || false,
      width: img.getAttribute('width') || false,
      height: img.getAttribute('height') || false,
    };

    for (const [name, value] of Object.entries(nextFormats)) {
      quill.formatText(index, 1, name, value, 'api');
    }
  } catch (e) {
    console.warn('syncImgStyleToFormats failed:', e);
  }
}
