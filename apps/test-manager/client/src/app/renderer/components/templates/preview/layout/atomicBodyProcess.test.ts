import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaginateRuntime } from './paginateArea';
import type { PageMapEntry } from './types';
import type { NormalizeInactiveFloatImagesResult } from './utils';

const mocks = vi.hoisted(() => ({
  normalizeInactiveFloatImages: vi.fn(),
  calculateNodeHeighter: vi.fn(),
  getNodeHeighter: vi.fn(),
  appendPaginateDebugBadge: vi.fn(),
  initializeFirst: vi.fn(),
  initializeSection: vi.fn(),
}));

// 画像待機のガード（hasLoadableImageSource / IMAGE_READY_TIMEOUT_MS）は
// 実装を検証したいので実物を使う。
vi.mock('./utils', async () => {
  const actual = await vi.importActual<typeof import('./utils')>('./utils');
  return {
    normalizeInactiveFloatImages: mocks.normalizeInactiveFloatImages,
    CalculateNodeHeighter: mocks.calculateNodeHeighter,
    GetNodeHeighter: mocks.getNodeHeighter,
    hasLoadableImageSource: actual.hasLoadableImageSource,
    IMAGE_READY_TIMEOUT_MS: actual.IMAGE_READY_TIMEOUT_MS,
  };
});

vi.mock('./paginateAreaHelper', () => ({
  appendPaginateDebugBadge: mocks.appendPaginateDebugBadge,
  initializeFirst: mocks.initializeFirst,
  initializeSection: mocks.initializeSection,
}));

const { atomicBodyProcess } = await import('./atomicBodyProcess');

const pass = (
  overrides: Partial<NormalizeInactiveFloatImagesResult> = {},
): NormalizeInactiveFloatImagesResult => ({
  changed: false,
  normalizedCount: 0,
  remainingFloatCount: 0,
  aborted: false,
  ...overrides,
});

const createRuntime = (
  overrides: Partial<PaginateRuntime> = {},
): PaginateRuntime => ({
  prefix: 'question',
  count: 0,
  endPage: 1,
  currentPage: 1,
  root: document,
  wrapper: null,
  group: null,
  block: null,
  section: document.createElement('section'),
  container: null,
  sectionHeight: 0,
  stash: [],
  stashHeight: 0,
  pendingLeadBlock: null,
  float: {
    isImageMode: false,
    stashNode: null,
    imageHeightBasis: 0,
    nodeHeight: 0,
    sideTextHeight: 0,
    wrapHeightBasis: 0,
    wrapTextHeight: 0,
    parentBlock: null,
    parentGroup: null,
    currentBlockNode: null,
    isChangeBlock: false,
    parentBlockWidth: 0,
    textEntries: [],
  },
  isAnswerTitle: false,
  metrics: {
    baseHeightPx: 800,
    wrapperPaddingTopPx: 0,
    wrapperPaddingBottomPx: 0,
    wrapperVerticalPaddingPx: 0,
    floatImageScale: 1,
  },
  ...overrides,
});

// 画像を含まない問題ノードを使い、waitForAtomicImagesReady 側の frame待機が
// 正規化の待機回数に混ざらないようにする。
const createQuestionNode = (): HTMLElement => {
  const node = document.createElement('div');
  node.className = 'question-wrapper';
  node.innerHTML = '<p>問題文</p>';
  return node;
};

describe('atomicBodyProcess の無効float正規化と改ページ判定', () => {
  let frameCount = 0;

  beforeEach(() => {
    frameCount = 0;

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frameCount += 1;
      callback(0);
      return frameCount;
    });

    mocks.normalizeInactiveFloatImages.mockReset().mockReturnValue(pass());
    mocks.calculateNodeHeighter.mockReset().mockResolvedValue(undefined);
    mocks.getNodeHeighter.mockReset().mockReturnValue(100);
    mocks.appendPaginateDebugBadge.mockReset();
    mocks.initializeSection.mockReset();
    mocks.initializeFirst
      .mockReset()
      .mockImplementation(() => document.createElement('section'));
  });

  it('float解除が無ければ再判定せず、追加のframe待機も発生しない', async () => {
    const runtime = createRuntime();

    await atomicBodyProcess(runtime, createQuestionNode(), new Map());

    expect(mocks.normalizeInactiveFloatImages).toHaveBeenCalledTimes(1);
    expect(frameCount).toBe(0);
  });

  it('float解除があれば2 frame待ってから再判定する', async () => {
    mocks.normalizeInactiveFloatImages
      .mockReturnValueOnce(pass({ changed: true, normalizedCount: 1 }))
      .mockReturnValueOnce(pass());
    const runtime = createRuntime();

    await atomicBodyProcess(runtime, createQuestionNode(), new Map());

    expect(mocks.normalizeInactiveFloatImages).toHaveBeenCalledTimes(2);
    expect(frameCount).toBe(2);
  });

  it('毎回変化し続ける場合、初期float数 + 1回で反復を終了する', async () => {
    // 初回パスで float 2枚（解除1・残存1）が見えるため上限は3回
    mocks.normalizeInactiveFloatImages.mockReturnValue(
      pass({ changed: true, normalizedCount: 1, remainingFloatCount: 1 }),
    );
    const runtime = createRuntime();

    await atomicBodyProcess(runtime, createQuestionNode(), new Map());

    expect(mocks.normalizeInactiveFloatImages).toHaveBeenCalledTimes(3);
    expect(frameCount).toBe(4);
  });

  it('aborted が返った場合はその時点で反復を停止する', async () => {
    mocks.normalizeInactiveFloatImages
      .mockReturnValueOnce(
        pass({ changed: true, normalizedCount: 1, remainingFloatCount: 1 }),
      )
      .mockReturnValueOnce(pass({ aborted: true }))
      .mockReturnValue(pass({ changed: true, normalizedCount: 1 }));
    const runtime = createRuntime();

    await atomicBodyProcess(runtime, createQuestionNode(), new Map());

    expect(mocks.normalizeInactiveFloatImages).toHaveBeenCalledTimes(2);
  });

  it('正規化を終えてから CalculateNodeHeighter(force=true) で高さを取り直す', async () => {
    const order: string[] = [];
    mocks.normalizeInactiveFloatImages.mockImplementation(() => {
      order.push('normalize');
      return pass();
    });
    mocks.calculateNodeHeighter.mockImplementation(async () => {
      order.push('calculate');
    });
    const runtime = createRuntime();
    const node = createQuestionNode();

    await atomicBodyProcess(runtime, node, new Map());

    expect(order).toEqual(['normalize', 'calculate']);
    expect(mocks.calculateNodeHeighter).toHaveBeenCalledWith(node, undefined, {
      force: true,
      imageScale: 1,
    });
  });

  it('正規化後の高さで現ページに収まらない場合、問題全体を次ページへ送る', async () => {
    // 正規化で本文込みの高さになり、現ページの残りを超える
    mocks.getNodeHeighter.mockReturnValue(750);
    const runtime = createRuntime({ sectionHeight: 100 });

    await atomicBodyProcess(runtime, createQuestionNode(), new Map());

    expect(mocks.initializeSection).toHaveBeenCalledWith(runtime, false);
    expect(mocks.appendPaginateDebugBadge).toHaveBeenCalledWith(
      runtime,
      expect.objectContaining({ reason: 'atomic-overflow', nodiesHeight: 750 }),
    );
    expect(runtime.sectionHeight).toBe(850);
  });

  it('正規化後の高さが収まる場合は改ページせず、同じページへ配置する', async () => {
    mocks.getNodeHeighter.mockReturnValue(300);
    const runtime = createRuntime({ sectionHeight: 100 });

    await atomicBodyProcess(runtime, createQuestionNode(), new Map());

    expect(mocks.initializeSection).not.toHaveBeenCalled();
    expect(runtime.section?.children).toHaveLength(1);
    expect(runtime.sectionHeight).toBe(400);
  });

  it('正規化済みのDOMを本番sectionへcloneする', async () => {
    mocks.normalizeInactiveFloatImages.mockImplementation(
      (scope: HTMLElement) => {
        const img = scope.querySelector('img');
        img?.style.removeProperty('float');
        return pass({ changed: false });
      },
    );
    const runtime = createRuntime();
    const node = createQuestionNode();
    // 寸法属性を持たせて waitForAtomicImagesReady の画像待機を成立させる
    node.innerHTML =
      '<p><img width="10" height="10" style="display:inline;float:left"></p>';

    await atomicBodyProcess(runtime, node, new Map());

    const cloned = runtime.section?.querySelector('img');
    expect(cloned?.style.float).toBe('');
  });

  it('itemId が渡された場合、正規化後のページ番号をページマップへ記録する', async () => {
    const runtime = createRuntime({ currentPage: 3 });
    const pageMap = new Map<string, PageMapEntry>([
      [
        'item-1',
        {
          itemId: 'item-1',
          subject: '学科Ⅱ',
          smallCategory: '小分類A',
          questionIndex: 6,
        },
      ],
    ]);

    await atomicBodyProcess(runtime, createQuestionNode(), pageMap, 'item-1');

    expect(pageMap.get('item-1')?.questionPage).toBe(3);
  });
});

describe('atomicBodyProcess の画像待機ガード', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 0;
    });

    mocks.normalizeInactiveFloatImages.mockReset().mockReturnValue(pass());
    mocks.calculateNodeHeighter.mockReset().mockResolvedValue(undefined);
    mocks.getNodeHeighter.mockReset().mockReturnValue(100);
    mocks.appendPaginateDebugBadge.mockReset();
    mocks.initializeSection.mockReset();
    mocks.initializeFirst
      .mockReset()
      .mockImplementation(() => document.createElement('section'));
  });

  it('src を持たない img があっても待機し続けずに完了する', async () => {
    // 画像アセットが未 ready の間は realizeDomImages が src を付けないため、
    // load も error も発火しない img が計測対象に入る。
    const runtime = createRuntime();
    const node = createQuestionNode();
    node.innerHTML = '<p><img alt="firstGrade/NOT_READY_KEY"></p>';

    await expect(
      atomicBodyProcess(runtime, node, new Map()),
    ).resolves.toBeUndefined();
  }, 3000);
});
