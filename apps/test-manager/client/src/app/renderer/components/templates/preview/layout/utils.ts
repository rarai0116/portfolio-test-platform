import { reportPreviewImageDimensionFallback } from '@renderer/api/previewImageDimensionTelemetry';

export const PXToMM = 0.2645; //96dpi 1mm=3.78px -> 1px=0.2645mm
export const BASE_HEIGHT = (250 - 20) / PXToMM; // 250mm - 上下余白合計20mm を px に換算;
export const FLOAT_IMAGE_OFFSET = 10.5;

export const PREVIEW_ROOT_SELECTOR = '[data-create-pdf-preview-root]';

export type ImageLayoutDimensionSource =
  | 'attribute'
  | 'asset-data'
  | 'natural'
  | 'property'
  | 'offset';

export type ImageLayoutSize = {
  width?: number;
  height?: number;
  source?: ImageLayoutDimensionSource;
};

const BLOCK_LEVEL_TAG_NAMES = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'DIV',
  'DL',
  'FIELDSET',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'FORM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'PRE',
  'SECTION',
  'TABLE',
  'UL',
]);

export const strWidthLen = (str: string | null | undefined): number => {
  return [...(str ?? '')].reduce((count, char) => {
    const len = Math.min(new Blob([char]).size, 2);
    return count + len;
  }, 0);
};

export const escapeRegExp = (str: string): string => {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const RectHitTest = (rectA: Rect, rectB: Rect) => {
  const distX = rectA.x + rectA.w / 2 - rectB.x - rectB.w / 2;
  const distY = rectA.y + rectA.h / 2 - rectB.y - rectB.h / 2;
  const colliderX = Math.abs(distX) - rectA.w / 2 - rectB.w / 2;
  const colliderY = Math.abs(distY) - rectA.h / 2 - rectB.h / 2;
  if (colliderX <= 0 && colliderY <= 0) {
    return {
      X: distX > 0 ? colliderX : -colliderX,
      Y: distY > 0 ? colliderY : -colliderY,
    };
  }
  return null;
};

export const wait = (time: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, time));

const toPositiveNumber = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return undefined;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) && num > 0 ? num : undefined;
};

const completeSizeWithRatio = (
  size: ImageLayoutSize,
  basis: ImageLayoutSize,
): ImageLayoutSize => {
  if (size.width && size.height) return size;
  if (!basis.width || !basis.height) return size;

  if (size.width && !size.height) {
    return {
      ...size,
      height: Math.round((size.width * basis.height) / basis.width),
      source: basis.source ?? size.source,
    };
  }
  if (!size.width && size.height) {
    return {
      ...size,
      width: Math.round((size.height * basis.width) / basis.height),
      source: basis.source ?? size.source,
    };
  }
  return size;
};

const firstCompleteBasis = (candidates: ImageLayoutSize[]) =>
  candidates.find((candidate) => candidate.width && candidate.height);

const reportFallbackSize = (
  img: HTMLImageElement,
  size: ImageLayoutSize,
): void => {
  if (
    size.source !== 'natural' &&
    size.source !== 'property' &&
    size.source !== 'offset'
  ) {
    return;
  }

  const imageKey =
    img.getAttribute('data-asset-key') ||
    img.getAttribute('data-key') ||
    img.getAttribute('alt') ||
    img.getAttribute('title');
  if (!imageKey) return;

  reportPreviewImageDimensionFallback({
    imageKey,
    fallbackSource: size.source,
    route: 'preview-layout',
  });
};

export const resolveImageLayoutSize = (
  img: HTMLImageElement,
): ImageLayoutSize => {
  const attr: ImageLayoutSize = {
    width: toPositiveNumber(img.getAttribute('width')),
    height: toPositiveNumber(img.getAttribute('height')),
    source: 'attribute',
  };
  const assetData: ImageLayoutSize = {
    width: toPositiveNumber(img.getAttribute('data-preview-asset-width')),
    height: toPositiveNumber(img.getAttribute('data-preview-asset-height')),
    source: 'asset-data',
  };
  const natural: ImageLayoutSize = {
    width: toPositiveNumber(img.naturalWidth),
    height: toPositiveNumber(img.naturalHeight),
    source: 'natural',
  };
  const property: ImageLayoutSize = {
    width: toPositiveNumber(img.width),
    height: toPositiveNumber(img.height),
    source: 'property',
  };
  const offset: ImageLayoutSize = {
    width: toPositiveNumber(img.offsetWidth),
    height: toPositiveNumber(img.offsetHeight),
    source: 'offset',
  };
  const candidates = [attr, assetData, natural, property, offset];
  const ratioBasis = firstCompleteBasis(candidates);

  for (const candidate of candidates) {
    const completed = completeSizeWithRatio(candidate, ratioBasis ?? candidate);
    if (completed.width && completed.height) {
      reportFallbackSize(img, completed);
      return completed;
    }
  }

  for (const candidate of candidates) {
    if (candidate.width || candidate.height) {
      const completed = completeSizeWithRatio(
        candidate,
        ratioBasis ?? candidate,
      );
      reportFallbackSize(img, completed);
      return completed;
    }
  }

  return {};
};

export const searchFloatImage = (
  target: HTMLElement,
): HTMLImageElement[] | null => {
  const imgs = target.getElementsByTagName('img');
  if (imgs.length > 0) {
    const result = Array.from(imgs).filter(
      (v) =>
        v.style.display === 'inline' &&
        v.style.float !== undefined &&
        v.style.float !== '',
    ) as HTMLImageElement[];
    return result.length === 0 ? null : result;
  }
  return null;
};

export type NormalizeInactiveFloatImagesResult = {
  changed: boolean;
  normalizedCount: number;
  remainingFloatCount: number;
  aborted: boolean;
};

type FloatSide = 'left' | 'right';

type ComputedStyleSnapshot = {
  display: string;
  position: string;
  float: string;
};

type WrapCandidate = {
  node: Node;
  rects: DOMRect[];
};

const FLOAT_FRAGMENT_EPSILON_PX = 0.5;

// 独立した描画箱を持つ要素だけを候補にする。コンテナ要素まで候補にすると
// 親矩形が float 領域を含んでしまい、回り込みありと誤検出する。
const NON_TEXT_FRAGMENT_SELECTOR = 'img,svg,canvas,table';

const isMeasurableRect = (rect: DOMRect): boolean =>
  rect.width > FLOAT_FRAGMENT_EPSILON_PX &&
  rect.height > FLOAT_FRAGMENT_EPSILON_PX;

/**
 * computed style は候補ごとに祖先まで遡って参照するため、1パス内だけ Element 単位で
 * 文字列値をキャッシュする。パスをまたぐと float 解除でレイアウトが変わるので持ち越さない。
 */
const createComputedStyleReader = (view: Window) => {
  const cache = new Map<Element, ComputedStyleSnapshot>();

  return (element: Element): ComputedStyleSnapshot => {
    const cached = cache.get(element);
    if (cached) return cached;

    const computed = view.getComputedStyle(element);
    const snapshot: ComputedStyleSnapshot = {
      display: computed.display,
      position: computed.position,
      float: computed.getPropertyValue('float'),
    };
    cache.set(element, snapshot);
    return snapshot;
  };
};

/**
 * 通常フロー外の要素と非表示要素は回り込み断片にならないため候補から外す。
 * 探索は scope までに限る。scope の外側にある .measure-page-shell は
 * visibility:hidden と position:absolute を持つため、遡ると全候補が消える。
 * display は子へ継承されないので、候補自身だけでなく祖先も見る必要がある。
 * 判定は肯定条件だけで行う。未指定プロパティは空文字列になり得るため、
 * position !== 'static' のような否定条件だと通常候補まで除外される。
 */
const isOutOfNormalFlowOrHidden = (
  start: Element | null,
  scope: HTMLElement,
  readStyle: (element: Element) => ComputedStyleSnapshot,
): boolean => {
  let current = start;
  while (current) {
    const { display, position } = readStyle(current);
    if (display === 'none') return true;
    if (position === 'absolute' || position === 'fixed') return true;
    if (current === scope) return false;
    current = current.parentElement;
  }
  return false;
};

/**
 * 例外を投げずに返る空の矩形リストは失敗ではなく「描画断片0件」として扱う。
 * 例外が起きた場合は呼び出し元の judgeFloatImages が判定不能として扱う。
 */
const collectWrapCandidates = (
  scope: HTMLElement,
  readStyle: (element: Element) => ComputedStyleSnapshot,
): WrapCandidate[] => {
  const root = scope.ownerDocument;
  const candidates: WrapCandidate[] = [];

  // テキストは親要素ではなくテキストノード単位の行断片で見る。
  // ブロック要素の矩形は float 領域を含むため、横に文字が無くても重なってしまう。
  const walker = root.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if ((node.textContent ?? '').trim().length === 0) continue;
    if (isOutOfNormalFlowOrHidden(node.parentElement, scope, readStyle))
      continue;

    const range = root.createRange();
    range.selectNodeContents(node);
    candidates.push({
      node,
      rects: Array.from(range.getClientRects()).filter(isMeasurableRect),
    });
  }

  for (const element of Array.from(
    scope.querySelectorAll(NON_TEXT_FRAGMENT_SELECTOR),
  )) {
    if (isOutOfNormalFlowOrHidden(element, scope, readStyle)) continue;

    const rect = element.getBoundingClientRect();
    if (!isMeasurableRect(rect)) continue;
    candidates.push({ node: element, rects: [rect] });
  }

  return candidates;
};

const isSideBySide = (
  floatRect: DOMRect,
  side: FloatSide,
  candidateRect: DOMRect,
): boolean => {
  const verticalOverlap =
    Math.min(floatRect.bottom, candidateRect.bottom) -
    Math.max(floatRect.top, candidateRect.top);
  if (verticalOverlap <= FLOAT_FRAGMENT_EPSILON_PX) return false;

  return side === 'left'
    ? candidateRect.left >= floatRect.right - FLOAT_FRAGMENT_EPSILON_PX
    : candidateRect.right <= floatRect.left + FLOAT_FRAGMENT_EPSILON_PX;
};

const hasWrappedFragment = (
  img: HTMLImageElement,
  floatRect: DOMRect,
  side: FloatSide,
  candidates: WrapCandidate[],
): boolean =>
  candidates.some((candidate) => {
    if (candidate.node === img) return false;
    // float は自分より後ろの要素だけを回り込ませる。前の本文は対象外。
    const isFollowing =
      (img.compareDocumentPosition(candidate.node) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
      0;
    if (!isFollowing) return false;

    return candidate.rects.some((rect) => isSideBySide(floatRect, side, rect));
  });

const collectFloatImageEntries = (
  scope: HTMLElement,
  readStyle: (element: Element) => ComputedStyleSnapshot,
): Array<{ img: HTMLImageElement; side: FloatSide }> => {
  const entries: Array<{ img: HTMLImageElement; side: FloatSide }> = [];

  for (const img of Array.from(scope.getElementsByTagName('img'))) {
    // 入口条件は searchFloatImage に揃える
    if (img.style.display !== 'inline') continue;
    if (img.style.float === '') continue;

    const side = readStyle(img).float;
    if (side !== 'left' && side !== 'right') continue;

    entries.push({ img, side });
  }

  return entries;
};

type FloatJudgement = {
  normalizeTargets: HTMLImageElement[];
  remainingFloatCount: number;
};

/**
 * 走査中の例外はすべて判定不能として null を返す。矩形やcomputed styleを取得できないまま
 * 「回り込みなし」とみなすと、実際に回り込んでいる唯一の断片を見落として有効な float を
 * 解除してしまう。判定だけを行い変更はしないため、途中で失敗しても部分適用にならない。
 */
const judgeFloatImages = (
  scope: HTMLElement,
  view: Window,
): FloatJudgement | null => {
  try {
    const readStyle = createComputedStyleReader(view);
    const floatEntries = collectFloatImageEntries(scope, readStyle);
    if (floatEntries.length === 0) {
      return { normalizeTargets: [], remainingFloatCount: 0 };
    }

    const candidates = collectWrapCandidates(scope, readStyle);
    const normalizeTargets: HTMLImageElement[] = [];
    let remainingFloatCount = 0;

    for (const { img, side } of floatEntries) {
      const floatRect = img.getBoundingClientRect();

      // 寸法未確定の画像は実回り込みを判定できないため float のまま残す
      if (!isMeasurableRect(floatRect)) {
        remainingFloatCount += 1;
        continue;
      }

      if (hasWrappedFragment(img, floatRect, side, candidates)) {
        remainingFloatCount += 1;
        continue;
      }

      normalizeTargets.push(img);
    }

    return { normalizeTargets, remainingFloatCount };
  } catch {
    return null;
  }
};

/**
 * CSS上は float でも横に回り込む描画要素が実際には存在しない画像を、
 * レンダリング用DOM上だけで通常フローへ戻す。
 * 1パス分の判定と解除だけを担当し、frame待機と固定点までの反復は呼び出し側が持つ。
 */
export const normalizeInactiveFloatImages = (
  scope: HTMLElement,
): NormalizeInactiveFloatImagesResult => {
  const idle: NormalizeInactiveFloatImagesResult = {
    changed: false,
    normalizedCount: 0,
    remainingFloatCount: 0,
    aborted: false,
  };

  if (!scope.isConnected) return { ...idle, aborted: true };

  // viewer は renderer とは別 document のため、computed style も viewer 側 window で解決する
  const view = scope.ownerDocument.defaultView;
  if (!view) return { ...idle, aborted: true };

  const judgement = judgeFloatImages(scope, view);
  if (!judgement) return { ...idle, aborted: true };

  const { normalizeTargets, remainingFloatCount } = judgement;

  // 走査途中で解除すると後続画像の座標が動いて同一パス内の判定が不安定になるため、
  // 全ての判定を終えてからまとめて変更する。
  for (const img of normalizeTargets) {
    // searchFloatImage は style.float !== '' を float 指定の条件にしており、
    // 'none' を代入すると float 画像として再検出される。宣言自体を除去する。
    img.style.removeProperty('float');
  }

  return {
    changed: normalizeTargets.length > 0,
    normalizedCount: normalizeTargets.length,
    remainingFloatCount,
    aborted: false,
  };
};

/**
 * src を持たない <img> は load も error も発火しない。
 * 画像アセットが未 ready の間は realizeDomImages が src を付けないため、
 * この状態の img を待つと待機が永久に解決しない。
 */
export const hasLoadableImageSource = (img: HTMLImageElement): boolean => {
  const src = img.getAttribute('src');
  return src !== null && src.trim() !== '';
};

/** 画像待機の上限。イベントが来ない場合でも計測へ進めるための保険 */
export const IMAGE_READY_TIMEOUT_MS = 3000;

// 画像ロード待機 + レイアウト確定待機 + 実測関数
const waitForImageReady = (img: HTMLImageElement): Promise<void> => {
  return new Promise((resolve) => {
    const hasNatural = img.naturalWidth > 0 && img.naturalHeight > 0;
    const hasOffset = img.width > 0 && img.height > 0;
    if (img.complete && (hasNatural || hasOffset)) {
      resolve();
      return;
    }
    // 読み込む src が無いなら待たずに計測へ進む
    if (!hasLoadableImageSource(img)) {
      resolve();
      return;
    }
    let timerId: ReturnType<typeof setTimeout> | undefined;
    const done = () => {
      if (timerId !== undefined) clearTimeout(timerId);
      img.removeEventListener('load', done);
      img.removeEventListener('error', done);
      resolve();
    };
    timerId = setTimeout(done, IMAGE_READY_TIMEOUT_MS);
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  });
};

const waitForNextFrame = (count = 1): Promise<void> =>
  new Promise((resolve) => {
    const step = (n: number) => {
      if (n <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => step(n - 1));
    };
    step(count);
  });

const toFixedPx = (value: number): number => Number(value.toFixed(2));

const measureRenderedHeightPx = (node: HTMLElement): number => {
  const rect = node.getBoundingClientRect().height;
  return Number.isFinite(rect) && rect > 0 ? toFixedPx(rect) : 0;
};

const measureHeightPx = (node: HTMLElement, height?: number): number => {
  const rect = measureRenderedHeightPx(node);
  if (rect > 1) {
    return toFixedPx(Math.max(rect, height || 0));
  }

  const off = node.offsetHeight;
  const client = node.clientHeight;
  const scroll = node.scrollHeight;
  const measured = Math.max(rect, off, client, scroll, height || 0);
  return toFixedPx(measured);
};

const resolveLayoutProbeHost = (root: Document): HTMLElement => {
  const previewRoot = root.querySelector(PREVIEW_ROOT_SELECTOR);
  if (previewRoot instanceof HTMLElement) {
    return previewRoot;
  }

  return root.body ?? root.documentElement;
};

const measureHeightWithProbe = async (node: HTMLElement): Promise<number> => {
  const root = node.ownerDocument;
  const host = resolveLayoutProbeHost(root);
  const probeHost = root.createElement('div');
  const probeNode = node.cloneNode(true) as HTMLElement;
  const parentWidth = node.parentElement?.getBoundingClientRect().width ?? 0;
  const computed = root.defaultView?.getComputedStyle(node);

  probeHost.style.position = 'absolute';
  probeHost.style.left = '-10000px';
  probeHost.style.top = '0';
  probeHost.style.visibility = 'hidden';
  probeHost.style.pointerEvents = 'none';
  probeHost.style.boxSizing = 'border-box';

  if (parentWidth > 0) {
    probeHost.style.width = `${String(parentWidth)}px`;
  }

  probeNode.removeAttribute('heighter');
  probeNode.style.display = computed?.display ?? probeNode.style.display;

  host.appendChild(probeHost);
  probeHost.appendChild(probeNode);

  const probeImages = Array.from(probeNode.getElementsByTagName('img'));
  await Promise.all(probeImages.map(waitForImageReady));
  await waitForNextFrame(2);

  let measured = measureHeightPx(probeNode);
  if (measured <= 1) {
    await wait(80);
    await waitForNextFrame(1);
    measured = measureHeightPx(probeNode);
  }

  probeHost.remove();
  return measured;
};

export const CalculateNodeHeighter = async (
  node: HTMLElement,
  offset = 0,
  opts?: { force?: boolean; imageScale?: number },
): Promise<void> => {
  const force = opts?.force ?? false;
  const existing = Number(node.getAttribute('heighter') || 0);
  const images = node.getElementsByTagName('img');
  const hasImg = images.length > 0;

  // 既存値があり、画像ノードでも過小値でないなら再計測しない
  if (!force && existing > 1 && !hasImg) return;

  const isInline = node.tagName === 'SPAN' || node.style.display === 'inline';
  const textOffset = isInline ? 4 : 0;

  if (!hasImg) {
    node.setAttribute(
      'heighter',
      String(measureHeightPx(node) + textOffset + offset),
    );
    return;
  }

  // 非float画像の高さ計測: 画像読み込みとレイアウト確定を待つ
  const imgs = Array.from(node.getElementsByTagName('img'));
  if (!searchFloatImage(node)) {
    const prevDisplay = node.style.display;
    node.style.display = 'block';

    await Promise.all(imgs.map(waitForImageReady));
    await waitForNextFrame(2);

    let h = measureHeightPx(node);

    // 1px等の過小値フォールバック再計測
    if (h <= 1) {
      await wait(80);
      await waitForNextFrame(1);
      h = measureHeightPx(node);
    }

    if (h <= 1) {
      h = await measureHeightWithProbe(node);
    }

    node.setAttribute('heighter', String(h + offset));
    node.style.display = prevDisplay;
    return;
  }

  // float画像は親段落の高さに含まれないため、画像自身の表示実測値を fallback に使う。
  // heighter は改ページ用の実効高さなので、属性上の原寸や scale 補正値へ戻さない。
  const imageHeighest = Array.from(images).reduce((maxHeight, img) => {
    return Math.max(maxHeight, measureRenderedHeightPx(img));
  }, 0);

  node.setAttribute(
    'heighter',
    String(measureHeightPx(node, imageHeighest) + offset),
  );
};

export const GetNodeHeighter = (node: HTMLElement): number => {
  return Number(node.getAttribute('heighter') || 0);
};

export const _divideSentences = (dom: HTMLElement): Promise<void> => {
  return new Promise((resolve) => {
    let html = dom.innerHTML || '';

    // <p>〜</p> は 1 センテンス扱いにするため一旦マーカー化
    let selections = `${html.replace(/<p(?: .+?)?>([\s\S]*?)<\/p>/gi, '＠＠＠')}＠＠＠`;

    // 画像を退避し、プレースホルダに置換
    const regAttr = /([a-zA-Z]*)=['"]([^'"]*)['"]/gi;
    const images = selections.match(/<img(?: .+?)?>([\s\S]*?)/gi);
    const stashImages: Record<
      string,
      { original: string; [key: string]: string }
    > = {};
    const si: Array<Record<string, string>> = [];

    if (images !== null) {
      for (let i = 0; i < images.length; i++) {
        si[i] = {};
        let m2: RegExpExecArray | null;
        // 属性パース
        m2 = regAttr.exec(images[i]);
        while (m2 !== null) {
          si[i][m2[1]] = m2[2];
          m2 = regAttr.exec(images[i]);
        }
        const alt = si[i].alt;
        if (!alt) continue;
        stashImages[alt] = { original: images[i], ...si[i] };
        html = html.replace(images[i], `[${alt}]`);
        selections = selections.replace(images[i], `[${alt}]`);
      }
    }

    // マーカー単位で処理
    const reg = /([\s\S]*?)([＠]{3})/gim;
    let remain = selections;
    let m: RegExpExecArray | null;

    m = reg.exec(selections);
    while (m !== null) {
      const seg = m[1];
      const sentences = seg.match(/([\s\S]*?[。\n\r])(?![)」])(<br>){0,1}/gi) as
        | string[]
        | null;

      if (sentences !== null) {
        let sumLen = 0;
        sentences.forEach((sentenceRaw, index) => {
          let sentence = sentenceRaw;
          let blockMode = false;

          // 行頭 <br> の扱い（ブロック開始）
          if (/^<br>/i.test(sentence)) {
            blockMode = true;
            sentence = sentence.replace(/^<br>/i, '');
          }

          remain = remain.replace(sentenceRaw, '');

          const before = sentences[index - 1];
          const len = strWidthLen(
            sentence.replace(/<("[\s\S]*?"|'[\s\S]*?'|[^'"])*?>/gi, ''),
          );

          const reg4 = new RegExp(`^${escapeRegExp(sentence)}`, 'i');
          const reg3 = new RegExp(
            `(?!<(p|span)[^>]*?>)(?![\\s\\S]*?<\\/(p|span)[^>]*?>)${escapeRegExp(
              sentence,
            )}`,
            'i',
          );
          const topMatch = !!html.match(reg4);

          if (len > 0) {
            sumLen += len;

            // ブロック化の条件:
            // - 長文
            // - セクション最初
            // - 明示的な blockMode
            if ((sumLen > 40 && len > 6) || index === 0 || blockMode) {
              if (!blockMode) {
                html = html.replace(
                  topMatch ? reg4 : reg3,
                  `<span class="sub-dividable-sentence">${sentence}</span>`,
                );
              } else {
                html = html.replace(
                  topMatch ? reg4 : reg3,
                  `<p class="sub-dividable-sentence is-top-match">${sentence}</p>`,
                );
              }
              sumLen = len;
            } else {
              // 直前センテンスと結合
              if (before) {
                const matchTarget = new RegExp(
                  escapeRegExp(`${before}</span>${sentence}`),
                );
                if (html.match(matchTarget)) {
                  html = html.replace(
                    matchTarget,
                    `${before}${sentence}</span>`,
                  );
                  return;
                }
              }
              html = html.replace(
                topMatch ? reg4 : reg3,
                `<span class="sub-dividable-sentence">${sentence}</span>`,
              );
              sumLen = len;
            }
          }
        });
      } else {
        // センテンス検出できなかった部分はそのまま 1 ブロック
        remain = '';
        html = html.replace(
          m[1],
          `<span class="sub-dividable-sentence">${m[1]}</span>`,
        );
      }

      m = reg.exec(selections);
    }

    // マーカー残り
    const afterRemain = remain
      .replace(/[＠]{3}$/i, '')
      .replace(/^(<br>)*/i, '');
    if (afterRemain.length > 0 && !/^\s+$/i.test(afterRemain)) {
      const matchTarget = new RegExp(escapeRegExp(afterRemain));
      html = html.replace(
        matchTarget,
        `<span class="sub-dividable-sentence">${afterRemain}</span>`,
      );
    }

    // 画像を復帰
    Object.keys(stashImages).forEach((k) => {
      html = html.replace(`[${k}]`, stashImages[k].original);
    });

    dom.innerHTML = html;

    // <p> に sub-dividable-sentence を付与
    Array.prototype.slice
      .call(dom.getElementsByTagName('p'))
      .forEach((v: HTMLElement) => {
        v.classList.add('sub-dividable-sentence');
      });

    // 空 span を削除
    Array.from(dom.getElementsByTagName('span'))
      .filter(
        (v) =>
          v.innerHTML === '' && v.classList.contains('sub-dividable-sentence'),
      )
      .forEach((v) => {
        v.remove();
      });

    // span の中に span が居たら外す
    Array.from(dom.getElementsByTagName('span')).forEach((v) => {
      v.innerHTML = v.innerHTML.replace(
        /^(<span\sclass="sub-dividable-sentence")(.*)(<\/span>)$/i,
        '$2',
      );
    });

    resolve();
  });
};

// 汎用シャッフル関数
export const shuffleArray = <T>(array: T[]): T[] => {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const r = Math.floor(Math.random() * (i + 1));
    const tmp = result[i];
    result[i] = result[r];
    result[r] = tmp;
  }
  return result;
};

const isParagraphElement = (node: ChildNode): node is HTMLParagraphElement => {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    (node as Element).tagName.toUpperCase() === 'P'
  );
};

const isIgnorableTopLevelNode = (node: ChildNode): boolean => {
  if (node.nodeType === Node.COMMENT_NODE) {
    return true;
  }

  return (
    node.nodeType === Node.TEXT_NODE &&
    (node.textContent ?? '').trim().length === 0
  );
};

const isBlockLevelElement = (node: ChildNode): boolean => {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  const tagName = (node as Element).tagName.toUpperCase();
  return tagName !== 'P' && BLOCK_LEVEL_TAG_NAMES.has(tagName);
};

const removeEmptySizeAttributes = (root: ParentNode) => {
  root.querySelectorAll<HTMLElement>('[width], [height]').forEach((el) => {
    const width = el.getAttribute('width');
    const height = el.getAttribute('height');

    if (width !== null && width.trim() === '') {
      el.removeAttribute('width');
    }
    if (height !== null && height.trim() === '') {
      el.removeAttribute('height');
    }
  });
};

const isFloatImageNode = (node: ChildNode): node is HTMLImageElement => {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const el = node as Element;
  if (el.tagName.toUpperCase() !== 'IMG') return false;

  const img = el as HTMLImageElement;
  return img.style.display === 'inline' && img.style.float !== '';
};

const isLineBreakNode = (node: ChildNode): boolean => {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    (node as Element).tagName.toUpperCase() === 'BR'
  );
};

const isIgnorableInlineNode = (node: ChildNode): boolean => {
  if (node.nodeType === Node.COMMENT_NODE) return true;
  return (
    node.nodeType === Node.TEXT_NODE &&
    (node.textContent ?? '').trim().length === 0
  );
};

const cloneParagraphShell = (
  source: HTMLParagraphElement,
  root: Document,
): HTMLParagraphElement => {
  const p = root.createElement('p');
  for (const attr of Array.from(source.attributes)) {
    p.setAttribute(attr.name, attr.value);
  }
  p.className = source.className;
  return p;
};

const flushBufferedNodes = (
  source: HTMLParagraphElement,
  root: Document,
  result: HTMLElement[],
  buffer: ChildNode[],
) => {
  if (buffer.length === 0) return;
  const p = cloneParagraphShell(source, root);
  for (const node of buffer) {
    p.appendChild(node);
  }
  result.push(p);
  buffer.length = 0;
};

const hasNonParagraphBlockChild = (paragraph: HTMLParagraphElement) => {
  return Array.from(paragraph.childNodes).some(isBlockLevelElement);
};

const hasMeaningfulInlineContent = (nodes: ChildNode[]) =>
  nodes.some((node) => !isIgnorableInlineNode(node) && !isLineBreakNode(node));

const nextMeaningfulNode = (
  nodes: ChildNode[],
  startIndex: number,
): ChildNode | null => {
  for (let i = startIndex; i < nodes.length; i++) {
    const node = nodes[i];
    if (isIgnorableInlineNode(node)) continue;
    return node;
  }
  return null;
};

const pushTextRunParagraphs = (
  source: HTMLParagraphElement,
  root: Document,
  result: HTMLElement[],
  run: ChildNode[],
) => {
  if (run.length === 0) return;

  let buffer: ChildNode[] = [];
  let changedByBreak = false;

  const flush = (forceBlank = false) => {
    if (!forceBlank && !hasMeaningfulInlineContent(buffer)) {
      buffer = [];
      return;
    }

    const p = cloneParagraphShell(source, root);
    if (forceBlank && !hasMeaningfulInlineContent(buffer)) {
      p.appendChild(root.createTextNode('　'));
    } else {
      for (const node of buffer) {
        p.appendChild(node);
      }
    }
    result.push(p);
    buffer = [];
  };

  for (const node of run) {
    if (isLineBreakNode(node)) {
      flush(true);
      changedByBreak = true;
      continue;
    }
    buffer.push(node);
  }

  flush(false);

  if (
    !changedByBreak &&
    result.length === 0 &&
    hasMeaningfulInlineContent(run)
  ) {
    const p = cloneParagraphShell(source, root);
    for (const node of run) {
      p.appendChild(node);
    }
    result.push(p);
  }
};

/**
 * pagination の float 処理は float 画像が先頭に来る前提が強い。
 * 段落の途中に float 画像がある場合、内部表現を float 先頭へ寄せる。
 * 先行ノードがテキストでも寄せるのは、エディタ上は画像がテキスト横に配置されている
 * のにプレビューでは画像が下へ落ちること、および float より上に残ったテキスト分の
 * 高さが CalculateNodeHeighter の float 分岐から欠落することを避けるため。
 * <br> を含む段落は行構成が変わるため従来どおり対象外とする。
 */
const normalizeFloatImageRunOrderForPagination = (
  paragraph: HTMLParagraphElement,
) => {
  const nodes = Array.from(paragraph.childNodes);
  if (nodes.some(isLineBreakNode)) return;

  const firstFloatIndex = nodes.findIndex(isFloatImageNode);
  if (firstFloatIndex <= 0) return;

  let cursor = firstFloatIndex;
  const floatRun: ChildNode[] = [];
  while (cursor < nodes.length) {
    const node = nodes[cursor];
    if (isFloatImageNode(node) || isIgnorableInlineNode(node)) {
      floatRun.push(node);
      cursor += 1;
      continue;
    }
    break;
  }

  if (!floatRun.some(isFloatImageNode)) return;

  const insertBefore = paragraph.firstChild;
  for (const node of floatRun) {
    paragraph.insertBefore(node, insertBefore);
  }
};

/**
 * float画像と後続テキストが同じ<p>に混在すると、float解除判定の本文高さから
 * 先頭テキストが漏れるため、画像runとテキストrunを段落単位に分けておく。
 */
const normalizeParagraphRunsForPagination = (
  container: HTMLElement,
  root: Document,
) => {
  const paragraphs = Array.from(container.querySelectorAll('p'));

  for (const paragraph of paragraphs) {
    if (hasNonParagraphBlockChild(paragraph)) continue;
    normalizeFloatImageRunOrderForPagination(paragraph);

    const nodes = Array.from(paragraph.childNodes);
    const hasFloatImage = nodes.some(isFloatImageNode);
    const hasBreak = nodes.some(isLineBreakNode);
    if (!hasFloatImage && !hasBreak) continue;

    const result: HTMLElement[] = [];
    const imageRun: ChildNode[] = [];
    let textRun: ChildNode[] = [];

    const flushImageRun = () => {
      if (imageRun.length === 0) return;
      flushBufferedNodes(paragraph, root, result, imageRun);
    };

    const flushTextRun = () => {
      if (textRun.length === 0) return;
      pushTextRunParagraphs(paragraph, root, result, textRun);
      textRun = [];
    };

    nodes.forEach((node, index) => {
      if (isFloatImageNode(node)) {
        flushTextRun();
        imageRun.push(node.cloneNode(true) as ChildNode);
        return;
      }

      if (isIgnorableInlineNode(node) && imageRun.length > 0) {
        const nextNode = nextMeaningfulNode(nodes, index + 1);
        if (nextNode && isFloatImageNode(nextNode)) {
          imageRun.push(node.cloneNode(true) as ChildNode);
          return;
        }
      }

      flushImageRun();
      textRun.push(node.cloneNode(true) as ChildNode);
    });

    flushImageRun();
    flushTextRun();

    if (result.length === 0) continue;

    result.forEach((node) => {
      paragraph.before(node);
    });
    paragraph.remove();
  }
};

/**
 * 同一段落内で複数のfloat画像が連続している場合、それらをまとめて新しい段落に切り出す
 * - 画像以外のノードは、float画像の前後にあっても無視して連続とみなす
 * - まとめる段落には float-image-run クラスを付与する
 * - 連続するfloat画像が2枚以上ある場合に適用する
 * - これにより、複数のfloat画像が連続している場合でも、画像同士が重なりすぎないようにする
 */
const normalizeConsecutiveFloatImageRuns = (
  container: HTMLElement,
  root: Document,
) => {
  const paragraphs = Array.from(container.querySelectorAll('p'));

  for (const paragraph of paragraphs) {
    const nodes = Array.from(paragraph.childNodes);
    const result: HTMLElement[] = [];
    const buffer: ChildNode[] = [];

    let index = 0;
    let changed = false;

    while (index < nodes.length) {
      const runImages: HTMLImageElement[] = [];
      let cursor = index;

      while (cursor < nodes.length) {
        const node = nodes[cursor];
        if (isFloatImageNode(node)) {
          runImages.push(node);
          cursor += 1;
          continue;
        }
        if (runImages.length > 0 && isIgnorableInlineNode(node)) {
          cursor += 1;
          continue;
        }
        break;
      }

      if (runImages.length >= 2) {
        changed = true;
        flushBufferedNodes(paragraph, root, result, buffer);

        const run = cloneParagraphShell(paragraph, root);
        run.classList.add('float-image-run');

        runImages.forEach((img) => {
          const clone = img.cloneNode(true) as HTMLImageElement;
          clone.style.float = 'none';
          clone.style.display = 'inline-block';
          clone.style.verticalAlign = 'top';
          run.appendChild(clone);
        });

        result.push(run);
        index = cursor;
        continue;
      }

      buffer.push(nodes[index].cloneNode(true) as ChildNode);
      index += 1;
    }

    flushBufferedNodes(paragraph, root, result, buffer);

    if (!changed) continue;

    result.forEach((node) => {
      paragraph.before(node);
    });
    paragraph.remove();
  }
};

/**
 * HTML文字列を解析し、先頭が <p> 要素であればその <p> を 先頭p要素とする
 * 先頭が <p> でない場合は、新規に <p> を作成して innerHTML に html を設定する
 * 先頭p要素にdivを作成して返す
 * - 空白テキストやコメントは先頭要素判定の対象外としてスキップします。
 * - 生成先の Document を指定したい場合は doc を渡してください（未指定なら window.document）。
 * - 先頭の<p>要素には、top-levelクラスを付与します。
 */
export const extractOrWrapParagraph = (
  html: string | undefined,
  doc?: Document,
  _div?: HTMLElement,
  opts?: { addTopLevel?: boolean },
): HTMLElement => {
  const root = doc ?? document;
  const shouldAddTopLevel = opts?.addTopLevel ?? true;
  const src = String(html ?? '');
  const source = root.createElement('div');
  const div = _div ?? root.createElement('div');

  source.innerHTML = src;
  removeEmptySizeAttributes(source);
  div.innerHTML = '';

  let firstParagraph: HTMLParagraphElement | null = null;
  let bufferedNodes: ChildNode[] = [];

  const flushParagraphBuffer = () => {
    if (bufferedNodes.length === 0) {
      return;
    }

    const p = root.createElement('p');
    for (const node of bufferedNodes) {
      p.appendChild(node);
    }
    bufferedNodes = [];

    div.appendChild(p);
    if (!firstParagraph) {
      firstParagraph = p;
    }
  };

  for (const node of Array.from(source.childNodes)) {
    if (isIgnorableTopLevelNode(node)) {
      continue;
    }

    if (isParagraphElement(node)) {
      flushParagraphBuffer();
      div.appendChild(node);
      if (!firstParagraph) {
        firstParagraph = node;
      }
      continue;
    }

    if (isBlockLevelElement(node)) {
      flushParagraphBuffer();
      div.appendChild(node);
      continue;
    }

    bufferedNodes.push(node);
  }

  flushParagraphBuffer();

  if (!firstParagraph && div.childNodes.length === 0) {
    const p = root.createElement('p');
    p.innerHTML = src;
    div.appendChild(p);
    firstParagraph = p;
  }

  normalizeParagraphRunsForPagination(div, root);
  normalizeConsecutiveFloatImageRuns(div, root);

  for (const paragraph of Array.from(div.querySelectorAll('p'))) {
    paragraph.classList.remove('top-level');
  }

  firstParagraph = div.querySelector('p');

  if (shouldAddTopLevel) {
    firstParagraph?.classList.add('top-level');
  }

  return div;
};

/**
 * パッチ更新後に必要な最小の整形を実施する
 * - 解説パーツは文分割（_divideSentences）を再適用
 * - 空ブロックは非表示（empty-hide-block）/ 内容ありは表示に戻す
 * - 高さを再計測して heighter を更新
 */
export const lightAdjustBlock = async (
  el: HTMLElement,
  opts?: { divide?: boolean },
): Promise<void> => {
  try {
    const part = el.dataset.part ?? '';
    const shouldDivide = opts?.divide !== false;

    // 解説側のみ文分割を再適用（オプションで無効化可能）
    if (part.startsWith('answer-') && shouldDivide) {
      await _divideSentences(el);
    }

    // 空ブロックの表示制御
    const hasImg = el.querySelector('img') !== null;
    const text = el.innerText?.trim() ?? '';
    const hasContent = hasImg || text.length > 0;
    if (!hasContent) {
      el.classList.add('empty-hide-block');
      el.style.display = 'none';
    } else {
      el.classList.remove('empty-hide-block');
      el.style.display = '';
    }

    // 高さを再計測（heighter属性更新）
    await CalculateNodeHeighter(el);
  } catch (e) {
    console.warn('lightAdjustBlock: 失敗しました', e);
  }
};

/**
 * viewer.html の動的描画内容を完全にクリアし、次の描画に備えてリセットします。
 * - `title-container` / `question-container` / `answer-container` の中身を空にする
 * - レンダリング中フラグ（`data-preview-rendering`）を除去
 * - 動的に注入したスタイル（KaTeX / プレビューモード切替）を除去
 * - 一時エリア（もし残っていた場合）も安全に除去
 *
 * 注意:
 * - viewer.html 内のテンプレート（#tmp-title / #tmp-test / #tmp-answer）は削除しません。
 * - 次回描画時に必要なスタイル（KaTeXやモード切替）は別途再注入してください。
 */
export const clearViewerDocument = (doc: Document): void => {
  try {
    // レンダリング中フラグをクリア
    doc.documentElement.removeAttribute('data-preview-rendering');

    // 動的スタイルを除去（KaTeX / モード切替）
    /*
    doc.head
      .querySelectorAll(
        'style[data-katex-style="1"], style[data-preview-mode-style]',
      )
      .forEach((style) => {
        style.remove();
      });
      */

    // 動的に追加した内容をクリア（テンプレートはそのまま）
    const containerIds = [
      'title-container',
      'question-container',
      'answer-container',
    ];
    for (const id of containerIds) {
      const el = doc.getElementById(id);
      if (el) {
        el.innerHTML = '';
      }
    }

    // 念のため一時エリアが残っていれば除去
    doc
      .querySelectorAll('[id^="question-area-"], [id^="answer-area-"]')
      .forEach((node) => {
        node.remove();
      });
  } catch (e) {
    console.warn('clearViewerDocument: クリア処理に失敗しました', e);
  }
};

export const purgeStaleItemNodes = (doc: Document, activeId: string): void => {
  try {
    const nodes = doc.querySelectorAll<HTMLElement>('[data-item-id]');
    nodes.forEach((el) => {
      if (el.dataset.itemId && el.dataset.itemId !== activeId) {
        el.remove();
      }
    });
  } catch (e) {
    console.warn('purgeStaleItemNodes: 失敗しました', e);
  }
};
