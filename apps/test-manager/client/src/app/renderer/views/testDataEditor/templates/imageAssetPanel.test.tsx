import useAssetCacheStore from '@stores/useAssetCacheStore';
import useImageAssetStore from '@stores/useImageAssetStore';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useImageDropzoneStore, {
  type UploadImageFile,
} from '@views/testDataEditor/store/useImageDropzoneStore';
import useSelectedIdStore from '@views/testDataEditor/store/useSelectedIdStore';
import useTestDataStore from '@views/testDataEditor/store/useTestDataStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImageAssetPanel from './imageAssetPanel';

const mockRun = vi.fn(async (task: () => Promise<void>) => {
  await task();
});
const mockUpload = vi.fn();
const mockUploadBuffer = vi.fn();
const mockMutate = vi.fn();
const mockInsertImage = vi.fn().mockResolvedValue({ ok: true });
const mockRemoveImageFile = vi.fn();
const mockSetIgnoreRequestItemKeys = vi.fn();
const mockSetImagesStateMap = vi.fn();
const mockConsoleError = vi.fn();

vi.mock('@renderer/hooks/useGlobalLoading', () => ({
  useGlobalLoading: () => ({ run: mockRun }),
}));

vi.mock('@stores/useImageAssetStore', () => ({
  default: vi.fn(),
}));

vi.mock('@stores/useAssetCacheStore', () => ({
  default: vi.fn(),
}));

vi.mock('@views/testDataEditor/hooks/useImageAssetObserver', () => ({
  default: () => ({ listRef: { current: null } }),
}));

vi.mock('@views/testDataEditor/store/useImageDropzoneStore', () => ({
  default: vi.fn(),
}));

vi.mock('@views/testDataEditor/store/useSelectedIdStore', () => ({
  default: vi.fn(),
}));

vi.mock('@views/testDataEditor/store/useTestDataStore', () => ({
  default: vi.fn(),
}));

vi.mock('@hooks/useFirestoreHandler', () => ({
  randomId: () => 'mutation-id',
}));

vi.mock('@views/testDataEditor/organism/imageAssetList', () => ({
  default: () => <div data-testid="image-asset-list" />,
}));

vi.mock('@views/testDataEditor/organism/imageUpload', () => ({
  default: (props: { onClickUpload: () => void; isUploading?: boolean }) => (
    <button
      type="button"
      data-testid="open-upload-dialog"
      disabled={props.isUploading}
      onClick={props.onClickUpload}
    >
      upload
    </button>
  ),
}));

describe('ImageAssetPanel', () => {
  const createPngFile = (name: string, body = 'png') => {
    const file = new File([body], name, { type: 'image/png' });
    const bytes = new TextEncoder().encode(body);
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: vi.fn().mockResolvedValue(bytes.buffer as ArrayBuffer),
    });
    return file;
  };

  const createImageFiles = (): UploadImageFile[] => [
    {
      id: 'file-1',
      file: createPngFile('success.png'),
      filePath: '/tmp/success.png',
      metadata: {
        grade: 'firstGrade',
        subject: '学科Ⅱ',
        bigCategoryTag: '建築計画',
        smallCategoryTag: '未指定',
      },
    },
    {
      id: 'file-2',
      file: createPngFile('missing-path.png'),
      filePath: null,
      metadata: {
        grade: 'firstGrade',
        subject: '学科Ⅱ',
        bigCategoryTag: '建築計画',
        smallCategoryTag: '未指定',
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(mockConsoleError);

    Object.defineProperty(window, 'assets', {
      configurable: true,
      value: {
        upload: mockUpload,
        uploadBuffer: mockUploadBuffer,
        delete: vi.fn(),
      },
    });

    Object.defineProperty(window, 'fs', {
      configurable: true,
      value: {
        getDoc: vi.fn(),
        mutate: mockMutate,
      },
    });

    Object.defineProperty(window, 'editor', {
      configurable: true,
      value: {
        insertImage: mockInsertImage,
      },
    });

    Object.defineProperty(window, 'webUtils', {
      configurable: true,
      value: {
        getPathForFile: vi.fn((file: File) =>
          file.name === 'success.png'
            ? '/tmp/from-web-utils-success.png'
            : null,
        ),
      },
    });

    vi.mocked(useImageAssetStore).mockImplementation((selector: unknown) => {
      const state = {
        imageItems: [],
        imageItemKeys: [],
        setIgnoreRequestItemKeys: mockSetIgnoreRequestItemKeys,
      };

      return typeof selector === 'function'
        ? (selector as (s: typeof state) => unknown)(state)
        : state;
    });

    vi.mocked(useAssetCacheStore).mockReturnValue({
      setImagesStateMap: mockSetImagesStateMap,
      imagesStateMap: {},
      logs: [],
      setLogs: vi.fn(),
    });

    vi.mocked(useImageDropzoneStore).mockReturnValue({
      imageFiles: createImageFiles(),
      removeImageFile: mockRemoveImageFile,
    });

    vi.mocked(useSelectedIdStore).mockReturnValue({
      selectedGrade: 'firstGrade',
      selectedDataId: '1',
    });

    vi.mocked(useTestDataStore).mockReturnValue({
      editMap: {
        '1': {
          id: '1',
          updatedAtMs: Date.now(),
          data: {
            subject: '学科Ⅱ',
            bigCategoryTag: '建築計画',
            smallCategoryTag: '',
          },
        },
      },
    });
  });

  it('アップロード成功時に path と buffer の両経路で画像を挿入する', async () => {
    mockUpload.mockResolvedValueOnce({
      ok: true,
      grade: 'firstGrade',
      key: 'asset-key',
      objectPath: 'original/firstGrade/asset-key.png',
      filePath: '/tmp/success.png',
      data: { tag: [] },
    });
    mockUploadBuffer.mockResolvedValueOnce({
      ok: true,
      grade: 'firstGrade',
      key: 'asset-key-buffer',
      objectPath: 'original/firstGrade/asset-key-buffer.png',
      filePath: 'missing-path.png',
      data: { tag: [] },
    });
    mockMutate.mockResolvedValue({ ok: true });

    render(<ImageAssetPanel />);

    const user = userEvent.setup();
    await user.click(screen.getByTestId('open-upload-dialog'));
    const dialog = await screen.findByRole('dialog', {
      name: '画像をアップロードしますか？',
    });
    await user.click(
      within(dialog).getByRole('button', { name: 'アップロードする' }),
    );

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledWith(
        '/tmp/from-web-utils-success.png',
        'firstGrade',
      );
    });

    await waitFor(() => {
      expect(mockUploadBuffer).toHaveBeenCalledTimes(1);
    });

    expect(mockMutate).toHaveBeenCalledTimes(2);
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subject: '学科Ⅱ',
          bigCategoryTag: '建築計画',
          smallCategoryTag: '未指定',
        }),
      }),
    );
    expect(mockRemoveImageFile).toHaveBeenCalledWith('file-1');
    expect(mockRemoveImageFile).toHaveBeenCalledWith('file-2');
    expect(mockInsertImage).toHaveBeenCalledWith({
      grade: 'firstGrade',
      key: 'asset-key',
    });
    expect(mockInsertImage).toHaveBeenCalledWith({
      grade: 'firstGrade',
      key: 'asset-key-buffer',
    });

    expect(
      screen.queryByText('画像アップロードに失敗しました'),
    ).not.toBeInTheDocument();
  });

  it('storeに相対pathが残っていてもwebUtilsの絶対パスを優先する', async () => {
    mockUpload.mockResolvedValueOnce({
      ok: true,
      grade: 'firstGrade',
      key: 'asset-key-2',
      objectPath: 'original/firstGrade/asset-key-2.png',
      filePath: '/tmp/relative.png',
      data: { tag: [] },
    });
    mockMutate.mockResolvedValue({ ok: true });

    vi.mocked(useImageDropzoneStore).mockReturnValue({
      imageFiles: [
        {
          id: 'file-relative',
          file: createPngFile('relative.png'),
          filePath: './relative.png',
          metadata: {
            grade: 'firstGrade',
            subject: '学科Ⅰ',
            bigCategoryTag: '未指定',
            smallCategoryTag: '未指定',
          },
        },
      ],
      removeImageFile: mockRemoveImageFile,
    });

    Object.defineProperty(window, 'webUtils', {
      configurable: true,
      value: {
        getPathForFile: vi.fn(() => '/tmp/relative.png'),
      },
    });

    render(<ImageAssetPanel />);

    const user = userEvent.setup();
    await user.click(screen.getByTestId('open-upload-dialog'));
    const dialog = await screen.findByRole('dialog', {
      name: '画像をアップロードしますか？',
    });
    await user.click(
      within(dialog).getByRole('button', { name: 'アップロードする' }),
    );

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledWith(
        '/tmp/relative.png',
        'firstGrade',
      );
    });
  });

  it('ファイルパスがなくても uploadBuffer に fallback する', async () => {
    mockUploadBuffer.mockResolvedValueOnce({
      ok: true,
      grade: 'firstGrade',
      key: 'asset-key-fallback',
      objectPath: 'original/firstGrade/asset-key-fallback.png',
      filePath: 'missing-path.png',
      data: { tag: [] },
    });
    mockMutate.mockResolvedValue({ ok: true });

    vi.mocked(useImageDropzoneStore).mockReturnValue({
      imageFiles: [
        {
          id: 'file-buffer',
          file: createPngFile('missing-path.png'),
          filePath: null,
          metadata: {
            grade: 'firstGrade',
            subject: '学科Ⅰ',
            bigCategoryTag: '未指定',
            smallCategoryTag: '未指定',
          },
        },
      ],
      removeImageFile: mockRemoveImageFile,
    });

    render(<ImageAssetPanel />);

    const user = userEvent.setup();
    await user.click(screen.getByTestId('open-upload-dialog'));
    const dialog = await screen.findByRole('dialog', {
      name: '画像をアップロードしますか？',
    });
    await user.click(
      within(dialog).getByRole('button', { name: 'アップロードする' }),
    );

    await waitFor(() => {
      expect(mockUploadBuffer).toHaveBeenCalledWith(
        'missing-path.png',
        expect.any(Uint8Array),
        'firstGrade',
        'image/png',
      );
    });

    expect(mockUpload).not.toHaveBeenCalled();
  });
});
