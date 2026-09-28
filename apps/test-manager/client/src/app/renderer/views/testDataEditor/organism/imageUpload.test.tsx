import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PreUploadImageListProps } from '@views/testDataEditor/organism/preUploadImageList';
import type { UploadImageFile } from '@views/testDataEditor/store/useImageDropzoneStore';
import useImageDropzoneStore from '@views/testDataEditor/store/useImageDropzoneStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImageUpload, { type ImageUploadProps } from './imageUpload';

vi.mock('@views/testDataEditor/store/useImageDropzoneStore', () => ({
  default: vi.fn(),
}));

vi.mock('@views/testDataEditor/hooks/useCategoryTagOptions', () => ({
  useCategoryTagOptions: vi.fn(),
}));

vi.mock('@views/testDataEditor/organism/imageDropzone', () => ({
  default: vi.fn(() => <div data-testid="basic-dropzone" />),
}));

vi.mock('@views/testDataEditor/organism/preUploadImageList', () => ({
  default: vi.fn(({ imageFileList }: PreUploadImageListProps) => (
    <div data-testid="pre-upload-image-list">
      {imageFileList.map((v) => (
        <div key={v.id}>{v.id}</div>
      ))}
    </div>
  )),
}));

vi.mock('@views/testDataEditor/hooks/useCategoryTagOptions', () => ({
  useCategoryTagOptions: () => ({
    bigOptions: [
      { value: '建築計画', label: '建築計画' },
      { value: '建築法規', label: '建築法規' },
    ],
    smallOptions: [{ value: '建築士の職責', label: '建築士の職責' }],
  }),
}));

const mockRemoveImageFile = vi.fn();

const setupStore = (imageFiles: UploadImageFile[] = []) => {
  vi.mocked(useImageDropzoneStore).mockImplementation((selector: unknown) => {
    const state = { imageFiles, removeImageFile: mockRemoveImageFile };
    return typeof selector === 'function'
      ? (selector as (s: typeof state) => unknown)(state)
      : state;
  });
};

describe('ImageUpload', () => {
  const defaultProps: ImageUploadProps = {
    selectedGrade: 'firstGrade',
    initialSubject: '学科Ⅰ',
    initialBigCategory: '建築計画',
    initialSmallCategory: '建築士の職責',
    onClickUpload: vi.fn(),
    isUploading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  it('BasicDropzoneが表示される', () => {
    render(<ImageUpload {...defaultProps} />);
    expect(screen.getByTestId('basic-dropzone')).toBeInTheDocument();
  });

  it('PreUploadImageListが表示される', () => {
    render(<ImageUpload {...defaultProps} />);
    expect(screen.getByTestId('pre-upload-image-list')).toBeInTheDocument();
  });

  it('級表示・学科・大分類・小分類のラベルが表示される', () => {
    render(<ImageUpload {...defaultProps} />);
    expect(screen.getByText('1級')).toBeInTheDocument();
    expect(screen.getByText('学科')).toBeInTheDocument();
    expect(screen.getByText('大分類')).toBeInTheDocument();
    expect(screen.getByText('小分類')).toBeInTheDocument();
  });

  it('gradeがsecondGradeのとき「2級」と表示される', () => {
    render(<ImageUpload {...defaultProps} selectedGrade="secondGrade" />);
    expect(screen.getByText('2級')).toBeInTheDocument();
  });

  it('imageFilesがPreUploadImageListに渡される', () => {
    setupStore([
      {
        id: 'file-1',
        file: new File([], 'test1.png'),
        filePath: '/tmp/test1.png',
        metadata: {
          grade: 'firstGrade',
          subject: '学科Ⅰ',
          bigCategoryTag: '建築計画',
          smallCategoryTag: '建築士の職責',
        },
      },
      {
        id: 'file-2',
        file: new File([], 'test2.png'),
        filePath: '/tmp/test2.png',
        metadata: {
          grade: 'firstGrade',
          subject: '学科Ⅰ',
          bigCategoryTag: '建築計画',
          smallCategoryTag: '建築士の職責',
        },
      },
    ]);

    render(<ImageUpload {...defaultProps} />);
    expect(screen.getByText('file-1')).toBeInTheDocument();
    expect(screen.getByText('file-2')).toBeInTheDocument();
  });

  it('アップロードボタンが表示される', () => {
    render(<ImageUpload {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: 'アップロード' }),
    ).toBeInTheDocument();
  });

  it('必須項目がすべて揃いファイルがあるときボタンが有効になる', () => {
    setupStore([
      {
        id: 'file-1',
        file: new File([], 'test.png'),
        filePath: '/tmp/test.png',
        metadata: {
          grade: 'firstGrade',
          subject: '学科Ⅰ',
          bigCategoryTag: '建築計画',
          smallCategoryTag: '建築士の職責',
        },
      },
    ]);

    render(<ImageUpload {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'アップロード' })).toBeEnabled();
  });

  it('imageFilesが空のときボタンが無効になる', () => {
    setupStore([]);

    render(<ImageUpload {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'アップロード' })).toBeDisabled();
  });

  it('学科が未選択のときボタンが無効になる', () => {
    setupStore([
      {
        id: 'file-1',
        file: new File([], 'test.png'),
        filePath: '/tmp/test.png',
        metadata: {
          grade: 'firstGrade',
          subject: '学科Ⅰ',
          bigCategoryTag: '建築計画',
          smallCategoryTag: '建築士の職責',
        },
      },
    ]);

    render(
      <ImageUpload
        {...defaultProps}
        initialSubject={'' as ImageUploadProps['initialSubject']}
      />,
    );
    expect(screen.getByRole('button', { name: 'アップロード' })).toBeDisabled();
  });

  it('大分類が未選択のときボタンが無効になる', () => {
    setupStore([
      {
        id: 'file-1',
        file: new File([], 'test.png'),
        filePath: '/tmp/test.png',
        metadata: {
          grade: 'firstGrade',
          subject: '学科Ⅰ',
          bigCategoryTag: '建築計画',
          smallCategoryTag: '建築士の職責',
        },
      },
    ]);

    render(<ImageUpload {...defaultProps} initialBigCategory="" />);
    expect(screen.getByRole('button', { name: 'アップロード' })).toBeDisabled();
  });

  it('小分類が未選択のときボタンが無効になる', () => {
    setupStore([
      {
        id: 'file-1',
        file: new File([], 'test.png'),
        filePath: '/tmp/test.png',
        metadata: {
          grade: 'firstGrade',
          subject: '学科Ⅰ',
          bigCategoryTag: '建築計画',
          smallCategoryTag: '建築士の職責',
        },
      },
    ]);

    render(<ImageUpload {...defaultProps} initialSmallCategory="" />);
    expect(screen.getByRole('button', { name: 'アップロード' })).toBeDisabled();
  });

  it('isUploadingがtrueのときボタンが無効で「アップロード中…」と表示される', () => {
    setupStore([
      {
        id: 'file-1',
        file: new File([], 'test.png'),
        filePath: '/tmp/test.png',
        metadata: {
          grade: 'firstGrade',
          subject: '学科Ⅰ',
          bigCategoryTag: '建築計画',
          smallCategoryTag: '建築士の職責',
        },
      },
    ]);

    render(<ImageUpload {...defaultProps} isUploading={true} />);
    const btn = screen.getByRole('button', { name: 'アップロード中…' });
    expect(btn).toBeDisabled();
  });

  it('アップロードボタンをクリックするとonClickUploadが呼ばれる', async () => {
    setupStore([
      {
        id: 'file-1',
        file: new File([], 'test.png'),
        filePath: '/tmp/test.png',
        metadata: {
          grade: 'firstGrade',
          subject: '学科Ⅰ',
          bigCategoryTag: '建築計画',
          smallCategoryTag: '建築士の職責',
        },
      },
    ]);
    const user = userEvent.setup();

    render(<ImageUpload {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: 'アップロード' }));
    expect(defaultProps.onClickUpload).toHaveBeenCalledOnce();
  });
});
