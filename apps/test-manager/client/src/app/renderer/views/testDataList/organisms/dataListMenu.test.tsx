import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataListMenu from '@views/testDataList/organisms/dataListMenu';
import useDataGridStore from '@views/testDataList/stores/useDataGridStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@views/testDataList/stores/useDataGridStore', () => ({
  default: vi.fn(),
}));

describe('DataListMenu', () => {
  const defaultProps = {
    columnKey: 'year',
    filterOption: ['Option1', 'Option2'],
    onSortColumns: vi.fn(),
    onCheckedChange: vi.fn(),
  };

  const updateFilter = vi.fn();
  const setCheckedFilters = vi.fn();
  const setSelectedRows = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDataGridStore).mockReturnValue({
      //すべてのフィルターが選択されている状態
      checkedFilters: { year: ['Option1', 'Option2'] },
      updateFilter,
      setCheckedFilters,
      setSelectedRows,
    });
  });

  it('DataListMenuが表示される', () => {
    render(<DataListMenu {...defaultProps} />);
    const trigger = screen.getByRole('button');

    expect(trigger).toBeInTheDocument();
  });

  it('アイコンをタップしたらDataListMenuの中身が表示される', async () => {
    const user = userEvent.setup();
    render(<DataListMenu {...defaultProps} />);

    const trigger = screen.getByRole('button');
    await user.click(trigger);
    const asc = screen.getByText('昇順で並べ替え');
    const desc = screen.getByText('降順で並べ替え');

    expect(asc).toBeInTheDocument();
    expect(desc).toBeInTheDocument();

    expect(screen.getByText('すべて表示')).toBeInTheDocument();

    if (defaultProps.filterOption.length > 0) {
      // filterOption に含まれるすべてのフィルターが表示されているか確認
      defaultProps.filterOption.forEach((filter) => {
        const filterElement = screen.getByLabelText(filter);
        expect(filterElement).toBeInTheDocument();
      });
    }
  });

  it('昇順で並べ替えをクリックするとonSortColumnsが呼ばれる', async () => {
    const user = userEvent.setup();
    render(<DataListMenu {...defaultProps} />);

    const trigger = screen.getByRole('button');
    await user.click(trigger);

    const asc = screen.getByText('昇順で並べ替え');
    await user.click(asc);

    expect(defaultProps.onSortColumns).toHaveBeenCalledWith('year', 'ASC');
  });

  it('降順で並べ替えをクリックするとonSortColumnsが呼ばれる', async () => {
    const user = userEvent.setup();
    render(<DataListMenu {...defaultProps} />);

    const trigger = screen.getByRole('button');
    await user.click(trigger);

    const desc = screen.getByText('降順で並べ替え');
    await user.click(desc);

    expect(defaultProps.onSortColumns).toHaveBeenCalledWith('year', 'DESC');
  });

  it('個別のフィルターを解除できる', async () => {
    render(<DataListMenu {...defaultProps} />);
    const user = userEvent.setup();

    const trigger = screen.getByRole('button');
    await user.click(trigger);

    const option1Checkbox = screen.getByLabelText('Option1');
    await user.click(option1Checkbox);

    expect(setSelectedRows).toHaveBeenCalledTimes(1);
    expect(updateFilter).toHaveBeenCalledWith('year', 'Option1', false);
  });

  it('一部だけ選択されている場合はすべて表示が未チェックになる', async () => {
    vi.mocked(useDataGridStore).mockReturnValue({
      checkedFilters: { year: ['Option1'] },
      updateFilter,
      setCheckedFilters,
      setSelectedRows,
    });

    const user = userEvent.setup();
    render(<DataListMenu {...defaultProps} />);

    await user.click(screen.getByRole('button'));

    expect(screen.getByLabelText('すべて表示')).not.toBeChecked();
  });
  it('すべて表示を押すと全フィルターを解除できる', async () => {
    const user = userEvent.setup();
    render(<DataListMenu {...defaultProps} />);

    const trigger = screen.getByRole('button');
    await user.click(trigger);

    const selectAllCheckbox = screen.getByLabelText('すべて表示');
    await user.click(selectAllCheckbox);

    expect(setSelectedRows).toHaveBeenCalledTimes(1);
    expect(setCheckedFilters).toHaveBeenCalledWith({
      year: [],
    });
  });
  it('未全選択状態ですべて表示を押すと全フィルターを選択できる', async () => {
    vi.mocked(useDataGridStore).mockReturnValue({
      checkedFilters: { year: ['Option1'] },
      updateFilter,
      setCheckedFilters,
      setSelectedRows,
    });

    const user = userEvent.setup();
    render(<DataListMenu {...defaultProps} />);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByLabelText('すべて表示'));

    expect(setSelectedRows).toHaveBeenCalledTimes(1);
    expect(setCheckedFilters).toHaveBeenCalledWith({
      year: ['Option1', 'Option2'],
    });
  });
});
