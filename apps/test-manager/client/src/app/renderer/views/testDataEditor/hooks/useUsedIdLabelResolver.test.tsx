import { renderHook, waitFor } from '@testing-library/react';
import {
  type ImageItem,
  kOf,
} from '@views/testDataEditor/hooks/useImageAssetList';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useUsedIdLabelResolver from './useUsedIdLabelResolver';

const createImageItem = (overrides?: Partial<ImageItem>): ImageItem => ({
  grade: 'secondGrade',
  key: 'img1',
  objectPath: 'original/secondGrade/img1.png',
  name: 'img1.png',
  subject: '学科Ⅱ',
  bigCategoryTag: '構造',
  smallCategoryTag: '鉄骨',
  tag: [],
  title: '画像1',
  usedIds: [],
  ...overrides,
});

describe('useUsedIdLabelResolver', () => {
  const mockBatchGetDocs = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'fs', {
      configurable: true,
      value: {
        batchGetDocs: mockBatchGetDocs,
      },
    });
  });

  it('editMapに存在する問題は即座に整形ラベルを返す', () => {
    const { result } = renderHook(() =>
      useUsedIdLabelResolver({
        imageItems: [createImageItem({ usedIds: ['1_10'] })],
        imageItemKeys: [kOf(createImageItem())],
        editMap: {
          '10': {
            id: '10',
            updatedAtMs: Date.now(),
            data: {
              subject: '学科Ⅲ',
              nengo: '令和',
              year: '5',
              no: 12,
            } as never,
          },
        },
      }),
    );

    expect(result.current.formatUsedIdLabel('1_10')).toBe(
      '[2級] 学科Ⅲ 令和5年 問題No.12',
    );
    expect(mockBatchGetDocs).not.toHaveBeenCalled();
  });

  it('visibleなusedIdは不足時にbatchGetDocsで先読みされる', async () => {
    mockBatchGetDocs.mockResolvedValue({
      docs: {
        'secondGrade/20': {
          data: {
            subject: '学科Ⅰ',
            nengo: '平成',
            year: '30',
            no: 7,
          },
        },
      },
    });

    const { result } = renderHook(() =>
      useUsedIdLabelResolver({
        imageItems: [createImageItem({ usedIds: ['1_20'] })],
        imageItemKeys: [kOf(createImageItem())],
        editMap: {},
      }),
    );

    expect(result.current.formatUsedIdLabel('1_20')).toBe('[2級] 20');

    await waitFor(() => {
      expect(mockBatchGetDocs).toHaveBeenCalledWith({
        paths: ['secondGrade/20'],
      });
      expect(result.current.formatUsedIdLabel('1_20')).toBe(
        '[2級] 学科Ⅰ 平成30年 問題No.7',
      );
    });
  });
});
