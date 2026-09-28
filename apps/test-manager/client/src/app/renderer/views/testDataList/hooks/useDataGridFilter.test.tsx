import {
  mockCheckedFilters,
  mockTestDocs,
} from '@renderer/mocks/mockTestDataList';
import { renderHook } from '@testing-library/react';
import useDataGridStore from '@views/testDataList/stores/useDataGridStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useDataGridFilter from './useDataGridFilter';

vi.mock('@views/testDataList/stores/useDataGridStore', () => ({
  default: vi.fn(),
}));

describe('useDataGridFilter', () => {
  const setCheckedFilters = vi.fn();
  const setFilterSelectionInitialized = vi.fn();
  const emptyCheckedFilters = {
    year: [],
    publicationYear: [],
    subject: [],
    bigCategory: [],
    smallCategory: [],
    otherTags: [],
    original: [],
    autoCheck: [],
    shuffleable: [],
    convertibleQaa: [],
    answerFormat: [],
    manualCheck: [],
    status: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDataGridStore).mockReturnValue({
      grade: 'firstGrade',
      checkedFilters: emptyCheckedFilters,
      filterSelectionInitialized: true,
      setCheckedFilters,
      setFilterSelectionInitialized,
    });
  });

  it('filterOptionsが正しく生成される', () => {
    const { result } = renderHook(() => useDataGridFilter(mockTestDocs, true));

    expect(result.current.filterOptions).toBeDefined();
    expect(typeof result.current.filterOptions).toBe('object');
  });

  it('永続化されたフィルターは利用可能な選択肢に同期される', () => {
    vi.mocked(useDataGridStore).mockReturnValue({
      grade: 'firstGrade',
      checkedFilters: {
        ...mockCheckedFilters,
        subject: ['存在しない科目'],
        bigCategory: ['建築設備'],
      },
      filterSelectionInitialized: true,
      setCheckedFilters,
      setFilterSelectionInitialized,
    });

    renderHook(() => useDataGridFilter(mockTestDocs, false));

    expect(setCheckedFilters).toHaveBeenCalledTimes(1);
    expect(setCheckedFilters).toHaveBeenCalledWith({
      ...mockCheckedFilters,
      otherTags: ['計画', '設備', '法規'],
      bigCategory: ['建築設備'],
      subject: [],
    });
  });
  it('候補未ロード時は永続化されたフィルターを維持する', () => {
    vi.mocked(useDataGridStore).mockReturnValue({
      grade: 'firstGrade',
      checkedFilters: {
        ...mockCheckedFilters,
        bigCategory: ['建築設備'],
      },
      filterSelectionInitialized: true,
      setCheckedFilters,
      setFilterSelectionInitialized,
    });

    renderHook(() => useDataGridFilter([], true));

    expect(setCheckedFilters).not.toHaveBeenCalled();
  });

  it('問題0件（loading 完了・docs 空）でも例外を投げない', () => {
    vi.mocked(useDataGridStore).mockReturnValue({
      grade: 'firstGrade',
      checkedFilters: emptyCheckedFilters,
      filterSelectionInitialized: false,
      setCheckedFilters,
      setFilterSelectionInitialized,
    });

    // docs が空配列かつ loading 完了時に docs[0] 参照でクラッシュしないことを確認する
    expect(() => renderHook(() => useDataGridFilter([], false))).not.toThrow();
    expect(setCheckedFilters).not.toHaveBeenCalled();
    expect(setFilterSelectionInitialized).not.toHaveBeenCalled();
  });

  it('初回のみ空配列を全選択へ移行する', () => {
    vi.mocked(useDataGridStore).mockReturnValue({
      grade: 'firstGrade',
      checkedFilters: emptyCheckedFilters,
      filterSelectionInitialized: false,
      setCheckedFilters,
      setFilterSelectionInitialized,
    });

    renderHook(() => useDataGridFilter(mockTestDocs, false));

    expect(setCheckedFilters).toHaveBeenCalledWith(mockCheckedFilters);
    expect(setFilterSelectionInitialized).toHaveBeenCalledWith(true);
  });

  it('初期化時は状態の停止中を未選択にする', () => {
    const baseData = mockTestDocs[0].data;
    if (!baseData) throw new Error('mockTestDocs[0].data is required');

    vi.mocked(useDataGridStore).mockReturnValue({
      grade: 'firstGrade',
      checkedFilters: emptyCheckedFilters,
      filterSelectionInitialized: false,
      setCheckedFilters,
      setFilterSelectionInitialized,
    });

    renderHook(() =>
      useDataGridFilter(
        [
          ...mockTestDocs,
          {
            ...mockTestDocs[0],
            path: 'firstGrade/stopped',
            data: {
              ...baseData,
              no: 999,
              status: '停止中',
            },
          },
        ],
        false,
      ),
    );

    expect(setCheckedFilters).toHaveBeenCalledWith({
      ...mockCheckedFilters,
      status: ['準備完了'],
    });
    expect(setFilterSelectionInitialized).toHaveBeenCalledWith(true);
  });
});
