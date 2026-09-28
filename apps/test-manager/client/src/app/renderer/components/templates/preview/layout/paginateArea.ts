import { atomicBodyProcess } from './atomicBodyProcess';
import {
  appendPaginateDebugBadge,
  bodyProcess,
  flushPendingLeadBlock,
  initializeFirst,
  initializeSection,
} from './paginateAreaHelper';
import type { PageMapEntry } from './types';
import {
  CalculateNodeHeighter,
  GetNodeHeighter,
  PREVIEW_ROOT_SELECTOR,
  PXToMM,
} from './utils';

const IS_DISPLAY_LOG = false;
const debugLog = (...args: unknown[]) => {
  if (!IS_DISPLAY_LOG) return;
  console.log(...args);
};

export type PaginateMetrics = {
  baseHeightPx: number;
  wrapperPaddingTopPx: number;
  wrapperPaddingBottomPx: number;
  wrapperVerticalPaddingPx: number;
  floatImageScale: number;
};

export type PaginateAreaParams = {
  areaNodes: HTMLCollection;
  prefix: 'question' | 'answer';
  root: Document;
  pageMapByItemId: Map<string, PageMapEntry>;
  resetPageCount?: boolean;
};

export type StashKind = 'carry-over' | 'float-work';

export type StashEntry = {
  node: HTMLElement;
  height: number;
  kind: StashKind;
};

export type PendingLeadBlock = {
  block: HTMLElement;
  group: HTMLElement;
  height: number;
  itemId?: string;
};

export type PaginateRuntime = {
  prefix: 'question' | 'answer';
  count: number;
  endPage: number;
  currentPage: number;

  root: Document;
  wrapper: HTMLElement | null;
  group: HTMLElement | null;
  block: HTMLElement | null;
  section: HTMLElement | null;
  container: HTMLElement | null;
  sectionHeight: number;
  stash: StashEntry[];
  stashHeight: number;
  pendingLeadBlock: PendingLeadBlock | null;

  float: {
    isImageMode: boolean;
    stashNode: HTMLElement | null;
    imageHeightBasis: number;
    nodeHeight: number;
    sideTextHeight: number;
    wrapHeightBasis: number;
    wrapTextHeight: number;
    parentBlock: HTMLElement | null;
    parentGroup: HTMLElement | null;
    currentBlockNode: HTMLElement | null;
    isChangeBlock: boolean;
    parentBlockWidth: number;
    // フロート画像モード中に stashNode 内へ追加したセンテンスのクローンと高さを末尾追加順で保持する。
    // EndFloatImageMode で現ページに収まらない場合、末尾から取り外して次ページへ送るために使う。
    textEntries: Array<{
      node: HTMLElement;
      height: number;
      keepWithNext?: boolean;
    }>;
  };
  isAnswerTitle: boolean;
  metrics: PaginateMetrics;
};

const resolveLayoutProbeHost = (root: Document): HTMLElement => {
  const previewRoot = root.querySelector(PREVIEW_ROOT_SELECTOR);
  if (previewRoot instanceof HTMLElement) {
    return previewRoot;
  }

  return root.body ?? root.documentElement;
};

const parsePx = (value?: string): number =>
  Number.parseFloat(value ?? '0') || 0;

const resolvePaginateMetrics = (
  root: Document,
  prefix: 'question' | 'answer',
): PaginateMetrics => {
  const host = resolveLayoutProbeHost(root);

  const pageProbe = root.createElement('section');
  pageProbe.classList.add('print-page');
  pageProbe.style.position = 'absolute';
  pageProbe.style.left = '-10000px';
  pageProbe.style.top = '0';
  pageProbe.style.visibility = 'hidden';
  pageProbe.style.pointerEvents = 'none';
  host.appendChild(pageProbe);

  const pageHeightPx = pageProbe.getBoundingClientRect().height;
  pageProbe.remove();

  const wrapperProbe = root.createElement('div');
  wrapperProbe.classList.add(`${prefix}-wrapper`);
  wrapperProbe.style.position = 'absolute';
  wrapperProbe.style.left = '-10000px';
  wrapperProbe.style.top = '0';
  wrapperProbe.style.visibility = 'hidden';
  wrapperProbe.style.pointerEvents = 'none';
  host.appendChild(wrapperProbe);

  const cs = root.defaultView?.getComputedStyle(wrapperProbe);
  const wrapperPaddingTopPx = parsePx(cs?.paddingTop);
  const wrapperPaddingBottomPx = parsePx(cs?.paddingBottom);
  const floatImageScale =
    Number.parseFloat(cs?.getPropertyValue('--image-scale') ?? '1') || 1;
  wrapperProbe.remove();

  const rootStyle = root.defaultView?.getComputedStyle(root.documentElement);
  const footerReserveMm =
    Number.parseFloat(
      rootStyle?.getPropertyValue('--page-footer-reserve-mm') ?? '0',
    ) || 0;
  const footerReservePx = footerReserveMm / PXToMM;
  console.log('Resolved paginate metrics:', footerReserveMm);
  //  const topReserveOx = 5 / PXToMM; // ページ上部の余白（mm）をpxに換算したもの。これも余白として考慮する。CSSの方でページ上部に5mmの余白を取っているため。

  // patch 表示モードは紙の再現（改ページ）を行わないため、改ページ判定の基準高さを
  // 実質無限大にして「常に 1 ページに収まる」状態にする（案C / Bug 4+11）。
  // createPdf 系ではこの属性を設定しないため常に false となり、改ページ挙動は不変。
  const isPatchDisplay =
    root.documentElement.getAttribute('data-preview-display-mode') === 'patch';

  const normalBaseHeightPx = Math.max(
    1,
    pageHeightPx - footerReservePx - wrapperPaddingTopPx - wrapperPaddingBottomPx,
  );

  return {
    baseHeightPx: isPatchDisplay
      ? Number.MAX_SAFE_INTEGER
      : normalBaseHeightPx,
    wrapperPaddingTopPx,
    wrapperPaddingBottomPx,
    wrapperVerticalPaddingPx: wrapperPaddingTopPx + wrapperPaddingBottomPx,
    floatImageScale,
  };
};

const isStandaloneHeadingNode = (node: HTMLElement) =>
  node.classList.contains('subcategory-name') ||
  node.classList.contains('question-sub-title') ||
  node.classList.contains('answer-sub-title');

export const paginateArea = async (
  params: PaginateAreaParams,
): Promise<number> => {
  const { areaNodes, prefix, root, pageMapByItemId } = params;
  const runtime: PaginateRuntime = {
    prefix,
    count: 0,
    endPage: 1,
    currentPage: 1,

    root,
    wrapper: null as HTMLElement | null,
    group: null as HTMLElement | null,
    block: null as HTMLElement | null,
    section: null as HTMLElement | null,
    container: null as HTMLElement | null,
    sectionHeight: 0,
    stash: [] as StashEntry[],
    stashHeight: 0,
    pendingLeadBlock: null,

    float: {
      isImageMode: false,
      stashNode: null as HTMLElement | null,
      imageHeightBasis: 0,
      nodeHeight: 0,
      sideTextHeight: 0,
      wrapHeightBasis: 0,
      wrapTextHeight: 0,
      parentBlock: null as HTMLElement | null,
      parentGroup: null as HTMLElement | null,
      currentBlockNode: null as HTMLElement | null,
      isChangeBlock: false,
      parentBlockWidth: 0,
      textEntries: [] as Array<{ node: HTMLElement; height: number }>,
    },
    isAnswerTitle: false,
    metrics: resolvePaginateMetrics(root, prefix),
  };
  runtime.container = root.getElementById(`${prefix}-container`);
  if (!runtime.container)
    throw new Error(`Container with id ${prefix}-container not found`);
  runtime.section = initializeFirst(root, runtime, {
    resetPageCount: params.resetPageCount,
  });

  debugLog('Starting pagination process with areaNodes:', areaNodes);
  while (areaNodes.length > runtime.count) {
    // console.log(count);
    const node = areaNodes[runtime.count] as HTMLElement;
    debugLog('Processing answer node:', node, node.innerHTML);
    if (isStandaloneHeadingNode(node)) {
      // area 直下の単独見出しは wrapper に包まず、そのノード自身を高さ計測して配置する。
      await CalculateNodeHeighter(node, undefined, {
        imageScale: runtime.metrics.floatImageScale,
      });
      const nodeHeight = GetNodeHeighter(node);
      if (runtime.sectionHeight > 0) {
        appendPaginateDebugBadge(runtime, {
          reason: 'standalone-heading-break',
          overflowPx:
            runtime.sectionHeight + nodeHeight - runtime.metrics.baseHeightPx,
          currentHeight: runtime.sectionHeight,
          nodiesHeight: nodeHeight,
          baseHeightPx: runtime.metrics.baseHeightPx,
        });
        initializeSection(runtime, false);
      }
      if (!runtime.section) {
        runtime.section = initializeFirst(runtime.root, runtime);
      }
      runtime.section.appendChild(node.cloneNode(true));
      runtime.sectionHeight += nodeHeight;
    } else if (prefix === 'question') {
      const itemId = node.dataset.itemId;
      // forcePageBreak フラグが立っており、すでにページに内容がある場合は強制改ページ
      if (node.dataset.forcePageBreak === '1' && runtime.sectionHeight > 0) {
        initializeSection(runtime, false);
      }
      await atomicBodyProcess(runtime, node, pageMapByItemId, itemId);
    } else {
      const itemId = node.dataset.itemId;
      // forcePageBreak フラグが立っており、すでにページに内容がある場合は強制改ページ
      if (node.dataset.forcePageBreak === '1' && runtime.sectionHeight > 0) {
        initializeSection(runtime, false);
      }
      await bodyProcess(runtime, node, pageMapByItemId, itemId);
    }
    runtime.count++;
  }
  flushPendingLeadBlock(runtime, pageMapByItemId);
  if (runtime.section) {
    debugLog(
      'Appending final section to container:',
      runtime.section,
      runtime.section.innerHTML,
      runtime.container,
    );
    if (!runtime.section.getAttribute('heighter')) {
      runtime.section.setAttribute('heighter', String(runtime.sectionHeight));
    }
    runtime.container?.appendChild(runtime.section);
    runtime.endPage++;
  }

  return runtime.endPage;
};
