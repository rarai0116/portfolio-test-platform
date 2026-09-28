import type { RemovableListItemProps } from '@parts/removableListItem';
import { render, screen } from '@testing-library/react';
import type { UploadImageFile } from '@views/testDataEditor/store/useImageDropzoneStore';
import { describe, expect, it, vi } from 'vitest';
import PreUploadImageList from './preUploadImageList';

vi.mock('@parts/removableListItem', () => ({
  default: ({ id, text, onClick }: RemovableListItemProps) => (
    <button
      type="button"
      data-testid={`removable-item-${id}`}
      onClick={onClick}
    >
      {text}
    </button>
  ),
}));

describe('PreUploadImageList', () => {
  const mockOnClick = vi.fn();
  /*
  const mockMetadata = {
    grade: '1' as GradeId,
    subject: '',
    bigCategoryTag: '',
    smallCategoryTag: '',
  };
  */
  const mockImageFileList: UploadImageFile[] = [
    {
      id: 'file-1',
      file: new File([''], 'test1.png'),
      filePath: '/tmp/test1.png',
      metadata: {
        subject: '学科Ⅰ',
        grade: 'firstGrade',
        bigCategoryTag: 'tag1',
        smallCategoryTag: 'tagA',
      },
    },
    {
      id: 'file-2',
      file: new File([''], 'test2.png'),
      filePath: '/tmp/test2.png',
      metadata: {
        subject: '学科Ⅱ',
        grade: 'secondGrade',
        bigCategoryTag: 'tag2',
        smallCategoryTag: 'tagB',
      },
    },
    {
      id: 'file-3',
      file: new File([''], 'test3.png'),
      filePath: '/tmp/test3.png',
      metadata: {
        subject: '学科Ⅲ',
        grade: 'firstGrade',
        bigCategoryTag: 'tag3',
        smallCategoryTag: 'tagC',
      },
    },
  ];

  const defaultProps = {
    imageFileList: mockImageFileList,
    onClick: mockOnClick,
  };

  it('imageFileListの数だけRemovableListItemが表示される', () => {
    render(<PreUploadImageList {...defaultProps} onClick={mockOnClick} />);

    expect(screen.getByTestId('removable-item-file-1')).toBeInTheDocument();
    expect(screen.getByTestId('removable-item-file-2')).toBeInTheDocument();
    expect(screen.getByTestId('removable-item-file-3')).toBeInTheDocument();
  });
  it('imageFileListが空の場合、何も表示されない', () => {
    const { container } = render(
      <PreUploadImageList {...defaultProps} imageFileList={[]} />,
    );

    expect(container.querySelector('button')).not.toBeInTheDocument();
  });
});
