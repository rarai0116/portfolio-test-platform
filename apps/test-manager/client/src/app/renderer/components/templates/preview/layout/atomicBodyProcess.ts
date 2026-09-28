import type { PaginateRuntime } from './paginateArea';
import {
  appendPaginateDebugBadge,
  initializeFirst,
  initializeSection,
} from './paginateAreaHelper';
import type { PageMapEntry } from './types';
import {
  CalculateNodeHeighter,
  GetNodeHeighter,
  hasLoadableImageSource,
  IMAGE_READY_TIMEOUT_MS,
  normalizeInactiveFloatImages,
} from './utils';

// viewer は renderer とは別 document のため、その document の window から rAF を解決する。
const waitForTwoFrames = (root: Document): Promise<void> => {
  const raf =
    root.defaultView?.requestAnimationFrame?.bind(root.defaultView) ??
    requestAnimationFrame;

  return new Promise<void>((resolve) => {
    raf(() => raf(() => resolve()));
  });
};

const waitForAtomicImagesReady = async (
  root: Document,
  node: HTMLElement,
): Promise<void> => {
  const images = Array.from(node.getElementsByTagName('img'));
  if (images.length === 0) return;

  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          const isReady =
            img.complete &&
            ((img.naturalWidth > 0 && img.naturalHeight > 0) ||
              img.width > 0 ||
              img.height > 0);

          if (isReady) {
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
        }),
    ),
  );

  await waitForTwoFrames(root);
};

/**
 * 実回り込みの無い float を解除してから高さを測る。
 * 一部を解除すると残った float の隣接関係が変わるため、変化が無くなるまで再判定する。
 * 反復上限は初回パスで見えた float 画像数 + 1 回とし、到達時は残った float を維持する。
 */
const normalizeInactiveFloatsUntilStable = async (
  root: Document,
  node: HTMLElement,
): Promise<void> => {
  const firstPass = normalizeInactiveFloatImages(node);
  if (firstPass.aborted || !firstPass.changed) return;

  const passLimit =
    firstPass.normalizedCount + firstPass.remainingFloatCount + 1;

  for (let pass = 1; pass < passLimit; pass++) {
    await waitForTwoFrames(root);
    const result = normalizeInactiveFloatImages(node);
    if (result.aborted || !result.changed) return;
  }

  console.warn(
    'normalizeInactiveFloatImages: 反復上限に到達したため残存floatを維持します',
  );
};

const measureAtomicNodeHeight = async (
  runtime: PaginateRuntime,
  node: HTMLElement,
): Promise<number> => {
  await waitForAtomicImagesReady(runtime.root, node);
  await normalizeInactiveFloatsUntilStable(runtime.root, node);

  await CalculateNodeHeighter(node, undefined, {
    force: true,
    imageScale: runtime.metrics.floatImageScale,
  });

  return GetNodeHeighter(node);
};

export const atomicBodyProcess = async (
  runtime: PaginateRuntime,
  node: HTMLElement,
  pageMapByItemId: Map<string, PageMapEntry>,
  itemId?: string,
): Promise<void> => {
  const nodeHeight = await measureAtomicNodeHeight(runtime, node);
  const nextHeight = runtime.sectionHeight + nodeHeight;
  const overflowPx = nextHeight - runtime.metrics.baseHeightPx;

  const shouldBreak = runtime.sectionHeight > 0 && overflowPx > 0;

  if (shouldBreak) {
    appendPaginateDebugBadge(runtime, {
      reason: 'atomic-overflow',
      overflowPx,
      currentHeight: runtime.sectionHeight,
      nodiesHeight: nodeHeight,
      baseHeightPx: runtime.metrics.baseHeightPx,
    });

    if (runtime.section && !runtime.section.getAttribute('heighter')) {
      runtime.section.setAttribute('heighter', String(runtime.sectionHeight));
    }

    initializeSection(runtime, false);
  }

  if (!runtime.section) {
    runtime.section = initializeFirst(runtime.root, runtime);
  }

  if (itemId) {
    const entry = pageMapByItemId.get(itemId);
    if (entry) {
      if (runtime.prefix === 'question') {
        if (entry.questionPage === undefined) {
          entry.questionPage = runtime.currentPage;
        }
      } else {
        if (entry.answerPage === undefined) {
          entry.answerPage = runtime.currentPage;
        }
      }
      pageMapByItemId.set(itemId, entry);
    }
  }

  runtime.section.appendChild(node.cloneNode(true));
  runtime.sectionHeight += nodeHeight;
};
