import type { PreviewSetPayload } from '@shared/types/preview';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  renderPreviewToDocument: vi.fn(),
  setLatest: vi.fn(),
  latest: { current: null as PreviewSetPayload | null },
}));

vi.mock('@views/testDataEditor/templates/previewRenderShared', () => ({
  renderPreviewToDocument: mocks.renderPreviewToDocument,
}));

vi.mock('@stores/usePreviewStore', () => {
  const hook = Object.assign(() => ({ setLatest: mocks.setLatest }), {
    getState: () => ({
      latest: mocks.latest.current,
      setLatest: mocks.setLatest,
    }),
  });
  return { usePreviewStore: hook };
});

vi.mock('@renderer/api/imageErrorRecovery', () => ({
  installImageErrorRecovery: vi.fn(),
  ASSET_LOAD_FAILED_ATTRIBUTE: 'data-asset-load-failed',
  REACT_MANAGED_ASSET_ATTRIBUTE: 'data-asset-recovery-react',
}));

vi.mock('@components/templates/preview/imageRealizer', () => ({
  realizeDomImages: vi.fn(),
  realizeHtmlImages: vi.fn((html: string) => html),
}));

vi.mock('@templates/preview/layout/patchRenderPreview', () => ({
  mergePreviewPayload: vi.fn((prev: unknown) => prev),
  patchPreviewDom: vi.fn(async () => true),
}));

const { default: PreviewPanel } = await import('./previewPanel');

// previewPanel.tsx の RENDER_TIMEOUT_MS と揃える
const RENDER_TIMEOUT_MS = 15000;

const createPayload = (id: string): PreviewSetPayload =>
  ({
    type: 'full',
    id,
    subject: '学科Ⅳ',
    question: { textHtml: '<p>問題文</p>', choices: [] },
    answer: { textHtml: '<p>解説</p>', choices: [] },
    images: {},
  }) as unknown as PreviewSetPayload;

const mountPanel = async () => {
  const view = render(<PreviewPanel />);
  const iframe = view.container.querySelector('iframe');
  if (!iframe) throw new Error('preview iframe が見つかりません');

  // iframe の準備完了を通知し、初回描画を走らせる
  await act(async () => {
    fireEvent.load(iframe);
  });

  return view;
};

const clickUpdate = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '更新' }));
  });
};

describe('PreviewPanel の描画排他とタイムアウト', () => {
  beforeEach(() => {
    mocks.renderPreviewToDocument.mockReset();
    mocks.setLatest.mockReset();
    mocks.latest.current = createPayload('78');

    Object.defineProperty(window, 'preview', {
      configurable: true,
      value: {
        onSet: vi.fn(() => () => undefined),
        onImagePatch: vi.fn(() => () => undefined),
        getLatest: vi.fn(async () => ({ ok: false })),
        send: vi.fn(),
        patchImages: vi.fn(async () => undefined),
      },
    });
  });

  it('描画が完了しない間は再描画要求を受け付けない', async () => {
    vi.useFakeTimers();
    try {
      // 解決しない描画（画像待機が返らない状況の再現）
      mocks.renderPreviewToDocument.mockReturnValue(new Promise(() => {}));

      await mountPanel();
      expect(mocks.renderPreviewToDocument).toHaveBeenCalledTimes(1);

      await clickUpdate();

      // 排他中なので追加の描画は走らない
      expect(mocks.renderPreviewToDocument).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('描画が完了しなくても上限時間を過ぎれば次の描画要求を受け付ける', async () => {
    vi.useFakeTimers();
    try {
      mocks.renderPreviewToDocument.mockReturnValue(new Promise(() => {}));

      await mountPanel();
      expect(mocks.renderPreviewToDocument).toHaveBeenCalledTimes(1);

      // 上限時間の経過で描画を打ち切り、排他フラグを解放する
      await act(async () => {
        await vi.advanceTimersByTimeAsync(RENDER_TIMEOUT_MS);
      });

      await clickUpdate();

      expect(mocks.renderPreviewToDocument).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('描画が完了した場合は初回完了通知を1度だけ行う', async () => {
    const onInitialFullRenderDone = vi.fn();
    mocks.renderPreviewToDocument.mockResolvedValue(undefined);

    const view = render(
      <PreviewPanel onInitialFullRenderDone={onInitialFullRenderDone} />,
    );
    const iframe = view.container.querySelector('iframe');
    if (!iframe) throw new Error('preview iframe が見つかりません');

    await act(async () => {
      fireEvent.load(iframe);
    });
    await clickUpdate();

    // 完了する描画では排他が解放され、更新要求がそのまま通る
    expect(mocks.renderPreviewToDocument.mock.calls.length).toBeGreaterThan(1);
    expect(onInitialFullRenderDone).toHaveBeenCalledTimes(1);
  });
});
