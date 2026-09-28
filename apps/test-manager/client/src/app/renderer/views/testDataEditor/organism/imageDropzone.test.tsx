import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useImageDropzoneStore from '@views/testDataEditor/store/useImageDropzoneStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BasicDropzone, { type BasicDropzoneProps } from './imageDropzone';

const mockOpen = vi.fn();
const mockGetPathForFile = vi.fn();
let capturedOnDrop:
  | ((acceptedFiles: File[], fileRejections: unknown[], event?: Event) => void)
  | undefined;

vi.mock('react-dropzone', () => ({
  useDropzone: (options: {
    onDrop: (
      acceptedFiles: File[],
      fileRejections: unknown[],
      event?: Event,
    ) => void;
  }) => {
    capturedOnDrop = options.onDrop;

    return {
      getRootProps: () => ({
        'data-testid': 'dropzone',
      }),
      getInputProps: () => ({
        type: 'file',
        'data-testid': 'file-input',
      }),
      open: mockOpen,
      fileRejections: [
        {
          file: new File([], 'test.jpg', { type: 'image/jpeg' }),
          errors: [{ code: 'file-invalid-type', message: 'Invalid type' }],
        },
      ],
    };
  },
}));

vi.mock('@views/testDataEditor/store/useImageDropzoneStore', () => ({
  default: vi.fn(),
}));

describe('BasicDropzone', () => {
  const mockAddImageFiles = vi.fn();
  const metadata: BasicDropzoneProps['metadata'] = {
    grade: 'firstGrade' as const,
    subject: '学科Ⅰ',
    bigCategoryTag: '建築計画',
    smallCategoryTag: '建築士の職責',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnDrop = undefined;
    Object.defineProperty(window, 'webUtils', {
      configurable: true,
      value: {
        getPathForFile: mockGetPathForFile,
      },
    });
    vi.mocked(useImageDropzoneStore).mockReturnValue({
      addImageFiles: mockAddImageFiles,
    });
  });

  it('ドロップゾーンが表示される', () => {
    render(<BasicDropzone metadata={metadata} />);
    expect(screen.getByText('画像をドラッグ＆ドロップ')).toBeInTheDocument();
  });

  it('対応画像形式の説明が表示される', () => {
    render(<BasicDropzone metadata={metadata} />);
    expect(
      screen.getByText('または選択してください [ 対応画像: png ]'),
    ).toBeInTheDocument();
  });

  it('画像選択ボタンが表示される', () => {
    render(<BasicDropzone metadata={metadata} />);
    expect(
      screen.getByRole('button', { name: '画像を選択' }),
    ).toBeInTheDocument();
  });

  it('クリックしたら、mockOpenが呼ばれる', async () => {
    const user = userEvent.setup();
    render(<BasicDropzone metadata={metadata} />);
    const button = screen.getByRole('button', { name: '画像を選択' });
    await user.click(button);
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it('アップロードアイコンが表示される', () => {
    render(<BasicDropzone metadata={metadata} />);
    const icon = screen.getByAltText('画像アップロード');
    expect(icon).toBeInTheDocument();
  });

  it('非対応ファイルの場合、エラーメッセージが表示される', () => {
    render(<BasicDropzone metadata={metadata} />);
    expect(screen.getByText('対応していない形式です')).toBeInTheDocument();
  });

  it('ドロップしたファイルのfilePathを保持して追加する', () => {
    mockGetPathForFile.mockImplementation((file: File) =>
      file.name === 'native-test.png' ? '/tmp/from-native-file.png' : null,
    );
    render(<BasicDropzone metadata={metadata} />);

    const droppedFile = new File([], 'native-test.png', {
      type: 'image/png',
    }) as File & {
      path?: string;
    };
    droppedFile.path = '/tmp/native-test.png';

    const acceptedFile = new File([], 'native-test.png', {
      type: 'image/png',
    }) as File & {
      path?: string;
    };
    acceptedFile.path = './native-test.png';

    capturedOnDrop?.([acceptedFile], [], {
      dataTransfer: {
        files: [droppedFile],
      },
    } as unknown as Event);

    expect(mockAddImageFiles).toHaveBeenCalledWith([
      expect.objectContaining({
        file: droppedFile,
        filePath: '/tmp/from-native-file.png',
        metadata,
      }),
    ]);
    expect(mockGetPathForFile).toHaveBeenCalledWith(droppedFile);
  });

  it('pathがない場合はwebUtilsからfilePathを取得する', () => {
    mockGetPathForFile.mockReturnValue('/tmp/from-web-utils.png');
    render(<BasicDropzone metadata={metadata} />);

    const droppedFile = new File([], 'test.png', { type: 'image/png' });

    capturedOnDrop?.([droppedFile], []);

    expect(mockGetPathForFile).toHaveBeenCalledWith(droppedFile);
    expect(mockAddImageFiles).toHaveBeenCalledWith([
      expect.objectContaining({
        file: droppedFile,
        filePath: '/tmp/from-web-utils.png',
        metadata,
      }),
    ]);
  });

  it('相対pathしかない場合は保存しない', () => {
    mockGetPathForFile.mockReturnValue(null);
    render(<BasicDropzone metadata={metadata} />);

    const droppedFile = new File([], 'test.png', {
      type: 'image/png',
    }) as File & {
      path?: string;
    };
    droppedFile.path = './test.png';

    capturedOnDrop?.([droppedFile], []);

    expect(mockAddImageFiles).toHaveBeenCalledWith([
      expect.objectContaining({
        file: droppedFile,
        filePath: null,
        metadata,
      }),
    ]);
  });

  it('input由来のtarget.filesからネイティブFileを保持する', () => {
    mockGetPathForFile.mockImplementation((file: File) =>
      file.name === 'input-test.png' ? '/tmp/input-test.png' : null,
    );
    render(<BasicDropzone metadata={metadata} />);

    const nativeFile = new File([], 'input-test.png', {
      type: 'image/png',
    });
    const acceptedFile = new File([], 'input-test.png', {
      type: 'image/png',
    });

    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [nativeFile],
    });

    capturedOnDrop?.([acceptedFile], [], { target: input } as unknown as Event);

    expect(mockAddImageFiles).toHaveBeenCalledWith([
      expect.objectContaining({
        file: nativeFile,
        filePath: '/tmp/input-test.png',
        metadata,
      }),
    ]);
  });

  it('Windows形式の絶対パスを保持する', () => {
    mockGetPathForFile.mockReturnValue('C:/temp/test.png');
    render(<BasicDropzone metadata={metadata} />);

    const droppedFile = new File([], 'test.png', { type: 'image/png' });

    capturedOnDrop?.([droppedFile], []);

    expect(mockAddImageFiles).toHaveBeenCalledWith([
      expect.objectContaining({
        file: droppedFile,
        filePath: 'C:/temp/test.png',
        metadata,
      }),
    ]);
  });
});
