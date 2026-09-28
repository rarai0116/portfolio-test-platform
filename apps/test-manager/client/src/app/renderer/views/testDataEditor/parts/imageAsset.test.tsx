import { DUMMY_IMG } from '@api/dummyImage';
import useAssetCacheStore from '@stores/useAssetCacheStore';
import useImageAssetStore from '@stores/useImageAssetStore';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImageAsset from './imageAsset';

vi.mock('@stores/useAssetCacheStore', () => ({
  default: vi.fn(),
}));

vi.mock('@stores/useImageAssetStore', () => ({
  default: vi.fn(),
}));

const setupStore = (
  imagesStateMap: Record<string, unknown> = {},
  isDisplayMap: Record<string, boolean> = {},
) => {
  vi.mocked(useAssetCacheStore).mockImplementation((selector: unknown) => {
    const state = { imagesStateMap };
    return typeof selector === 'function'
      ? (selector as (s: typeof state) => unknown)(state)
      : state;
  });
  vi.mocked(useImageAssetStore).mockImplementation((selector: unknown) => {
    const state = { isDisplayMap };
    return typeof selector === 'function'
      ? (selector as (s: typeof state) => unknown)(state)
      : state;
  });
};

describe('ImageAsset', () => {
  const id = 'firstGrade/test-key';
  const listRef = { current: document.createElement('div') };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imgタグが描画される', () => {
    setupStore();
    render(<ImageAsset id={id} listRef={listRef} />);

    expect(screen.getByRole('img', { name: 'preview' })).toBeInTheDocument();
  });

  it('isDisplayMapがtrueかつreadyのとき、demo-asset URLがsrcに設定される', () => {
    setupStore(
      {
        [id]: {
          status: 'ready',
          contentType: 'image/jpeg',
          version: 'md5AAA',
          readyNoticeSeq: 1,
        },
      },
      { [id]: true },
    );
    render(<ImageAsset id={id} listRef={listRef} />);

    const img = screen.getByRole('img', { name: 'preview' });
    expect(img).toHaveAttribute(
      'src',
      'demo-asset://images/firstGrade/test-key.png?v=md5AAA',
    );
  });

  it('recoveryTokenがある場合はr付きURLになる', () => {
    setupStore(
      {
        [id]: {
          status: 'ready',
          version: 'md5AAA',
          recoveryToken: 'AAAAAAAAAAAAAAAAAAAAAA',
          readyNoticeSeq: 2,
        },
      },
      { [id]: true },
    );
    render(<ImageAsset id={id} listRef={listRef} />);

    const img = screen.getByRole('img', { name: 'preview' });
    expect(img).toHaveAttribute(
      'src',
      'demo-asset://images/firstGrade/test-key.png?v=md5AAA&r=AAAAAAAAAAAAAAAAAAAAAA',
    );
  });

  it('isDisplayMapがfalseのときダミー画像が表示される', () => {
    setupStore(
      {
        [id]: {
          status: 'ready',
          contentType: 'image/png',
          version: 'md5AAA',
          readyNoticeSeq: 1,
        },
      },
      { [id]: false },
    );
    render(<ImageAsset id={id} listRef={listRef} />);

    const img = screen.getByRole('img', { name: 'preview' });
    expect(img).toHaveAttribute('src', DUMMY_IMG);
  });

  it('statusがready以外のときダミー画像が表示される', () => {
    setupStore(
      { [id]: { status: 'downloading', transferred: 0 } },
      { [id]: true },
    );
    render(<ImageAsset id={id} listRef={listRef} />);

    const img = screen.getByRole('img', { name: 'preview' });
    expect(img).toHaveAttribute('src', DUMMY_IMG);
  });

  it('grade部分が不正なidではダミー画像が表示される', () => {
    const invalidId = 'thirdGrade/test-key';
    setupStore(
      {
        [invalidId]: {
          status: 'ready',
          contentType: 'image/png',
          version: 'md5AAA',
          readyNoticeSeq: 1,
        },
      },
      { [invalidId]: true },
    );
    render(<ImageAsset id={invalidId} listRef={listRef} />);

    const img = screen.getByRole('img', { name: 'preview' });
    expect(img).toHaveAttribute('src', DUMMY_IMG);
  });

  it('imagesStateMapにIDが存在しないときダミー画像が表示される', () => {
    setupStore({}, { [id]: true });
    render(<ImageAsset id={id} listRef={listRef} />);

    const img = screen.getByRole('img', { name: 'preview' });
    expect(img).toHaveAttribute('src', DUMMY_IMG);
  });

  it('width・heightがstyleに反映される', () => {
    setupStore();
    render(
      <ImageAsset id={id} listRef={listRef} width="200px" height="150px" />,
    );

    const img = screen.getByRole('img', { name: 'preview' });
    expect(img).toHaveStyle({ width: '200px', height: '150px' });
  });
});

describe('ImageAsset の表示失敗回復（設計10.5）', () => {
  const id = 'firstGrade/test-key';
  const listRef = { current: document.createElement('div') };
  const readyState = {
    status: 'ready' as const,
    contentType: 'image/png',
    version: 'md5AAA',
    readyNoticeSeq: 1,
  };
  const assetUrl = 'demo-asset://images/firstGrade/test-key.png?v=md5AAA';

  const reportLoadFailure = vi.fn();
  const reportLoadSuccess = vi.fn();

  beforeEach(() => {
    reportLoadFailure.mockReset().mockResolvedValue({
      ok: true,
      status: 'recovery-started',
    });
    reportLoadSuccess
      .mockReset()
      .mockResolvedValue({ ok: true, confirmed: true });
    (window as unknown as { assets: unknown }).assets = {
      reportLoadFailure,
      reportLoadSuccess,
    };
  });

  it('読み込み失敗でダミーへ戻し、main へ報告する', async () => {
    setupStore({ [id]: readyState }, { [id]: true });
    render(<ImageAsset id={id} listRef={listRef} />);

    const img = screen.getByRole('img', { name: 'preview' });
    expect(img).toHaveAttribute('src', assetUrl);

    await act(async () => {
      fireEvent.error(img);
    });

    expect(img).toHaveAttribute('src', DUMMY_IMG);
    expect(reportLoadFailure).toHaveBeenCalledWith({
      grade: 'firstGrade',
      key: 'test-key',
      version: 'md5AAA',
      recoveryToken: undefined,
    });
  });

  it('失敗後に再レンダーしても表示がURLへ巻き戻らない', () => {
    setupStore({ [id]: readyState }, { [id]: true });
    const { rerender } = render(<ImageAsset id={id} listRef={listRef} />);

    const img = screen.getByRole('img', { name: 'preview' });
    fireEvent.error(img);
    expect(img).toHaveAttribute('src', DUMMY_IMG);

    rerender(<ImageAsset id={id} listRef={listRef} width={100} />);

    expect(screen.getByRole('img', { name: 'preview' })).toHaveAttribute(
      'src',
      DUMMY_IMG,
    );
    // 再レンダーでの再報告も起きない
    expect(reportLoadFailure).toHaveBeenCalledTimes(1);
  });

  it('r 付きURLへ更新されると再度表示を試みる', async () => {
    setupStore({ [id]: readyState }, { [id]: true });
    const { rerender } = render(<ImageAsset id={id} listRef={listRef} />);
    await act(async () => {
      fireEvent.error(screen.getByRole('img', { name: 'preview' }));
    });

    // main の回復で r 付き ready 通知が届いた状態
    setupStore(
      {
        [id]: {
          ...readyState,
          recoveryToken: 'AAAAAAAAAAAAAAAAAAAAAA',
          readyNoticeSeq: 2,
        },
      },
      { [id]: true },
    );
    // React.memo は props だけを比較するため、テストでは prop 変更で再描画させる
    // （実際には zustand の購読でこのコンポーネント自身が再描画される）
    rerender(<ImageAsset id={id} listRef={listRef} width={120} />);

    expect(screen.getByRole('img', { name: 'preview' })).toHaveAttribute(
      'src',
      'demo-asset://images/firstGrade/test-key.png?v=md5AAA&r=AAAAAAAAAAAAAAAAAAAAAA',
    );
  });

  it('r なしの通常 load では成功報告を送らない', () => {
    setupStore({ [id]: readyState }, { [id]: true });
    render(<ImageAsset id={id} listRef={listRef} />);

    fireEvent.load(screen.getByRole('img', { name: 'preview' }));

    expect(reportLoadSuccess).not.toHaveBeenCalled();
  });

  it('r 付きURLの load 成功だけ報告し、confirmed なら失敗表示を解除する', async () => {
    setupStore(
      {
        [id]: { ...readyState, recoveryToken: 'AAAAAAAAAAAAAAAAAAAAAA' },
      },
      { [id]: true },
    );
    render(<ImageAsset id={id} listRef={listRef} />);

    await act(async () => {
      fireEvent.load(screen.getByRole('img', { name: 'preview' }));
    });

    expect(reportLoadSuccess).toHaveBeenCalledWith({
      grade: 'firstGrade',
      key: 'test-key',
      version: 'md5AAA',
      recoveryToken: 'AAAAAAAAAAAAAAAAAAAAAA',
    });
  });

  it('confirmed=false では表示中画像をダミーへ戻さない', async () => {
    reportLoadSuccess.mockResolvedValue({ ok: true, confirmed: false });
    const recoveryUrl =
      'demo-asset://images/firstGrade/test-key.png?v=md5AAA&r=AAAAAAAAAAAAAAAAAAAAAA';
    setupStore(
      { [id]: { ...readyState, recoveryToken: 'AAAAAAAAAAAAAAAAAAAAAA' } },
      { [id]: true },
    );
    render(<ImageAsset id={id} listRef={listRef} />);

    const img = screen.getByRole('img', { name: 'preview' });
    await act(async () => {
      fireEvent.load(img);
    });

    expect(img).toHaveAttribute('src', recoveryUrl);
  });
});
