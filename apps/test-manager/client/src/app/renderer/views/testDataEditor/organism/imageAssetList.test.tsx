import type { TestSubject } from '@shared/types/contracts';
import useImageAssetStore from '@stores/useImageAssetStore';
import { act, render, screen } from '@testing-library/react';
import {
  type ImageItem,
  kOf,
} from '@views/testDataEditor/hooks/useImageAssetList';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImageAssetList from './imageAssetList';

vi.mock('@stores/useImageAssetStore', () => ({
  default: vi.fn(),
}));

vi.mock('@views/testDataEditor/organism/imageAssetSearch', () => ({
  default: ({
    imageItems,
    onSearchStart,
    onSearchComplete,
  }: {
    imageItems: ImageItem[];
    onSearchStart?: () => void;
    onSearchComplete?: () => void;
  }) => (
    <div data-testid="image-asset-search">
      <div>検索({imageItems.length})</div>
      <button type="button" onClick={onSearchStart}>
        start-search
      </button>
      <button type="button" onClick={onSearchComplete}>
        complete-search
      </button>
    </div>
  ),
}));

vi.mock('@views/testDataEditor/organism/imageAssetItem', () => ({
  default: ({ id, usedIdLabel }: { id: string; usedIdLabel?: string }) => (
    <div data-testid={`image-asset-item-${id}`}>
      {id}
      {usedIdLabel && (
        <span data-testid={`used-id-label-${id}`}>{usedIdLabel}</span>
      )}
    </div>
  ),
}));

const mockItem = (key: string, grade = 'firstGrade'): ImageItem => ({
  grade: grade as ImageItem['grade'],
  key,
  name: `${key}.png`,
  title: `タイトル_${key}`,
  subject: '学科Ⅰ',
  bigCategoryTag: '建築計画',
  smallCategoryTag: '建築士の職責',
  tag: [],
  objectPath: `assets/${grade}/${key}.png`,
  width: 400,
  height: 300,
  usedIds: [],
});

const itemKey = (key: string, grade = 'firstGrade') =>
  kOf({ key, grade: grade as ImageItem['grade'] });

const setupStore = (
  imageItemKeys: string[] = [],
  ignoreRequestItemKeys: string[] = [],
) => {
  vi.mocked(useImageAssetStore).mockImplementation((selector: unknown) => {
    const state = {
      ignoreRequestItemKeys,
      sortOrder: 'updatedAt_desc' as const,
      setSortOrder: vi.fn(),
      imageItemKeys,
      setImageItemKeys: vi.fn(),
    };
    return typeof selector === 'function'
      ? (selector as (s: typeof state) => unknown)(state)
      : state;
  });
};

describe('ImageAssetList', () => {
  const listRef = { current: document.createElement('div') };
  const defaultProps = {
    listRef,
    imageItems: [] as ImageItem[],
    searchFormKey: 'search-key',
    initialSubject: '学科Ⅰ' as TestSubject,
    initialBigCategory: 'すべて',
    initialSmallCategory: 'すべて',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  it('検索パネルが表示される', () => {
    const imageItems = [mockItem('img1')];
    render(<ImageAssetList {...defaultProps} imageItems={imageItems} />);

    expect(screen.getByTestId('image-asset-search')).toBeInTheDocument();
    expect(screen.getByText('検索(1)')).toBeInTheDocument();
  });

  it('imageItemKeysが空のとき画像アイテムが表示されない', () => {
    setupStore([]);
    const imageItems = [mockItem('img1')];
    render(<ImageAssetList {...defaultProps} imageItems={imageItems} />);

    expect(
      screen.queryByTestId('image-asset-item-firstGrade/img1'),
    ).not.toBeInTheDocument();
  });

  it('imageItemKeysに対応する画像アイテムが表示される', () => {
    const imageItems = [mockItem('img1'), mockItem('img2')];
    setupStore([itemKey('img1'), itemKey('img2')]);

    render(<ImageAssetList {...defaultProps} imageItems={imageItems} />);

    expect(
      screen.getByTestId('image-asset-item-firstGrade/img1'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('image-asset-item-firstGrade/img2'),
    ).toBeInTheDocument();
  });

  it('imageItemKeysにあるがimageItemsに存在しないキーはスキップされる', () => {
    const imageItems = [mockItem('img1')];
    setupStore([itemKey('img1'), itemKey('missing-key')]);

    render(<ImageAssetList {...defaultProps} imageItems={imageItems} />);

    expect(
      screen.getByTestId('image-asset-item-firstGrade/img1'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('image-asset-item-firstGrade/missing-key'),
    ).not.toBeInTheDocument();
  });

  it('ignoreRequestItemKeysに含まれるアイテムは表示されない', () => {
    const imageItems = [mockItem('img1'), mockItem('img2')];
    setupStore([itemKey('img1'), itemKey('img2')], [itemKey('img2')]);

    render(<ImageAssetList {...defaultProps} imageItems={imageItems} />);

    expect(
      screen.getByTestId('image-asset-item-firstGrade/img1'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('image-asset-item-firstGrade/img2'),
    ).not.toBeInTheDocument();
  });

  it('usedIdsがformatUsedIdLabelでフォーマットされる', () => {
    const items = [{ ...mockItem('img1'), usedIds: ['Q001', 'Q002'] }];
    setupStore([itemKey('img1')]);
    const formatUsedIdLabel = vi.fn((id: string) => `問題${id}`);

    render(
      <ImageAssetList
        {...defaultProps}
        imageItems={items}
        formatUsedIdLabel={formatUsedIdLabel}
      />,
    );

    expect(formatUsedIdLabel).toHaveBeenCalledWith('Q001');
    expect(formatUsedIdLabel).toHaveBeenCalledWith('Q002');
    expect(
      screen.getByTestId('used-id-label-firstGrade/img1'),
    ).toHaveTextContent('問題Q001, 問題Q002');
  });

  it('formatUsedIdLabelが未指定のときusedIdsがそのまま表示される', () => {
    const items = [{ ...mockItem('img1'), usedIds: ['Q001', 'Q002'] }];
    setupStore([itemKey('img1')]);

    render(<ImageAssetList {...defaultProps} imageItems={items} />);

    expect(
      screen.getByTestId('used-id-label-firstGrade/img1'),
    ).toHaveTextContent('Q001, Q002');
  });

  it('usedIdsが空のときusedIdLabelが表示されない', () => {
    const items = [mockItem('img1')];
    setupStore([itemKey('img1')]);

    render(<ImageAssetList {...defaultProps} imageItems={items} />);

    expect(
      screen.queryByTestId('used-id-label-firstGrade/img1'),
    ).not.toBeInTheDocument();
  });

  it('検索中は一覧にメッセージが表示される', () => {
    render(
      <ImageAssetList {...defaultProps} imageItems={[mockItem('img1')]} />,
    );

    act(() => {
      screen.getByRole('button', { name: 'start-search' }).click();
    });

    expect(screen.getByText('検索中...')).toBeInTheDocument();
  });

  it('検索後に0件なら一覧に未検出メッセージが表示される', () => {
    render(<ImageAssetList {...defaultProps} imageItems={[]} />);

    act(() => {
      screen.getByRole('button', { name: 'start-search' }).click();
      screen.getByRole('button', { name: 'complete-search' }).click();
    });

    expect(
      screen.getByText('条件の画像が見つかりませんでした'),
    ).toBeInTheDocument();
  });
});
