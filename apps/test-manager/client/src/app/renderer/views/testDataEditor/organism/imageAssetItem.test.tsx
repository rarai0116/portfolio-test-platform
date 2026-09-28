import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ImageItem } from '@views/testDataEditor/hooks/useImageAssetList';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImageAssetItem from './imageAssetItem';

const mockItem: ImageItem = {
  grade: 'firstGrade',
  key: 'test-asset-key',
  name: 'concrete_stress_strain.png',
  title: 'コンクリートの応力度－ひずみ度曲線',
  subject: '学科Ⅰ',
  bigCategoryTag: '建築計画',
  smallCategoryTag: '建築士の職責、建築設計の手法等',
  tag: [],
  objectPath: 'assets/firstGrade/concrete_stress_strain.png',
  width: 400,
  height: 300,
  usedIds: [],
};

vi.mock('@views/testDataEditor/hooks/useShrinkImageObserver', () => ({
  default: () => ({ width: '80px', height: '60px' }),
}));

vi.mock('@views/testDataEditor/parts/imageAsset', () => ({
  default: () => <div data-testid="image-asset">ImageAsset</div>,
}));

vi.mock('@views/testDataEditor/organism/imageAssetItemEditor', () => ({
  default: ({ onCancelEdit }: { onCancelEdit: () => void }) => (
    <div data-testid="image-asset-item-editor">
      <button type="button" onClick={onCancelEdit}>
        キャンセル
      </button>
    </div>
  ),
}));

vi.mock('@parts/deleteIcon', () => ({
  default: () => <svg data-testid="delete-icon" />,
}));

vi.mock('@components/icons/editIcon', () => ({
  default: () => <svg data-testid="edit-icon" />,
}));

describe('ImageAssetItem', () => {
  const listRef = { current: document.createElement('div') };
  const mockOnInsert = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnUpdateMetaData = vi.fn();

  const defaultProps = {
    id: 'firstGrade/test-asset-key',
    item: mockItem,
    listRef,
    onInsert: mockOnInsert,
    onDelete: mockOnDelete,
    onUpdateMetaData: mockOnUpdateMetaData,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ImageAssetが表示される', () => {
    render(<ImageAssetItem {...defaultProps} />);
    expect(screen.getByTestId('image-asset')).toBeInTheDocument();
  });

  it('メタデータが表示される', () => {
    render(<ImageAssetItem {...defaultProps} />);
    expect(
      screen.getByText('コンクリートの応力度－ひずみ度曲線'),
    ).toBeInTheDocument();
    expect(screen.getByText('1級')).toBeInTheDocument();
    expect(screen.getByText('学科Ⅰ')).toBeInTheDocument();
    expect(screen.getByText('建築計画')).toBeInTheDocument();
    expect(
      screen.getByText('建築士の職責、建築設計の手法等'),
    ).toBeInTheDocument();
  });

  it('usedIdLabelが渡されたとき使用箇所に表示される', () => {
    render(
      <ImageAssetItem {...defaultProps} usedIdLabel="R01-No.1, R01-No.2" />,
    );
    expect(screen.getByText('R01-No.1, R01-No.2')).toBeInTheDocument();
  });

  it('usedIdLabelが未指定のとき「未使用」と表示される', () => {
    render(<ImageAssetItem {...defaultProps} />);
    expect(screen.getByText('未使用')).toBeInTheDocument();
  });

  it('値が未設定のフィールドは「未設定」と表示される', () => {
    const emptyItem: ImageItem = {
      ...mockItem,
      title: '',
      subject: undefined,
      bigCategoryTag: undefined,
      smallCategoryTag: undefined,
    };
    render(<ImageAssetItem {...defaultProps} item={emptyItem} />);

    const unsetLabels = screen.getAllByText('未設定');
    expect(unsetLabels.length).toBeGreaterThanOrEqual(3);
  });

  it('挿入ボタンをクリックするとonInsertが呼ばれる', async () => {
    const user = userEvent.setup();
    render(<ImageAssetItem {...defaultProps} />);

    await user.click(screen.getByText('挿入'));
    expect(mockOnInsert).toHaveBeenCalledWith('firstGrade/test-asset-key');
  });

  it('削除ボタンをクリックするとonDeleteが呼ばれる', async () => {
    const user = userEvent.setup();
    render(<ImageAssetItem {...defaultProps} />);

    const deleteButton = screen.getByTestId('delete-icon').closest('button');
    if (deleteButton) {
      await user.click(deleteButton);
    }
    expect(mockOnDelete).toHaveBeenCalledWith('firstGrade/test-asset-key');
  });

  it('編集ボタンをクリックするとエディタが表示される', async () => {
    const user = userEvent.setup();
    render(<ImageAssetItem {...defaultProps} />);

    expect(
      screen.queryByTestId('image-asset-item-editor'),
    ).not.toBeInTheDocument();

    const editButton = screen.getByTestId('edit-icon').closest('button');
    if (editButton) {
      await user.click(editButton);
    }

    expect(screen.getByTestId('image-asset-item-editor')).toBeInTheDocument();
  });

  it('エディタのキャンセルで通常表示に戻る', async () => {
    const user = userEvent.setup();
    render(<ImageAssetItem {...defaultProps} />);

    const editButton = screen.getByTestId('edit-icon').closest('button');
    if (editButton) {
      await user.click(editButton);
    }
    expect(screen.getByTestId('image-asset-item-editor')).toBeInTheDocument();

    await user.click(screen.getByText('キャンセル'));
    expect(
      screen.queryByTestId('image-asset-item-editor'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('挿入')).toBeInTheDocument();
  });

  it('gradeがsecondGradeのとき「2級」と表示される', () => {
    const secondGradeItem: ImageItem = { ...mockItem, grade: 'secondGrade' };
    render(<ImageAssetItem {...defaultProps} item={secondGradeItem} />);
    expect(screen.getByText('2級')).toBeInTheDocument();
  });
});
