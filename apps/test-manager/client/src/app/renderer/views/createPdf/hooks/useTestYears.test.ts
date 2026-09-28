import type { TestData } from '@shared/types/contracts';
import { act, renderHook } from '@testing-library/react';
import useCreatePdfResourceStore from '@views/createPdf/store/useCreatePdfResourceStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestYears } from './useTestYears';

// ─── テスト用ヘルパー ──────────────────────────────────────────────────────────

const makeTestData = (no: number, nengo: string, year: string): TestData => ({
  active: true,
  answerNumber: '1',
  answerText: '',
  answerText1: '',
  answerText2: '',
  answerText3: '',
  answerText4: '',
  answerText5: '',
  bigCategoryTag: '',
  ch1: '',
  ch2: '',
  ch3: '',
  ch4: '',
  ch5: '',
  difficult: '1',
  grade: 1,
  id: `id-${no}`,
  isConvertibleQaa: false,
  isNegativeAnswer: false,
  nengo,
  no,
  parentNo: 0,
  smallCategoryTag: '',
  status: '準備完了',
  subject: '学科Ⅰ',
  testNo: String(no),
  text: `問題${no}`,
  themeTag: '',
  year,
});

/** by-no マップを使って setTestData を呼ぶ */
function setResourceTestData(
  byNo: Map<number, TestData>,
  isLoading = false,
): void {
  useCreatePdfResourceStore.getState().actions.setTestData({
    maps: {
      byNo,
      byId: new Map([...byNo.values()].map((d) => [d.id ?? '', d])),
      byUuid: new Map(),
    },
    isLoading,
  });
}

// ─── テスト ───────────────────────────────────────────────────────────────────

describe('useTestYears', () => {
  beforeEach(() => {
    useCreatePdfResourceStore.getState().actions.reset();
  });

  it('testDataByNo が空のとき sortedLabels は空で selectedYearNos は null', () => {
    setResourceTestData(new Map());

    const { result } = renderHook(() =>
      useTestYears({
        selectedYears: null,
        onSelectedYearsChange: vi.fn(),
      }),
    );

    expect(result.current.sortedLabels).toEqual([]);
    expect(result.current.selectedYearNos).toBeNull();
    expect(result.current.isLoadingTestData).toBe(false);
  });

  it('sortedLabels は新しい元号順に降順で返る', () => {
    setResourceTestData(
      new Map([
        [1, makeTestData(1, '昭和', '63年')],
        [2, makeTestData(2, '平成', '10年')],
        [3, makeTestData(3, '令和', '3年')],
      ]),
    );

    const { result } = renderHook(() =>
      useTestYears({ selectedYears: null, onSelectedYearsChange: vi.fn() }),
    );

    expect(result.current.sortedLabels).toEqual([
      '令和3年',
      '平成10年',
      '昭和63年',
    ]);
  });

  it('selectedYears が null のとき effectiveSelectedYears は先頭 11 件を返す', () => {
    // 15 件のラベルを用意
    const byNo = new Map(
      Array.from({ length: 15 }, (_, i) => {
        const no = i + 1;
        return [no, makeTestData(no, '令和', `${no}年`)];
      }),
    );
    setResourceTestData(byNo);

    const { result } = renderHook(() =>
      useTestYears({ selectedYears: null, onSelectedYearsChange: vi.fn() }),
    );

    expect(result.current.effectiveSelectedYears).toHaveLength(11);
  });

  it('selectedYears が指定されているとき effectiveSelectedYears はその値をそのまま返す', () => {
    setResourceTestData(
      new Map([
        [1, makeTestData(1, '令和', '3年')],
        [2, makeTestData(2, '令和', '4年')],
      ]),
    );

    const selected = ['令和3年'];
    const { result } = renderHook(() =>
      useTestYears({ selectedYears: selected, onSelectedYearsChange: vi.fn() }),
    );

    expect(result.current.effectiveSelectedYears).toEqual(['令和3年']);
  });

  it('selectedYears が指定されているとき selectedYearNos は対象 nos の Set を返す', () => {
    setResourceTestData(
      new Map([
        [1, makeTestData(1, '令和', '3年')],
        [2, makeTestData(2, '令和', '3年')],
        [3, makeTestData(3, '令和', '4年')],
      ]),
    );

    const { result } = renderHook(() =>
      useTestYears({
        selectedYears: ['令和3年'],
        onSelectedYearsChange: vi.fn(),
      }),
    );

    expect(result.current.selectedYearNos).toEqual(new Set([1, 2]));
  });

  it('isLoading が true のとき selectedYearNos は null（全件対象）を返す', () => {
    setResourceTestData(
      new Map([[1, makeTestData(1, '令和', '3年')]]),
      true, // isLoading
    );

    const { result } = renderHook(() =>
      useTestYears({
        selectedYears: ['令和3年'],
        onSelectedYearsChange: vi.fn(),
      }),
    );

    expect(result.current.selectedYearNos).toBeNull();
    expect(result.current.isLoadingTestData).toBe(true);
  });

  it('onSelectedYearsChange を呼ぶと input の関数が呼ばれる', () => {
    setResourceTestData(new Map());

    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useTestYears({ selectedYears: null, onSelectedYearsChange: onChange }),
    );

    act(() => {
      result.current.onSelectedYearsChange(['令和3年']);
    });

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(['令和3年']);
  });

  it('存在しない年ラベルが selectedYears に含まれていても例外にならず nos が 0 件になる', () => {
    setResourceTestData(new Map([[1, makeTestData(1, '令和', '3年')]]));

    const { result } = renderHook(() =>
      useTestYears({
        selectedYears: ['存在しない年'],
        onSelectedYearsChange: vi.fn(),
      }),
    );

    expect(result.current.selectedYearNos).toEqual(new Set());
  });
});
