import { useTypedFirestoreHandler } from '@hooks/useTypedFirestoreHandler';
import { waitOutboxSettled } from '@renderer/api/waitOutboxSettled';
import { useGlobalLoading } from '@renderer/hooks/useGlobalLoading';
import type { TestData, Version } from '@shared/types/contracts';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOriginalTestDataCreate } from './useOriginalTestDataCreate';

const navigateMock = vi.fn();
const createAtPathMock = vi.fn();
const showMock = vi.fn(() => 'loading-id');
const hideMock = vi.fn();
const setMessageMock = vi.fn();

vi.mock('@hooks/useTypedFirestoreHandler', () => ({
  useTypedFirestoreHandler: vi.fn(),
}));

vi.mock('react-router', async (orig) => {
  const actual = (await orig()) as object;
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@renderer/hooks/useGlobalLoading', () => ({
  useGlobalLoading: vi.fn(),
}));

vi.mock('@renderer/api/waitOutboxSettled', () => ({
  waitOutboxSettled: vi.fn(),
}));

const mkDoc = (
  path: string,
  data: Partial<TestData>,
  updateTime: Version = { seconds: 1, nanos: 0 },
) => ({
  path,
  data: data as TestData,
  updateTime,
});

describe('useOriginalTestDataCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useTypedFirestoreHandler).mockReturnValue({
      createAtPath: createAtPathMock,
    } as unknown as ReturnType<typeof useTypedFirestoreHandler>);

    vi.mocked(useGlobalLoading).mockReturnValue({
      show: showMock,
      hide: hideMock,
      setMessage: setMessageMock,
      run: vi.fn(),
    });
  });

  it('未選択時は maxNo + 1 で新規作成ダイアログを開く', () => {
    const docs = [
      mkDoc('firstGrade/10', { no: 10 }),
      mkDoc('firstGrade/12', { no: 12 }),
    ];

    const setBusy = vi.fn();
    const setStatusMessage = vi.fn();

    const { result } = renderHook(() =>
      useOriginalTestDataCreate({
        docs,
        grade: 'firstGrade',
        selectedRows: new Set(),
        busy: null,
        setBusy,
        setStatusMessage,
        formatNos: (nos) => nos.join(', '),
      }),
    );

    act(() => {
      result.current.startCreateDialog();
    });

    expect(result.current.createDialogOpen).toBe(true);
    expect(result.current.createMode).toBe('new');
    expect(result.current.createTargetNos).toEqual([13]);
    expect(result.current.createSourceNos).toEqual([]);
  });

  it('選択時は copy モードで連番採番する', () => {
    const docs = [
      mkDoc('firstGrade/10', { no: 10 }),
      mkDoc('firstGrade/12', { no: 12 }),
      mkDoc('firstGrade/20', { no: 20 }),
    ];

    const { result } = renderHook(() =>
      useOriginalTestDataCreate({
        docs,
        grade: 'firstGrade',
        selectedRows: new Set(['firstGrade/12', 'firstGrade/20']),
        busy: null,
        setBusy: vi.fn(),
        setStatusMessage: vi.fn(),
        formatNos: (nos) => nos.join(', '),
      }),
    );

    act(() => {
      result.current.startCreateDialog();
    });

    expect(result.current.createDialogOpen).toBe(true);
    expect(result.current.createMode).toBe('copy');
    expect(result.current.createSourceNos).toEqual([12, 20]);
    expect(result.current.createTargetNos).toEqual([21, 22]);
  });

  it('新規作成成功時は createAtPath 後に編集画面へ遷移する', async () => {
    createAtPathMock.mockResolvedValue('mid-1');
    vi.mocked(waitOutboxSettled).mockResolvedValue({
      ok: true,
      committed: 1,
      failed: 0,
      timeout: false,
      failedMutationIds: [],
    });

    const docs = [mkDoc('firstGrade/12', { no: 12 })];
    const setBusy = vi.fn();
    const setStatusMessage = vi.fn();

    const { result } = renderHook(() =>
      useOriginalTestDataCreate({
        docs,
        grade: 'firstGrade',
        selectedRows: new Set(),
        busy: null,
        setBusy,
        setStatusMessage,
        formatNos: (nos) => nos.join(', '),
      }),
    );

    act(() => {
      result.current.startCreateDialog();
    });

    await act(async () => {
      await result.current.confirmCreate();
    });

    expect(createAtPathMock).toHaveBeenCalledTimes(1);
    expect(createAtPathMock).toHaveBeenCalledWith(
      'firstGrade/13',
      expect.objectContaining({
        no: 13,
        grade: 0,
        isOriginal: true,
        calibrationCheck: false,
        status: 'エラー',
        active: true,
        nengo: '',
        year: '',
      }),
    );

    expect(navigateMock).toHaveBeenCalledWith('/testDataEditor', {
      state: {
        grade: 'firstGrade',
        idList: [
          {
            no: 13,
            name: '学科Ⅰ No.13',
            status: 'エラー',
          },
        ],
      },
    });
  });

  it('コピー作成時は固定値を上書きし、id / updatedAt をコピーしない', async () => {
    createAtPathMock
      .mockResolvedValueOnce('mid-1')
      .mockResolvedValueOnce('mid-2');

    vi.mocked(waitOutboxSettled).mockResolvedValue({
      ok: true,
      committed: 2,
      failed: 0,
      timeout: false,
      failedMutationIds: [],
    });

    const docs = [
      mkDoc('firstGrade/10', {
        no: 10,
        grade: 0,
        id: 'legacy-id',
        updatedAt: { seconds: 999, nanoseconds: 0 } as never,
        isOriginal: false,
        calibrationCheck: true,
        status: '準備完了',
        active: false,
        autoCheck: true,
        subject: '学科Ⅰ',
      }),
      mkDoc('firstGrade/20', {
        no: 20,
        grade: 0,
        isOriginal: false,
        calibrationCheck: true,
        status: '停止中',
        active: false,
        autoCheck: false,
        subject: '学科Ⅱ',
      }),
    ];

    const { result } = renderHook(() =>
      useOriginalTestDataCreate({
        docs,
        grade: 'firstGrade',
        selectedRows: new Set(['firstGrade/10', 'firstGrade/20']),
        busy: null,
        setBusy: vi.fn(),
        setStatusMessage: vi.fn(),
        formatNos: (nos) => nos.join(', '),
      }),
    );

    act(() => {
      result.current.startCreateDialog();
    });

    await act(async () => {
      await result.current.confirmCreate();
    });

    expect(createAtPathMock).toHaveBeenNthCalledWith(
      1,
      'firstGrade/21',
      expect.objectContaining({
        no: 21,
        grade: 0,
        isOriginal: true,
        calibrationCheck: false,
        status: '準備中',
        active: true,
        autoCheck: true,
        subject: '学科Ⅰ',
      }),
    );

    const firstPayload = createAtPathMock.mock.calls[0][1];
    expect(firstPayload).not.toHaveProperty('id');
    expect(firstPayload).not.toHaveProperty('updatedAt');

    expect(navigateMock).toHaveBeenCalledWith('/testDataEditor', {
      state: {
        grade: 'firstGrade',
        idList: [
          {
            no: 21,
            name: '学科Ⅰ No.21',
            status: '準備中',
          },
          {
            no: 22,
            name: '学科Ⅱ No.22',
            status: 'エラー',
          },
        ],
      },
    });
  });

  it('コミット待ちが timeout のときは遷移しない', async () => {
    createAtPathMock.mockResolvedValue('mid-1');
    vi.mocked(waitOutboxSettled).mockResolvedValue({
      ok: false,
      committed: 0,
      failed: 0,
      timeout: true,
      failedMutationIds: [],
    });

    const setStatusMessage = vi.fn();

    const { result } = renderHook(() =>
      useOriginalTestDataCreate({
        docs: [mkDoc('firstGrade/5', { no: 5 })],
        grade: 'firstGrade',
        selectedRows: new Set(),
        busy: null,
        setBusy: vi.fn(),
        setStatusMessage,
        formatNos: (nos) => nos.join(', '),
      }),
    );

    act(() => {
      result.current.startCreateDialog();
    });

    await act(async () => {
      await result.current.confirmCreate();
    });

    expect(navigateMock).not.toHaveBeenCalled();
    expect(setStatusMessage).toHaveBeenCalledWith(
      expect.stringContaining('作成結果の確認に失敗しました'),
    );
  });
});
