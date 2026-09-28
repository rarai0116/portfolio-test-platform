import {
  generateMockRow,
  mockCheckedFilters,
  mockTestDocs,
} from '@renderer/mocks/mockTestDataList';
import { renderHook } from '@testing-library/react';
import useDataGridStore from '@views/testDataList/stores/useDataGridStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useDataGridRows from './useDataGridRows';

vi.mock('@views/testDataList/stores/useDataGridStore', () => ({
  default: vi.fn(),
}));

const mockTestData = generateMockRow(mockTestDocs);

describe('useDataGridRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDataGridStore).mockReturnValue({
      checkedFilters: mockCheckedFilters,
      sortColumns: [],
    });
  });

  it('基本的な行データが正しく生成される', () => {
    const { result } = renderHook(() => useDataGridRows(mockTestDocs));
    expect(result.current.filteredAndSortedRows).toHaveLength(3);

    const firstRow = result.current.filteredAndSortedRows[0];
    expect(firstRow).toEqual(mockTestData[0]);
    expect(firstRow.publicationYear).toBe('2021');
    expect(firstRow.publicationNo).toBe('10');
    expect(firstRow.shuffleable).toBe('◯');
    expect(firstRow.convertibleQaa).toBe('◯');
    expect(firstRow.answerFormat).toBe('誤答形式');
  });

  it('シャッフル・一問一答化・形式を表示値に変換する', () => {
    const { result } = renderHook(() => useDataGridRows(mockTestDocs));

    expect(
      result.current.filteredAndSortedRows.map((row) => row.shuffleable),
    ).toEqual(['◯', '×', '×']);
    expect(
      result.current.filteredAndSortedRows.map((row) => row.convertibleQaa),
    ).toEqual(['◯', '◯', '◯']);
    expect(
      result.current.filteredAndSortedRows.map((row) => row.answerFormat),
    ).toEqual(['誤答形式', '正答形式', '誤答形式']);
  });

  it('dataがundefined の場合は除外される', () => {
    const docsWithUndefined = [
      ...mockTestDocs,
      {
        path: 'test/undefined',
        data: undefined,
        updateTime: { seconds: 0, nanos: 0 },
      },
    ];

    const { result } = renderHook(() => useDataGridRows(docsWithUndefined));

    expect(result.current.filteredAndSortedRows).toHaveLength(3);
  });

  it('フィルタリングが正しく動作する', () => {
    vi.mocked(useDataGridStore).mockReturnValue({
      checkedFilters: {
        ...mockCheckedFilters,
        year: ['令和1'],
      },
      sortColumns: [],
    });

    const { result } = renderHook(() => useDataGridRows(mockTestDocs));

    expect(result.current.filteredAndSortedRows).toHaveLength(1);
    expect(result.current.filteredAndSortedRows[0].year).toBe('令和1');
  });

  it('フィルターを全件外すと0件になる', () => {
    vi.mocked(useDataGridStore).mockReturnValue({
      checkedFilters: {
        ...mockCheckedFilters,
        year: [],
      },
      sortColumns: [],
    });

    const { result } = renderHook(() => useDataGridRows(mockTestDocs));

    expect(result.current.filteredAndSortedRows).toHaveLength(0);
  });

  it('タグはOR条件でフィルタリングされる', () => {
    vi.mocked(useDataGridStore).mockReturnValue({
      checkedFilters: {
        ...mockCheckedFilters,
        otherTags: ['法規', '設備'],
      },
      sortColumns: [],
    });

    const { result } = renderHook(() => useDataGridRows(mockTestDocs));

    expect(result.current.filteredAndSortedRows).toHaveLength(2);
    expect(result.current.filteredAndSortedRows.map((row) => row.no)).toEqual([
      0, 1,
    ]);
  });

  it('タグが全選択ならタグ未設定行も含めて全件表示される', () => {
    vi.mocked(useDataGridStore).mockReturnValue({
      checkedFilters: mockCheckedFilters,
      sortColumns: [],
    });

    const { result } = renderHook(() => useDataGridRows(mockTestDocs));

    expect(result.current.filteredAndSortedRows).toHaveLength(3);
  });

  it('ソート機能が正しく動作する（昇順）', () => {
    vi.mocked(useDataGridStore).mockReturnValue({
      checkedFilters: mockCheckedFilters,
      sortColumns: [{ columnKey: 'subject', direction: 'ASC' }],
    });

    const unorderedDocs = [mockTestDocs[2], mockTestDocs[1], mockTestDocs[0]];

    const { result } = renderHook(() => useDataGridRows(unorderedDocs));

    expect(result.current.filteredAndSortedRows[0].subject).toBe('学科Ⅰ');
    expect(result.current.filteredAndSortedRows[1].subject).toBe('学科Ⅱ');
  });

  it('ソート機能が正しく動作する（降順）', () => {
    vi.mocked(useDataGridStore).mockReturnValue({
      checkedFilters: mockCheckedFilters,
      sortColumns: [{ columnKey: 'subject', direction: 'DESC' }],
    });

    const { result } = renderHook(() => useDataGridRows(mockTestDocs));

    expect(result.current.filteredAndSortedRows[0].subject).toBe('学科Ⅲ');
    expect(result.current.filteredAndSortedRows[1].subject).toBe('学科Ⅱ');
  });
  it('資料Noを数値としてソートできる', () => {
    vi.mocked(useDataGridStore).mockReturnValue({
      checkedFilters: mockCheckedFilters,
      sortColumns: [{ columnKey: 'publicationNo', direction: 'ASC' }],
    });

    const unorderedDocs = [mockTestDocs[0], mockTestDocs[1], mockTestDocs[2]];

    const { result } = renderHook(() => useDataGridRows(unorderedDocs));

    expect(result.current.filteredAndSortedRows[0].publicationNo).toBe('1');
    expect(result.current.filteredAndSortedRows[1].publicationNo).toBe('2');
    expect(result.current.filteredAndSortedRows[2].publicationNo).toBe('10');
  });
});
