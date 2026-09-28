import type {
  PaginateRuntime,
  StashKind,
} from '@templates/preview/layout/paginateArea';
import type { PageMapEntry } from './types';
import {
  _divideSentences,
  CalculateNodeHeighter,
  FLOAT_IMAGE_OFFSET,
  GetNodeHeighter,
  searchFloatImage,
} from './utils';

const IS_DISPLAY_LOG = false;
const debugLog = (...args: unknown[]) => {
  if (!IS_DISPLAY_LOG) return;
  console.log(...args);
};

const keepWithNextSentenceMatchers = [
  {
    name: 'half-width-square-bracket',
    test: (text: string) => /^\[[^\]]+\]$/.test(text),
  },
  {
    name: 'full-width-square-bracket',
    test: (text: string) => /^［[^］]+］$/.test(text),
  },
];

const getKeepWithNextSentenceMatch = (node: HTMLElement) => {
  const text = node.textContent?.trim() ?? '';
  if (text.length === 0) return null;
  return (
    keepWithNextSentenceMatchers.find((matcher) => matcher.test(text)) ?? null
  );
};

const isKeepWithNextSentence = (node: HTMLElement) =>
  getKeepWithNextSentenceMatch(node) !== null;

const getPaginateDebugImageAlt = (root: Document) =>
  root.documentElement.getAttribute('data-paginate-debug-image-alt') ?? '';

const collectImageAlts = (node: HTMLElement) =>
  Array.from(node.getElementsByTagName('img')).map((img) => img.alt);

const isPaginateDebugTargetNode = (
  runtime: PaginateRuntime,
  node: HTMLElement,
) => {
  const targetAlt = getPaginateDebugImageAlt(runtime.root);
  if (!targetAlt) return false;
  return collectImageAlts(node).some((alt) => alt.includes(targetAlt));
};

const summarizeTargetSection = (section: HTMLElement) => ({
  heighter: section.getAttribute('heighter'),
  imageAlts: collectImageAlts(section),
  debugBadges: Array.from(
    section.getElementsByClassName('paginate-debug-badge'),
  ).map((badge) => badge.textContent ?? ''),
  floatComposites: Array.from(
    section.getElementsByClassName('float-composite'),
  ).map((node) => ({
    className: node.className,
    heighter: node.getAttribute('heighter'),
    imageAlts: collectImageAlts(node as HTMLElement),
  })),
});

const isFloatWrapHeightTarget = (
  runtime: PaginateRuntime,
  node: HTMLElement,
  wrapHeightBasis: number,
) =>
  wrapHeightBasis > 0 &&
  runtime.float.currentBlockNode === runtime.block &&
  node.classList.contains('sub-dividable-sentence') &&
  !node.classList.contains('stashed') &&
  !node.classList.contains('float-inner-node') &&
  !searchFloatImage(node);

const resolveFloatWrapHeight = (
  nodeHeight: number,
  wrapTextHeight: number,
  wrapHeightBasis: number,
) => {
  const previousHeight = Math.max(wrapTextHeight, wrapHeightBasis);
  const nextTextHeight = wrapTextHeight + nodeHeight;
  const nextHeight = Math.max(nextTextHeight, wrapHeightBasis);
  const height = nextHeight - previousHeight;

  if (nextTextHeight >= wrapHeightBasis) {
    return { height, wrapTextHeight: 0, wrapHeightBasis: 0 };
  }

  return { height, wrapTextHeight: nextTextHeight, wrapHeightBasis };
};

const consumeFloatWrapHeight = (
  runtime: PaginateRuntime,
  node: HTMLElement,
  nodeHeight: number,
) => {
  const { float } = runtime;
  if (!isFloatWrapHeightTarget(runtime, node, float.wrapHeightBasis)) {
    return nodeHeight;
  }

  const resolved = resolveFloatWrapHeight(
    nodeHeight,
    float.wrapTextHeight,
    float.wrapHeightBasis,
  );
  float.wrapTextHeight = resolved.wrapTextHeight;
  float.wrapHeightBasis = resolved.wrapHeightBasis;
  return resolved.height;
};

const calculateNodiesHeight = (
  runtime: PaginateRuntime,
  entries: Array<{ node: HTMLElement }>,
) => {
  let wrapTextHeight = runtime.float.wrapTextHeight;
  let wrapHeightBasis = runtime.float.wrapHeightBasis;

  return entries.reduce((sum, entry) => {
    const nodeHeight = GetNodeHeighter(entry.node);
    if (!isFloatWrapHeightTarget(runtime, entry.node, wrapHeightBasis)) {
      return sum + nodeHeight;
    }

    const resolved = resolveFloatWrapHeight(
      nodeHeight,
      wrapTextHeight,
      wrapHeightBasis,
    );
    wrapTextHeight = resolved.wrapTextHeight;
    wrapHeightBasis = resolved.wrapHeightBasis;
    return sum + resolved.height;
  }, 0);
};

const createFloatCompositeNode = (
  target: HTMLElement,
  root: Document,
): HTMLElement => {
  const composite = root.createElement('div');
  for (const attr of Array.from(target.attributes)) {
    composite.setAttribute(attr.name, attr.value);
  }
  composite.classList.add('sub-dividable-sentence', 'float-composite');
  composite.classList.remove('float-inner-node', 'stashed');
  composite.replaceChildren(
    ...Array.from(target.childNodes).map((node) => node.cloneNode(true)),
  );
  return composite;
};

const cloneFloatSentence = (target: HTMLElement): HTMLElement => {
  const cloned = target.cloneNode(true) as HTMLElement;
  cloned.classList.add('float-sentence');
  return cloned;
};

const isWhitespaceTextNode = (node: ChildNode) =>
  node.nodeType === Node.TEXT_NODE &&
  (node.textContent?.trim().length ?? 0) === 0;

const nextMeaningfulChild = (node: ChildNode): ChildNode | null => {
  let current = node.nextSibling;
  while (current) {
    if (!isWhitespaceTextNode(current)) return current;
    current = current.nextSibling;
  }
  return null;
};

const moveLeadingChoiceMarkerToFirstFloatSentence = (
  floatComposite: HTMLElement | null,
  firstFloatSentence: HTMLElement,
) => {
  if (!floatComposite?.classList.contains('top-level')) return;
  if (!floatComposite.contains(firstFloatSentence)) return;

  const existingFloatSentence = floatComposite.querySelector(
    '.float-inner-node.float-sentence',
  );
  if (existingFloatSentence !== firstFloatSentence) return;

  const markerNode = Array.from(floatComposite.childNodes).find(
    (node) => !isWhitespaceTextNode(node),
  );
  if (!markerNode || markerNode.nodeType !== Node.TEXT_NODE) return;

  const marker = markerNode.textContent?.trim() ?? '';
  if (!/^[0-9０-９]+[．.]$/.test(marker)) return;

  const nextNode = nextMeaningfulChild(markerNode);
  if (
    nextNode?.nodeType !== Node.ELEMENT_NODE ||
    (nextNode as Element).tagName.toUpperCase() !== 'IMG'
  ) {
    return;
  }

  markerNode.remove();
  firstFloatSentence.prepend(
    firstFloatSentence.ownerDocument.createTextNode(marker),
  );
  firstFloatSentence.classList.add('top-level');
  floatComposite.classList.remove('top-level');
};

const remeasureStashSentenceHeight = async (
  runtime: PaginateRuntime,
  stashNode: HTMLElement,
  fallback: number,
): Promise<number> => {
  const block = runtime.block;
  if (!block) return fallback;

  const host = runtime.root.body ?? runtime.root.documentElement;
  const probeBlock = block.cloneNode(true) as HTMLElement;

  // 既存センテンスがある block に live append すると重複して壊れるので、
  // 必ず切り離した probeBlock 上で再計測する。
  // const liveBlockWidth = 496.83; //block.getBoundingClientRect().width;
  const liveBlockWidth = runtime.float.parentBlockWidth;
  if (liveBlockWidth > 0) {
    probeBlock.style.width = `${liveBlockWidth}px`;
    probeBlock.style.boxSizing = 'border-box';
  }
  probeBlock.removeAttribute('heighter');
  probeBlock.style.position = 'absolute';
  probeBlock.style.left = '-10000px';
  probeBlock.style.top = '0';
  probeBlock.style.visibility = 'hidden';
  probeBlock.style.pointerEvents = 'none';

  host.appendChild(probeBlock);
  const baseHeight = probeBlock.offsetHeight;

  const probeSentence = stashNode.cloneNode(true) as HTMLElement;
  probeSentence.removeAttribute('heighter');
  probeBlock.appendChild(probeSentence);

  const measured = probeBlock.offsetHeight - baseHeight;
  probeBlock.remove();

  return measured > 0 ? measured : fallback;
};

export const initializeFirst = (
  root: Document,
  runtime: PaginateRuntime,
  options?: { resetPageCount?: boolean },
) => {
  const _section = root.createElement('section');
  _section.classList.add('print-page');
  if (options?.resetPageCount) {
    // _section.classList.add('page-counter-reset');
    _section.style.counterSet = 'preview-page 0';
    runtime.currentPage = 1;
  }
  runtime.sectionHeight = 0;
  if (!runtime.wrapper) {
    runtime.wrapper = root.createElement('div');
    runtime.wrapper.classList.add(`${runtime.prefix}-wrapper`);
    runtime.wrapper.classList.add(`${runtime.prefix}-section-div`);
  }

  return _section;
};

export const addNode = (
  node: HTMLElement,
  isFront = false,
  runtime: PaginateRuntime,
) => {
  const { section, wrapper, group, block } = runtime;
  debugLog(
    'Adding node:',
    node,
    'to section:',
    section,
    'wrapper:',
    wrapper,
    'group:',
    group,
    'block:',
    block,
  );
  if (!section || !wrapper || !group || !block) return;

  const cloned = node.cloneNode(true) as HTMLElement;

  if (node.classList.contains('test-section-div')) {
    isFront ? section.prepend(cloned) : section.appendChild(cloned);
  }
  if (node.classList.contains('sub-dividable-group')) {
    isFront ? wrapper.prepend(cloned) : wrapper.appendChild(cloned);
  }
  if (node.classList.contains('sub-dividable-block')) {
    isFront ? group.prepend(cloned) : group.appendChild(cloned);
  }
  if (node.classList.contains('sub-dividable-sentence')) {
    isFront ? block.prepend(cloned) : block.appendChild(cloned);
  }

  const nodeHeight = GetNodeHeighter(node);
  const beforeHeight = runtime.sectionHeight;
  const consumedHeight = consumeFloatWrapHeight(runtime, node, nodeHeight);
  runtime.sectionHeight += consumedHeight;
  warnPaginateTargetDebug(runtime, node, '[paginate] addNode target', {
    beforeHeight,
    nodeHeight,
    consumedHeight,
    afterHeight: runtime.sectionHeight,
    className: node.className,
    heighter: node.getAttribute('heighter'),
    imageAlts: collectImageAlts(node),
    sectionContainsBlock: section.contains(block),
    sectionContainsCloned: section.contains(cloned),
    sectionHasTargetAfterAppend: isPaginateDebugTargetNode(runtime, section),
    wrapperClassName: wrapper.className,
    groupClassName: group.className,
    blockClassName: block.className,
  });
};

const shouldKeepEmptyPreviewBlock = (block: HTMLElement) => {
  const part = block.dataset.part ?? '';
  return (
    block.classList.contains('empty-hide-block') ||
    part === 'question-text' ||
    part === 'answer-text' ||
    part === 'question-choice' ||
    part === 'answer-choice'
  );
};

export const addStashNode = async (
  runtime: PaginateRuntime,
  node: HTMLElement,
  height?: number,
  kind: StashKind = 'carry-over',
  isUnshift = false,
): Promise<number> => {
  if (height === undefined) {
    await CalculateNodeHeighter(node, undefined, {
      imageScale: runtime.metrics.floatImageScale,
    });
    height = GetNodeHeighter(node);
  }
  node.classList.add('stashed');
  if (isUnshift) {
    runtime.stash.unshift({ node, height, kind });
  } else {
    runtime.stash.push({ node, height, kind });
  }
  runtime.stashHeight += height;
  return height;
};

const isPaginateDebug = (root: Document) =>
  root.documentElement.getAttribute('data-show-paginate-debug') === '1';

const warnPaginateTargetDebug = (
  runtime: PaginateRuntime,
  node: HTMLElement,
  message: string,
  payload: Record<string, unknown>,
) => {
  if (!isPaginateDebug(runtime.root)) return;
  if (!isPaginateDebugTargetNode(runtime, node)) return;
  console.warn(message, payload);
};

export const appendPaginateDebugBadge = (
  runtime: PaginateRuntime,
  payload: {
    overflowPx: number;
    currentHeight: number;
    nodiesHeight: number;
    baseHeightPx: number;
    reason?: string;
  },
) => {
  if (!isPaginateDebug(runtime.root) || !runtime.section) return;

  const badge = runtime.root.createElement('div');
  badge.className = 'paginate-debug-badge';
  const remainingPx = payload.baseHeightPx - payload.currentHeight;
  const parts = [];

  if (payload.reason) {
    parts.push(`理由 ${payload.reason}`);
  }
  if (payload.overflowPx > 0.75) {
    parts.push(`不足 ${payload.overflowPx.toFixed(2)}px`);
  }
  parts.push(`残り ${remainingPx.toFixed(2)}px`);
  parts.push(`current ${payload.currentHeight.toFixed(2)}`);
  parts.push(`node ${payload.nodiesHeight.toFixed(2)}`);
  parts.push(`base ${payload.baseHeightPx.toFixed(2)}`);

  badge.textContent = parts.join(' / ');

  runtime.section.appendChild(badge);
};

const setPendingLeadItemPage = (
  runtime: PaginateRuntime,
  pageMapByItemId: Map<string, PageMapEntry>,
) => {
  const itemId = runtime.pendingLeadBlock?.itemId;
  if (!itemId) return;

  const entry = pageMapByItemId.get(itemId);
  if (!entry) return;

  if (runtime.prefix === 'answer') {
    entry.answerPage = runtime.currentPage;
  } else {
    entry.questionPage = runtime.currentPage;
  }
  pageMapByItemId.set(itemId, entry);
};

type PendingLeadRuntimeBlock = NonNullable<
  PaginateRuntime['pendingLeadBlock']
>;

const ensurePendingLeadTarget = (runtime: PaginateRuntime) => {
  if (!runtime.section || !runtime.pendingLeadBlock) return false;

  if (!runtime.wrapper) {
    runtime.wrapper = runtime.root.createElement('div');
    runtime.wrapper.classList.add(`${runtime.prefix}-wrapper`);
    runtime.section.appendChild(runtime.wrapper);
    runtime.sectionHeight += runtime.metrics.wrapperVerticalPaddingPx;
  }

  return true;
};

const insertPendingLeadGroup = (
  runtime: PaginateRuntime,
  pending: PendingLeadRuntimeBlock,
  beforeGroup?: HTMLElement | null,
) => {
  if (!runtime.wrapper) return false;

  const leadGroup = pending.group.cloneNode(false) as HTMLElement;
  leadGroup.appendChild(pending.block.cloneNode(true) as HTMLElement);
  const ref =
    beforeGroup && runtime.wrapper.contains(beforeGroup) ? beforeGroup : null;
  runtime.wrapper.insertBefore(leadGroup, ref);
  runtime.sectionHeight += pending.height;
  return true;
};

export const flushPendingLeadBlock = (
  runtime: PaginateRuntime,
  pageMapByItemId: Map<string, PageMapEntry>,
) => {
  const pending = runtime.pendingLeadBlock;
  if (!pending) return;

  const needsWrapperPadding = runtime.wrapper === null;
  const projectedHeight =
    runtime.sectionHeight +
    (needsWrapperPadding ? runtime.metrics.wrapperVerticalPaddingPx : 0) +
    pending.height;

  if (projectedHeight > runtime.metrics.baseHeightPx) {
    appendPaginateDebugBadge(runtime, {
      reason: 'pending-meta-final-break',
      overflowPx: projectedHeight - runtime.metrics.baseHeightPx,
      currentHeight: runtime.sectionHeight,
      nodiesHeight:
        (needsWrapperPadding ? runtime.metrics.wrapperVerticalPaddingPx : 0) +
        pending.height,
      baseHeightPx: runtime.metrics.baseHeightPx,
    });
    initializeSection(runtime, false);
  }

  if (!ensurePendingLeadTarget(runtime)) return;

  if (!insertPendingLeadGroup(runtime, pending)) return;
  setPendingLeadItemPage(runtime, pageMapByItemId);
  runtime.pendingLeadBlock = null;
};

const addJudgeNodies = async (
  runtime: PaginateRuntime,
  nodies?: HTMLElement[],
  pageMapByItemId?: Map<string, PageMapEntry>,
) => {
  const { section, block, stash, prefix } = runtime;
  debugLog(
    'Adding judge nodies. Current stash:',
    stash,
    'Section height:',
    runtime.sectionHeight,
    'Nodies to add:',
    nodies,
    section,
    block,
  );
  if (!section || !block) return false;

  const currentEntries = (nodies ?? []).map((node) => ({
    node,
    kind: 'current' as const,
  }));

  const stashEntries = runtime.stash;
  const entriesBase =
    nodies === undefined ? stashEntries : [...stashEntries, ...currentEntries];
  const pendingLeadBlock = runtime.pendingLeadBlock;
  const pendingLeadEntry =
    pendingLeadBlock !== null
      ? {
          node: pendingLeadBlock.block,
          height: pendingLeadBlock.height,
          kind: 'carry-over' as const,
        }
      : null;
  const entries = entriesBase;

  if (entries.length === 0 && pendingLeadEntry === null) return false;

  const targetEntries = [
    ...(pendingLeadEntry ? [pendingLeadEntry] : []),
    ...entries,
  ].filter((entry) =>
    isPaginateDebugTargetNode(runtime, entry.node),
  );
  if (targetEntries.length > 0 && isPaginateDebug(runtime.root)) {
    console.warn('[paginate] addJudgeNodies target entries', {
      sectionHeight: runtime.sectionHeight,
      stashHeight: runtime.stashHeight,
      entries: targetEntries.map((entry) => ({
        kind: entry.kind,
        className: entry.node.className,
        heighter: entry.node.getAttribute('heighter'),
        entryHeight: 'height' in entry ? entry.height : undefined,
        isFloatComposite: entry.node.classList.contains('float-composite'),
        isStashed: entry.node.classList.contains('stashed'),
        imageAlts: collectImageAlts(entry.node),
        text: entry.node.textContent?.trim().slice(0, 80) ?? '',
      })),
    });
  }

  const firstNode = pendingLeadEntry?.node ?? entries[0]?.node;

  //ノードの一行目が<br>または<p> </p>の場合削除
  const deleteFirstBreakLine = (node: HTMLElement) => {
    let html = node.innerHTML;
    const reg = /^<br>/i;
    const reg2 = /^<p ?[^>]*>\s*<\/p>/i;
    while (reg.test(html) || reg2.test(html)) {
      html = html.replace(reg, '');
      html = html.replace(reg2, '');
    }
    node.innerHTML = html;
  };

  const nodiesHeight =
    calculateNodiesHeight(runtime, entries) + (pendingLeadEntry?.height ?? 0);

  const currentHeight = runtime.sectionHeight;
  let didPageBreak = false;
  const overflowPx =
    currentHeight + nodiesHeight - runtime.metrics.baseHeightPx;

  if (overflowPx > 0.75) {
    if (
      isPaginateDebug(runtime.root) &&
      (targetEntries.length > 0 || isPaginateDebugTargetNode(runtime, section))
    ) {
      console.warn('[paginate] add-judge-overflow target break', {
        currentHeight,
        nodiesHeight,
        overflowPx,
        baseHeightPx: runtime.metrics.baseHeightPx,
        sectionHasTarget: isPaginateDebugTargetNode(runtime, section),
        targetEntries: targetEntries.map((entry) => ({
          kind: entry.kind,
          className: entry.node.className,
          heighter: entry.node.getAttribute('heighter'),
          entryHeight: 'height' in entry ? entry.height : undefined,
          imageAlts: collectImageAlts(entry.node),
        })),
        section: summarizeTargetSection(section),
      });
    }
    appendPaginateDebugBadge(runtime, {
      reason: 'add-judge-overflow',
      overflowPx,
      currentHeight,
      nodiesHeight,
      baseHeightPx: runtime.metrics.baseHeightPx,
    });

    didPageBreak = true;
    section.setAttribute('heighter', String(currentHeight));
    // 改ページ
    initializeSection(runtime, true);
    runtime.float.wrapHeightBasis = 0;
    runtime.float.wrapTextHeight = 0;
    if (firstNode) {
      deleteFirstBreakLine(firstNode);
    }
    if (block.classList.contains(`${prefix}-p`)) {
      if (firstNode && !firstNode.innerText.match(/^[0-9][．]/i)) {
        if (!firstNode.innerHTML.match(/^<img/i) && currentHeight > 0) {
          //          firstNode.setAttribute('style', 'padding-left: 1.5em;');
          firstNode.classList.add('set-padding');
        } else {
          firstNode.classList.add('no-padding');
        }
      }
    }
  }

  if (pendingLeadBlock !== null) {
    insertPendingLeadGroup(runtime, pendingLeadBlock, runtime.group);
  }

  entries.forEach((entry) => {
    const shouldPrepend =
      entry.kind === 'carry-over' &&
      runtime.block !== null &&
      runtime.block.childElementCount === 0;

    addNode(entry.node, shouldPrepend, runtime);
  });
  if (pageMapByItemId) {
    setPendingLeadItemPage(runtime, pageMapByItemId);
  }
  runtime.stash = [];
  runtime.stashHeight = 0;
  runtime.pendingLeadBlock = null;
  return didPageBreak;
};

const EndFloatImageMode = async (
  heighter: number,
  runtime: PaginateRuntime,
  pageMapByItemId?: Map<string, PageMapEntry>,
) => {
  const { float, block, group } = runtime;
  const { stashNode: floatStashNode } = float;
  if (
    !floatStashNode ||
    !block ||
    !group ||
    !float.parentBlock ||
    !float.parentGroup
  )
    return;

  // 現ページに収まらないが、画像分(imageHeightBasis + OFFSET)だけなら収まる場合は、
  // 末尾の textEntries を 1 件ずつ DOM から取り外して、現ページに残せる最小限まで縮める。
  // 取り外したセンテンスは後段で次ページにキャリーオーバーする。
  const remaining = runtime.metrics.baseHeightPx - runtime.sectionHeight;
  const minHeight = float.imageHeightBasis + FLOAT_IMAGE_OFFSET;
  const popped: Array<{ node: HTMLElement; height: number }> = [];
  let textTotal = float.sideTextHeight;
  let effectiveHeighter = Math.max(heighter, minHeight);

  if (effectiveHeighter > remaining && minHeight <= remaining) {
    const popTextEntry = () => {
      const last = float.textEntries.pop();
      if (!last) return null;
      last.node.remove();
      popped.unshift(last);
      textTotal -= last.height;
      return last;
    };
    const popDanglingKeepWithNext = () => {
      while (float.textEntries.at(-1)?.keepWithNext) {
        popTextEntry();
      }
    };

    let blockH = Math.max(textTotal, minHeight);
    while (blockH > remaining && float.textEntries.length > 0) {
      const last = float.textEntries[float.textEntries.length - 1];
      const newTextTotal = textTotal - last.height;
      const newBlockH = Math.max(newTextTotal, minHeight);
      // text が既に画像分を下回っていれば、これ以上縮められない
      if (newBlockH >= blockH) break;
      popTextEntry();
      popDanglingKeepWithNext();
      blockH = newBlockH;
      blockH = Math.max(textTotal, minHeight);
      if (blockH <= remaining) break;
    }
    effectiveHeighter = blockH;
  }
  float.sideTextHeight = textTotal;

  const measuredHeight = await remeasureStashSentenceHeight(
    runtime,
    floatStashNode,
    effectiveHeighter,
  );
  floatStashNode.setAttribute('heighter', String(measuredHeight));
  const stashEntry = runtime.stash.find(
    (entry) => entry.node === floatStashNode,
  );
  if (stashEntry) {
    runtime.stashHeight += measuredHeight - stashEntry.height;
    stashEntry.height = measuredHeight;
    warnPaginateTargetDebug(
      runtime,
      floatStashNode,
      '[paginate] synced float stash height',
      {
        measuredHeight,
        stashHeight: runtime.stashHeight,
        className: floatStashNode.className,
        textTotal,
        effectiveHeighter,
        imageAlts: collectImageAlts(floatStashNode),
      },
    );
  }

  const stashBlock = block;
  const stashGroup = group;

  const isFloatParentConnected =
    (runtime.section?.contains(float.parentBlock) ?? false) &&
    (runtime.section?.contains(float.parentGroup) ?? false);
  runtime.block = isFloatParentConnected ? float.parentBlock : stashBlock;
  runtime.group = isFloatParentConnected ? float.parentGroup : stashGroup;
  if (!isFloatParentConnected) {
    float.parentBlock = runtime.block;
    float.parentGroup = runtime.group;
    warnPaginateTargetDebug(
      runtime,
      floatStashNode,
      '[paginate] resolved detached float parent',
      {
        blockClassName: runtime.block.className,
        groupClassName: runtime.group.className,
        sectionContainsBlock: runtime.section?.contains(runtime.block) ?? false,
        sectionContainsGroup: runtime.section?.contains(runtime.group) ?? false,
      },
    );
  }

  const didCarryOverToNextPage =
    runtime.stash.length > 0
      ? await addJudgeNodies(runtime, undefined, pageMapByItemId)
      : false;

  if (didCarryOverToNextPage) {
    // フロート画像ごと次ページへ移った場合は、
    // 次ページ側の継続 block/group をそのまま使う
    float.parentBlock = runtime.block;
    float.parentGroup = runtime.group;
  } else if (runtime.block === float.parentBlock) {
    runtime.block = stashBlock;
    runtime.group = stashGroup;
  } else if (runtime.group && stashBlock) {
    const newBlock = stashBlock.cloneNode(false) as HTMLElement;
    runtime.group.appendChild(newBlock);
    runtime.block = newBlock;
  }

  const wrapHeightBasis = measuredHeight > textTotal ? measuredHeight : 0;
  float.wrapHeightBasis = wrapHeightBasis;
  float.wrapTextHeight = wrapHeightBasis > 0 ? textTotal : 0;

  float.isImageMode = false;
  float.stashNode = null;
  float.nodeHeight = 0;
  float.sideTextHeight = 0;
  float.imageHeightBasis = 0;
  float.currentBlockNode = runtime.block;
  float.isChangeBlock = false;
  float.textEntries = [];

  // 切り詰めた末尾センテンスを次ページへ送る。
  // 既にフロート塊で現ページがほぼ埋まっているため、
  // 最初の addJudgeNodies 呼び出しで自動的に改ページされる。
  for (const p of popped) {
    p.node.setAttribute('heighter', String(p.height));
    await addJudgeNodies(runtime, [p.node], pageMapByItemId);
  }

  /*
  if (runtime.stash.length > 0) {
    await addJudgeNodies(runtime);
  }

  if (runtime.block === float.parentBlock) {
    runtime.block = stashBlock;
    runtime.group = stashGroup;
  } else if (runtime.group && stashBlock) {
    const newBlock = stashBlock.cloneNode(false) as HTMLElement;
    runtime.group.appendChild(newBlock);
    runtime.block = newBlock;
  }

  float.isImageMode = false;
  */
};

const floatImageJudgement = async (
  target: HTMLElement,
  runtime: PaginateRuntime,
  pageMapByItemId?: Map<string, PageMapEntry>,
) => {
  const { float, block, group } = runtime;
  const floatImage = searchFloatImage(target);

  const imgs = Array.isArray(floatImage) ? floatImage : [];
  const layoutImages = imgs
    .filter((img) => img.tagName === 'IMG')
    .map((img) => {
      // float 継続判定は、属性上の原寸ではなく実際の表示高さで行う。
      return { img, renderedHeight: img.getBoundingClientRect().height };
    })
    .filter((entry) => entry.renderedHeight > 0);
  const hasLayoutFloat = layoutImages.length > 0;

  if (float.isImageMode) {
    if (hasLayoutFloat) {
      // 新しいフロート画像を検知（ロード前でも解決済み寸法を基準にする）
      if (float.nodeHeight > 0) {
        await EndFloatImageMode(
          Math.max(
            float.sideTextHeight,
            float.imageHeightBasis + FLOAT_IMAGE_OFFSET,
          ),
          runtime,
          pageMapByItemId,
        );
      } else {
        /*
        const endHeight =
          float.nodeHeight > float.imageHeightBasis
            ? float.nodeHeight
            : float.imageHeightBasis + FLOAT_IMAGE_OFFSET;

        await EndFloatImageMode(endHeight, runtime);
        */
        const newH = layoutImages[0].renderedHeight;
        if (float.imageHeightBasis < newH) {
          float.imageHeightBasis = newH;
        }
        target.setAttribute('heighter', '0');
        target.classList.add('float-and-float');
        float.stashNode?.appendChild(cloneFloatSentence(target));
      }
    } else {
      // 寸法解決済み画像が無い間は通常文扱い（スタッシュのみ継続・解除判定は既存基準）
      if (float.sideTextHeight > float.imageHeightBasis + FLOAT_IMAGE_OFFSET) {
        await EndFloatImageMode(
          Math.max(
            float.sideTextHeight,
            float.imageHeightBasis + FLOAT_IMAGE_OFFSET,
          ),
          runtime,
          pageMapByItemId,
        );
      } else {
        target.setAttribute('heighter', '0');
        target.classList.add('float-inner-node');
        if (float.currentBlockNode !== block) {
          float.isChangeBlock = true;
          float.currentBlockNode = block;
        }
        const appended = cloneFloatSentence(target);
        float.stashNode?.appendChild(appended);
        moveLeadingChoiceMarkerToFirstFloatSentence(float.stashNode, appended);
        float.textEntries.push({
          node: appended,
          height: target.offsetHeight,
          keepWithNext: isKeepWithNextSentence(target),
        });
        float.sideTextHeight += target.offsetHeight;
        float.nodeHeight += target.offsetHeight;
      }
    }
  }

  if (!float.isImageMode && hasLayoutFloat) {
    // フロートモード開始（ロード前でも解決済み寸法を基準にする）
    float.isImageMode = true;
    float.wrapHeightBasis = 0;
    float.wrapTextHeight = 0;
    float.imageHeightBasis =
      layoutImages.length > 1
        ? Math.max(...layoutImages.map((entry) => entry.renderedHeight))
        : layoutImages[0].renderedHeight;
    await CalculateNodeHeighter(target, undefined, {
      imageScale: runtime.metrics.floatImageScale,
    });
    float.nodeHeight = GetNodeHeighter(target);

    // スタイル適用
    if (
      (target.tagName === 'P'
        ? target
        : (target.closest('p') as HTMLParagraphElement | null)) &&
      target.classList.contains('sub-dividable-sentence')
    ) {
      if (!target.classList.contains('top-level')) {
        target.querySelectorAll('img').forEach((img) => {
          img.style.clear = 'both';
        });
        const hasQlIndent = Array.from(target.classList).some((className) =>
          /^ql-indent-\d+$/.test(className),
        );
        if (!hasQlIndent) target.style.textIndent = 'initial';
      } else {
        // top-levelの場合でも、２つ目以降のフロート画像はclear:bothにする
        target.querySelectorAll('img').forEach((img, index) => {
          if (index > 0) {
            img.style.clear = 'both';
          }
        });
      }
    }

    float.stashNode = createFloatCompositeNode(target, runtime.root);
    await addStashNode(runtime, float.stashNode, undefined, 'float-work');
    // フロートモード開始時点で textEntries をリセット。
    // 以降この配列に追加するクローンの単位で「現ページに収まる末尾」を切り詰められるようにする。
    float.sideTextHeight = 0;
    float.textEntries = [];
    // target はまだ tmp コンテナ内のライブDOM要素。
    // cloneされた runtime.block は非ライブなので、ここで幅を取っておく。
    const liveBlock = target.closest(
      '.sub-dividable-block',
    ) as HTMLElement | null;
    float.parentBlockWidth = liveBlock?.getBoundingClientRect().width ?? 0;
    float.currentBlockNode = block;
    float.isChangeBlock = false;
    float.parentBlock = block;
    float.parentGroup = group;
  }
};

const isStandaloneSectionHeadingElement = (el: Element) => {
  const isHeading =
    el.classList.contains('subcategory-name') ||
    el.classList.contains('question-sub-title') ||
    el.classList.contains('answer-sub-title');

  return isHeading && (el.textContent?.trim().length ?? 0) > 0;
};

export const initializeSection = (
  runtime: PaginateRuntime,
  carryOver: boolean,
) => {
  const { root, prefix } = runtime;
  const prevSection = runtime.section;
  const prevGroup = runtime.group;
  const prevBlock = runtime.block;

  let isFirst = true;

  if (prevSection !== null) {
    // 空ブロック除去＆追加
    const blocks = prevSection.getElementsByClassName(
      'sub-dividable-block',
    ) as HTMLCollectionOf<HTMLElement>;
    let addSwitch = false;

    Array.from(blocks).forEach((b) => {
      if (
        !b.innerHTML.match('<img') &&
        (b.textContent?.trim().length ?? 0) === 0 &&
        b.innerHTML.length !== 0
      ) {
        b.style.display = 'none';
        b.classList.add('empty-hide-block');
      } else {
        addSwitch = true;
        b.style.display = '';
        b.classList.remove('empty-hide-block');
      }
    });
    const hasStandaloneHeading = Array.from(prevSection.children).some(
      isStandaloneSectionHeadingElement,
    );
    if (addSwitch || hasStandaloneHeading) {
      const hasTarget = isPaginateDebugTargetNode(runtime, prevSection);
      if (hasTarget && isPaginateDebug(runtime.root)) {
        console.warn('[paginate] initializeSection target prevSection', {
          carryOver,
          sectionHeight: runtime.sectionHeight,
          existingHeighter: prevSection.getAttribute('heighter'),
          willSetHeighter:
            prevSection.getAttribute('heighter') ??
            String(runtime.sectionHeight),
          endPageBefore: runtime.endPage,
          currentPageBefore: runtime.currentPage,
          section: summarizeTargetSection(prevSection),
        });
      }
      // 高さ超過以外の改ページでも、確定時点の高さを保持する
      if (!prevSection.getAttribute('heighter')) {
        prevSection.setAttribute('heighter', String(runtime.sectionHeight));
      }
      runtime.container?.appendChild(prevSection);
      runtime.endPage += 1;
      runtime.currentPage = runtime.endPage;
      if (hasTarget && isPaginateDebug(runtime.root)) {
        console.warn('[paginate] initializeSection target appended', {
          carryOver,
          endPageAfter: runtime.endPage,
          currentPageAfter: runtime.currentPage,
          section: summarizeTargetSection(prevSection),
        });
      }
    }
    isFirst = false;
  }

  if (carryOver) {
    runtime.wrapper = root.createElement('div');
    runtime.wrapper.classList.add(`${prefix}-wrapper`);
  } else {
    runtime.wrapper = null;
  }

  runtime.section = root.createElement('section');
  runtime.section.classList.add('print-page');

  if (!isFirst && runtime.wrapper) {
    runtime.section.appendChild(runtime.wrapper);
  }

  // 新ページのsectionHeightを常にリセット
  runtime.sectionHeight = 0;
  runtime.float.wrapHeightBasis = 0;
  runtime.float.wrapTextHeight = 0;

  // carryOver時のみ、継続wrapperのpadding分を積算
  if (carryOver && prevGroup !== null && runtime.wrapper) {
    runtime.sectionHeight += runtime.metrics.wrapperVerticalPaddingPx;
    runtime.group = prevGroup.cloneNode(false) as HTMLElement;
    runtime.wrapper.appendChild(runtime.group);
  } else {
    runtime.group = null;
  }

  if (prevBlock !== null && runtime.group) {
    runtime.block = prevBlock.cloneNode(false) as HTMLElement;
    runtime.group.appendChild(runtime.block);
  } else {
    runtime.block = null;
  }
};

const isEmptyTextWithoutImage = (el: Element | null) => {
  if (!el) return false;

  const textLength = el.textContent?.trim().length ?? 0;
  const hasImage = el.querySelector('img') !== null;

  return textLength === 0 && !hasImage;
};

// 以下メモ
// bodyProcessは１問ごとに呼び出される
// wrapperはsectionの最初に囲むもの
// 要素はコピーされてるが、テキストや画像がなぜか表示されてない

export const bodyProcess = async (
  runtime: PaginateRuntime,
  node: HTMLElement,
  pageMapByItemId: Map<string, PageMapEntry>,
  itemId?: string | undefined,
) => {
  // console.log('Processing answer node in body process:', node);
  const { root, prefix } = runtime;

  const setItemPage = (page: number) => {
    if (!itemId) return;
    const entry = pageMapByItemId.get(itemId);
    if (!entry) return;

    if (prefix === 'answer') {
      entry.answerPage = page;
    } else {
      entry.questionPage = page;
    }
    pageMapByItemId.set(itemId, entry);
  };

  let hasStartedCurrentWrapper = false;
  const rollbackUnstartedWrapper = () => {
    // まだ本文もメタも載っていない wrapper は、
    // 殻だけ旧ページに残さず丸ごと次ページへ送る。
    if (hasStartedCurrentWrapper || !runtime.wrapper) return false;
    runtime.wrapper.remove();
    runtime.wrapper = null;
    runtime.sectionHeight = Math.max(
      0,
      runtime.sectionHeight - runtime.metrics.wrapperVerticalPaddingPx,
    );
    return true;
  };

  if (itemId) {
    const entry = pageMapByItemId.get(itemId);
    if (prefix === 'answer') {
      if (entry && entry.answerPage === undefined) {
        entry.answerPage = runtime.currentPage;
      }
    } else {
      if (entry && entry.questionPage === undefined) {
        entry.questionPage = runtime.currentPage;
      }
    }
  }

  runtime.wrapper = root.createElement('div');
  runtime.wrapper.classList.add(`${prefix}-wrapper`);
  runtime.section?.appendChild(runtime.wrapper);
  runtime.group = null;
  runtime.block = null;

  // 各 question/answer-wrapper の上下paddingを積算
  runtime.sectionHeight += runtime.metrics.wrapperVerticalPaddingPx;

  if (runtime.stash.length > 0) {
    debugLog(
      'Adding stashed nodes before processing current node. Stash:',
      runtime.stash,
    );
    runtime.stash.forEach((stashedNode) => {
      debugLog(
        'Appending stashed node:',
        stashedNode,
        stashedNode.node.innerHTML,
      );
      runtime.wrapper?.appendChild(stashedNode.node.cloneNode(true));
    });
    runtime.sectionHeight += runtime.stashHeight;
    runtime.stash = [];
    runtime.stashHeight = 0;
    hasStartedCurrentWrapper = true;
  }

  const groups = Array.from(
    node.getElementsByClassName(
      'sub-dividable-group',
    ) as HTMLCollectionOf<HTMLElement>,
  );
  // console.log('Groups:', groups);

  for (const g of groups) {
    // // console.log('Processing group:', g, groups[2].innerHTML);
    // num-to-ichimonmeグループかつquestion-honbunまたはanswer-honbunのinnerTextが0文字の場合
    // グループを丸ごとstashNodeに入れて次のグループへ移行
    const containNumToIchimonme = g.classList.contains('num-to-ichimonme');

    if (
      containNumToIchimonme &&
      (isEmptyTextWithoutImage(g.querySelector('.question-honbun')) ||
        isEmptyTextWithoutImage(g.querySelector('.answer-honbun')))
    ) {
      debugLog(
        'Holding lead meta due to empty question/answer honbun:',
        g,
        g.innerHTML,
      );
      // 空の本文 block でメタ行だけを確定せず、後続の最初の sentence まで持ち越す。
      const leadMetaBlock = Array.from(
        g.getElementsByClassName(
          'sub-dividable-block',
        ) as HTMLCollectionOf<HTMLElement>,
      ).find((block) => block.classList.contains('num-p'));
      if (leadMetaBlock && runtime.pendingLeadBlock === null) {
        await CalculateNodeHeighter(leadMetaBlock, 0, {
          imageScale: runtime.metrics.floatImageScale,
        });
        runtime.pendingLeadBlock = {
          block: leadMetaBlock.cloneNode(true) as HTMLElement,
          group: g.cloneNode(false) as HTMLElement,
          height: GetNodeHeighter(leadMetaBlock),
          itemId,
        };
      }
      rollbackUnstartedWrapper();
      continue;
    }

    const blocks = Array.from(
      g.getElementsByClassName(
        'sub-dividable-block',
      ) as HTMLCollectionOf<HTMLElement>,
    );
    if (blocks.length === 0) return;

    if (runtime.wrapper === null) {
      runtime.wrapper = root.createElement('div');
      runtime.wrapper.classList.add(`${prefix}-wrapper`);
      if (runtime.section) {
        runtime.section.appendChild(runtime.wrapper);
        runtime.sectionHeight += runtime.metrics.wrapperVerticalPaddingPx;
      }
    }
    runtime.group = g.cloneNode(false) as HTMLElement;
    debugLog('Appending group to wrapper:', runtime.group, runtime.wrapper);
    runtime.wrapper.appendChild(runtime.group);
    runtime.isAnswerTitle = g.classList.contains(`${prefix}-title-parent`);

    debugLog('Processing group:', g, blocks);
    for (const b of blocks) {
      debugLog('Processing block:', b, b.innerHTML);
      await _divideSentences(b);
      const isEmptyBlock =
        (b.textContent?.trim().length ?? 0) === 0 && !b.innerHTML.match('<img');

      if (isEmptyBlock && !shouldKeepEmptyPreviewBlock(b)) {
        continue;
      }

      // num-to-ichimonme の num-p (メタ行) は後続の最初のセンテンスと一緒にページ確定する
      const isLeadMetaBlock =
        runtime.pendingLeadBlock === null &&
        g.classList.contains('num-to-ichimonme') &&
        b.classList.contains('num-p');

      if (isLeadMetaBlock) {
        await CalculateNodeHeighter(b, 0, {
          imageScale: runtime.metrics.floatImageScale,
        });
        runtime.pendingLeadBlock = {
          block: b.cloneNode(true) as HTMLElement,
          group: g.cloneNode(false) as HTMLElement,
          height: GetNodeHeighter(b),
          itemId,
        };
        continue;
      }

      runtime.block = b.cloneNode(false) as HTMLElement;
      runtime.group.appendChild(runtime.block);

      if (isEmptyBlock) {
        runtime.block.classList.add('empty-hide-block');
        runtime.block.style.display = 'none';
        continue;
      }

      let sentences = Array.from(
        b.querySelectorAll(
          ':scope > .sub-dividable-sentence',
        ) as NodeListOf<HTMLElement>,
      );
      debugLog('Sentences to process:', sentences);

      if (sentences.length === 0) {
        const ps = Array.from(b.querySelectorAll('p')) as HTMLElement[];
        if (ps.length > 0) {
          // 画像のみの <p> も含め、センテンスとして処理対象にする
          ps.forEach((p) => {
            // クラス付与のみ（後工程はこのクラス前提で動く）
            p.classList.add('sub-dividable-sentence');
            debugLog('Adding <p> as sentence:', p, p.innerHTML);
          });
          sentences = ps;
        } else {
          // 更なるフォールバック: ブロック全体を1センテンス扱い
          b.classList.add('sub-dividable-sentence');
          sentences = [b];
        }
      }

      for (
        let sentenceIndex = 0;
        sentenceIndex < sentences.length;
        sentenceIndex++
      ) {
        const sentence = sentences[sentenceIndex];
        if (!sentence) continue;
        debugLog('Current float state:', runtime.float, runtime.block);

        const sentenceFloatImages = searchFloatImage(sentence);
        const sentenceHasFloat =
          Array.isArray(sentenceFloatImages) && sentenceFloatImages.length > 0;
        const shouldDeferPendingForFloat =
          runtime.float.isImageMode ||
          (Array.isArray(sentenceFloatImages) &&
            sentenceFloatImages.length > 0);

        if (runtime.pendingLeadBlock !== null && !shouldDeferPendingForFloat) {
          await CalculateNodeHeighter(sentence, runtime.isAnswerTitle ? 8 : 0, {
            imageScale: runtime.metrics.floatImageScale,
          });
          const pendingLeadBlock = runtime.pendingLeadBlock;
          const sentenceHeight = GetNodeHeighter(sentence);
          if (
            runtime.sectionHeight + pendingLeadBlock.height + sentenceHeight >
            runtime.metrics.baseHeightPx
          ) {
            const currentHeightForDebug = hasStartedCurrentWrapper
              ? runtime.sectionHeight
              : Math.max(
                  0,
                  runtime.sectionHeight -
                    runtime.metrics.wrapperVerticalPaddingPx,
                );

            appendPaginateDebugBadge(runtime, {
              reason: 'pending-meta-first-sentence-break',
              overflowPx:
                currentHeightForDebug +
                pendingLeadBlock.height +
                sentenceHeight -
                runtime.metrics.baseHeightPx,
              currentHeight: currentHeightForDebug,
              nodiesHeight: pendingLeadBlock.height + sentenceHeight,
              baseHeightPx: runtime.metrics.baseHeightPx,
            });
            const movedWholeWrapper = rollbackUnstartedWrapper();
            initializeSection(runtime, true);
            if (movedWholeWrapper) {
              setItemPage(runtime.currentPage);
            }
            // initializeSection 後は runtime.group/block が新ページのクローンに更新されている
          }
          insertPendingLeadGroup(runtime, pendingLeadBlock, runtime.group);
          hasStartedCurrentWrapper = true;
          setPendingLeadItemPage(runtime, pageMapByItemId);
          runtime.pendingLeadBlock = null;
        }

        await floatImageJudgement(sentence, runtime, pageMapByItemId);
        await CalculateNodeHeighter(sentence, runtime.isAnswerTitle ? 8 : 0, {
          imageScale: runtime.metrics.floatImageScale,
        });
        debugLog(
          'Sentence height:',
          GetNodeHeighter(sentence),
          runtime.block,
          runtime,
        );
        if (!runtime.float.isImageMode) {
          const nextSentence = sentences[sentenceIndex + 1];
          const nextSentenceFloatImages =
            nextSentence !== undefined ? searchFloatImage(nextSentence) : null;
          const nextSentenceHasFloat =
            Array.isArray(nextSentenceFloatImages) &&
            nextSentenceFloatImages.length > 0;
          const shouldKeepWithNext =
            nextSentence !== undefined &&
            isKeepWithNextSentence(sentence) &&
            !sentenceHasFloat;
          const canKeepWithNext =
            shouldKeepWithNext && !nextSentenceHasFloat;
          const shouldCarryToNextFloat =
            shouldKeepWithNext && nextSentenceHasFloat;
          if (canKeepWithNext) {
            await CalculateNodeHeighter(
              nextSentence,
              runtime.isAnswerTitle ? 8 : 0,
              {
                imageScale: runtime.metrics.floatImageScale,
              },
            );
            await addJudgeNodies(
              runtime,
              [sentence, nextSentence],
              pageMapByItemId,
            );
            sentenceIndex += 1;
          } else if (shouldCarryToNextFloat) {
            // 次がフロート画像の場合は画像処理を通常経路に残し、見出しだけを同じ判定単位へ持ち越す。
            await addStashNode(
              runtime,
              sentence.cloneNode(true) as HTMLElement,
              GetNodeHeighter(sentence),
              'carry-over',
            );
          } else {
            await addJudgeNodies(runtime, [sentence], pageMapByItemId);
          }
          hasStartedCurrentWrapper = true;
        }
      }

      if (runtime.float.isImageMode && runtime.stash.length > 0) {
        await EndFloatImageMode(
          Math.max(
            runtime.float.sideTextHeight,
            runtime.float.imageHeightBasis + FLOAT_IMAGE_OFFSET,
          ),
          runtime,
          pageMapByItemId,
        );
      }
    }
  }

  if (runtime.section && isPaginateDebug(runtime.root)) {
    const sectionHasTarget = isPaginateDebugTargetNode(
      runtime,
      runtime.section,
    );
    const blockHasTarget =
      runtime.block !== null && isPaginateDebugTargetNode(runtime, runtime.block);
    if (sectionHasTarget || blockHasTarget) {
      console.warn('[paginate] bodyProcess target tail', {
        sectionHeight: runtime.sectionHeight,
        baseHeightPx: runtime.metrics.baseHeightPx,
        willOverflow: runtime.sectionHeight > runtime.metrics.baseHeightPx,
        sectionHasTarget,
        blockHasTarget,
        sectionContainsBlock:
          runtime.block !== null && runtime.section.contains(runtime.block),
        blockClassName: runtime.block?.className ?? null,
        section: summarizeTargetSection(runtime.section),
      });
    }
  }

  // ラッパーの最後にセクションを超えたら改ページ
  if (runtime.sectionHeight > runtime.metrics.baseHeightPx) {
    if (
      runtime.section &&
      isPaginateDebug(runtime.root) &&
      isPaginateDebugTargetNode(runtime, runtime.section)
    ) {
      console.warn('[paginate] wrapper-tail-overflow target section', {
        sectionHeight: runtime.sectionHeight,
        overflowPx: runtime.sectionHeight - runtime.metrics.baseHeightPx,
        baseHeightPx: runtime.metrics.baseHeightPx,
        section: summarizeTargetSection(runtime.section),
      });
    }
    appendPaginateDebugBadge(runtime, {
      reason: 'wrapper-tail-overflow',
      overflowPx: runtime.sectionHeight - runtime.metrics.baseHeightPx,
      currentHeight: runtime.sectionHeight,
      nodiesHeight: 0,
      baseHeightPx: runtime.metrics.baseHeightPx,
    });
    initializeSection(runtime, false);
  }
};
