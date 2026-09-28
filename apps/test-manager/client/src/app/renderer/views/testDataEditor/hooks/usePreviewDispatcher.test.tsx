import type { TestData } from '@shared/types/contracts';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendPreviewFullMock = vi.fn();
const sendPreviewPatchMock = vi.fn();
const patchPreviewImagesMock = vi.fn();
const getPreviewImagesMapMock = vi.fn(() => ({}));

vi.mock('@api/previewBridge', () => ({
  sendPreviewFull: (payload: unknown) => sendPreviewFullMock(payload),
  sendPreviewPatch: (payload: unknown) => sendPreviewPatchMock(payload),
  patchPreviewImages: (id: string, images?: unknown) =>
    patchPreviewImagesMock(id, images),
  getPreviewImagesMap: () => getPreviewImagesMapMock(),
}));

import { usePreviewDispatcher } from './usePreviewDispatcher';

const createTestData = (overrides?: Partial<TestData>): TestData => ({
  active: true,
  answerNumber: '2',
  answerText: '<p>解説本文</p>',
  answerText1: '<p>解説1</p>',
  answerText2: '',
  answerText3: '',
  answerText4: '',
  answerText5: '',
  bigCategoryTag: '大分類',
  ch1: '<p>選択肢1</p>',
  ch2: '<p>選択肢2</p>',
  ch3: '',
  ch4: '',
  ch5: '',
  difficult: '1',
  grade: 0,
  isConvertibleQaa: false,
  isNegativeAnswer: false,
  nengo: '',
  no: 12,
  parentNo: 0,
  smallCategoryTag: '小分類',
  status: 'エラー',
  subject: '学科Ⅰ',
  testNo: '',
  text: '<p>問題本文</p>',
  themeTag: '',
  year: '',
  questionEditorType: 'normal',
  answerEditorType: 'normal',
  isOriginal: true,
  ...overrides,
});

describe('usePreviewDispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  it('オリジナル問題のフルプレビューはsourceの本文HTMLを使って送信する', () => {
    const source = createTestData();

    const { result } = renderHook(() =>
      usePreviewDispatcher({
        selectedDataId: '12',
        getCurrentPreviewSource: () => source,
      }),
    );

    act(() => {
      result.current.fullBuildPreview(source);
    });

    expect(sendPreviewFullMock).toHaveBeenCalledTimes(1);
    expect(sendPreviewFullMock).toHaveBeenCalledWith(
      expect.objectContaining({
        question: expect.objectContaining({
          textHtml: '<p>問題本文</p>',
          choices: expect.arrayContaining(['<p>選択肢1</p>', '<p>選択肢2</p>']),
        }),
        answer: expect.objectContaining({
          textHtml: '<p>解説本文</p>',
          choices: expect.arrayContaining(['<p>解説1</p>']),
        }),
      }),
    );
  });

  it('source未指定でも現在選択中データからフルプレビューを送信できる', () => {
    const source = createTestData({ text: '<p>現在の本文</p>' });

    const { result } = renderHook(() =>
      usePreviewDispatcher({
        selectedDataId: '12',
        getCurrentPreviewSource: () => source,
      }),
    );

    act(() => {
      result.current.fullBuildPreview();
    });

    expect(sendPreviewFullMock).toHaveBeenCalledTimes(1);
    expect(sendPreviewFullMock).toHaveBeenCalledWith(
      expect.objectContaining({
        question: expect.objectContaining({
          textHtml: '<p>現在の本文</p>',
        }),
      }),
    );
  });
});
