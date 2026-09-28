import type { GradeId } from '@shared/types/contracts';
import useImageAssetStore from '@stores/useImageAssetStore';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ImageItem } from '@views/testDataEditor/hooks/useImageAssetList';
import useSelectedIdStore from '@views/testDataEditor/store/useSelectedIdStore';
import type { Timestamp } from 'firebase/firestore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImageAssetSearch from './imageAssetSearch';

vi.mock('@stores/useImageAssetStore', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@stores/useImageAssetStore')>();
  return {
    ...actual,
    default: vi.fn(), // フックだけモックする
  };
});
vi.mock('@views/testDataEditor/store/useSelectedIdStore', () => ({
  default: vi.fn(),
}));

vi.mock('@views/testDataEditor/hooks/useCategoryTagOptions', () => ({
  useCategoryTagOptions: () => ({
    bigOptions: [
      { value: 'すべて', label: 'すべて' },
      { value: '建築計画', label: '建築計画' },
    ],
    smallOptions: [
      { value: 'すべて', label: 'すべて' },
      { value: '建築士の職責', label: '建築士の職責' },
    ],
  }),
}));

const mockSetSortOrder = vi.fn();
const mockSetImageItemKeys = vi.fn();

const setupImageAssetStore = (overrides: Record<string, unknown> = {}) => {
  vi.mocked(useImageAssetStore).mockImplementation((selector: unknown) => {
    const state = {
      ignoreRequestItemKeys: [],
      sortOrder: 'updatedAt_desc',
      setSortOrder: mockSetSortOrder,
      imageItemKeys: [],
      setImageItemKeys: mockSetImageItemKeys,
      ...overrides,
    };
    return typeof selector === 'function'
      ? (selector as (s: typeof state) => unknown)(state)
      : state;
  });
};

const setupSelectedIdStore = (
  selectedGrade = 'firstGrade' as GradeId,
  selectedDataIdList: string[] = [],
) => {
  vi.mocked(useSelectedIdStore).mockReturnValue({
    selectedDataIdList,
    selectedGrade,
  });
};

const ts = (seconds: number): Timestamp =>
  ({ seconds, nanoseconds: 0 }) as Timestamp;

const mockItem = (key: string, opts: Partial<ImageItem> = {}): ImageItem => ({
  grade: 'firstGrade',
  key,
  name: `${key}.png`,
  title: `タイトル_${key}`,
  subject: '学科Ⅰ',
  bigCategoryTag: '建築計画',
  smallCategoryTag: '建築士の職責',
  tag: [],
  objectPath: `assets/firstGrade/${key}.png`,
  width: 400,
  height: 300,
  usedIds: [],
  createdAt: ts(1000),
  updatedAt: ts(2000),
  ...opts,
});

const itemKey = (key: string, grade: GradeId = 'firstGrade') =>
  `${grade}/${key}`;

describe('ImageAssetSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    setupImageAssetStore();
    setupSelectedIdStore();
  });

  it('並び替えラベルが表示される', () => {
    render(<ImageAssetSearch imageItems={[]} />);
    expect(screen.getByText('並び替え')).toBeInTheDocument();
  });

  it('ラジオボタン（未使用・編集リストで使用中・詳細検索）が表示される', () => {
    render(<ImageAssetSearch imageItems={[]} />);
    expect(screen.getByLabelText('未使用')).toBeInTheDocument();
    expect(screen.getByLabelText('編集リストで使用中')).toBeInTheDocument();
    expect(screen.getByLabelText('詳細検索')).toBeInTheDocument();
  });

  it('表示ボタンが表示される', () => {
    render(<ImageAssetSearch imageItems={[]} />);
    expect(screen.getByRole('button', { name: '表示' })).toBeInTheDocument();
  });

  it('級が表示される（1級）', () => {
    setupSelectedIdStore('firstGrade');
    render(<ImageAssetSearch imageItems={[]} />);
    expect(screen.getByText('1級')).toBeInTheDocument();
  });

  it('級が表示される（2級）', () => {
    setupSelectedIdStore('secondGrade');
    render(<ImageAssetSearch imageItems={[]} />);
    expect(screen.getByText('2級')).toBeInTheDocument();
  });

  it('詳細検索の学科・大分類・小分類ラベルが表示される', () => {
    render(<ImageAssetSearch imageItems={[]} />);
    expect(screen.getByText('学科')).toBeInTheDocument();
    expect(screen.getByText('大分類')).toBeInTheDocument();
    expect(screen.getByText('小分類')).toBeInTheDocument();
  });

  it('表示ボタンをクリックするとsetImageItemKeysが呼ばれる', async () => {
    const user = userEvent.setup();
    const items = [mockItem('img1'), mockItem('img2', { usedIds: ['0_1'] })];

    render(<ImageAssetSearch imageItems={items} />);
    mockSetImageItemKeys.mockClear();
    await user.click(screen.getByRole('button', { name: '表示' }));

    expect(mockSetImageItemKeys).toHaveBeenCalledOnce();
  });

  it('初期表示時に自動でsetImageItemKeysが呼ばれる', () => {
    const items = [mockItem('img1'), mockItem('img2', { usedIds: ['0_1'] })];

    render(<ImageAssetSearch imageItems={items} />);

    expect(mockSetImageItemKeys).toHaveBeenCalledOnce();
  });

  it('初期値propsが詳細検索の選択値に反映される', () => {
    render(
      <ImageAssetSearch
        imageItems={[]}
        initialSubject="学科Ⅱ"
        initialBigCategory="建築計画"
        initialSmallCategory="建築士の職責"
      />,
    );

    expect(screen.getByText('学科Ⅱ')).toBeInTheDocument();
    expect(screen.getAllByText('建築計画')).not.toHaveLength(0);
    expect(screen.getByText('建築士の職責')).toBeInTheDocument();
  });

  it('未使用モードではusedIdsが空のアイテムのキーのみ返される', async () => {
    const user = userEvent.setup();
    const items = [
      mockItem('unused1'),
      mockItem('used1', { usedIds: ['0_1'] }),
      mockItem('unused2'),
    ];

    render(<ImageAssetSearch imageItems={items} />);
    mockSetImageItemKeys.mockClear();
    await user.click(screen.getByLabelText('未使用'));
    await user.click(screen.getByRole('button', { name: '表示' }));

    expect(mockSetImageItemKeys).toHaveBeenCalledWith(
      expect.arrayContaining([itemKey('unused1'), itemKey('unused2')]),
    );
    const keys = mockSetImageItemKeys.mock.calls[0][0] as string[];
    expect(keys).not.toContain(itemKey('used1'));
  });

  it('編集リストで使用中モードではselectedDataIdListに関連するアイテムが返される', async () => {
    const user = userEvent.setup();
    setupSelectedIdStore('firstGrade', ['1']);
    const items = [
      mockItem('img1', { usedIds: ['0_1'] }),
      mockItem('img2', { usedIds: [] }),
      mockItem('img3', { usedIds: ['0_2'] }),
    ];

    render(<ImageAssetSearch imageItems={items} />);

    // 「編集リストで使用中」を選択
    await user.click(screen.getByLabelText('編集リストで使用中'));
    await user.click(screen.getByRole('button', { name: '表示' }));

    expect(mockSetImageItemKeys).toHaveBeenCalledWith([itemKey('img1')]);
  });

  it('異なるgradeのアイテムはフィルタで除外される', async () => {
    const user = userEvent.setup();
    setupSelectedIdStore('firstGrade');
    const items = [
      mockItem('img1'),
      mockItem('img2', { grade: 'secondGrade' }),
    ];

    render(<ImageAssetSearch imageItems={items} />);
    mockSetImageItemKeys.mockClear();
    await user.click(screen.getByLabelText('未使用'));
    await user.click(screen.getByRole('button', { name: '表示' }));

    const keys = mockSetImageItemKeys.mock.calls[0][0] as string[];
    expect(keys).toContain(itemKey('img1'));
    expect(keys).not.toContain(itemKey('img2', 'secondGrade'));
  });
});
