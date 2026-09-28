import { waitOutboxSettled } from '@renderer/api/waitOutboxSettled';
import { useGlobalLoading } from '@renderer/hooks/useGlobalLoading';
import type { TestData, Version } from '@shared/types/contracts';
import { deriveTestDataStatusAfterResume } from '@views/testDataEditor/api/testDataUtils';
import { Timestamp } from 'firebase/firestore';
import { useCallback, useMemo, useState } from 'react';

import type { BusyKind } from '../index';

type SelectionMode = 'stopped' | 'notStopped' | null;

const isStoppedStatus = (v: unknown): boolean => v === '停止中';

const modeMatches = (
  status: unknown,
  mode: Exclude<SelectionMode, null>,
): boolean => {
  return mode === 'stopped'
    ? isStoppedStatus(status)
    : !isStoppedStatus(status);
};

type Props = {
  docs: { path: string; data?: TestData; updateTime: Version }[];
  selectedRows: Set<string>;
  setSelectedRows: (rows: Set<string>) => void;

  update: (idOrPath: string, data: Partial<TestData>) => Promise<string>;

  busy: BusyKind;
  setBusy: (next: BusyKind) => void;
  setStatusMessage: (message: string) => void;

  formatNos: (nos: number[]) => string;

  stallTimeoutMs?: number;
};

export function useStopToggle({
  docs,
  selectedRows,
  setSelectedRows,
  update,
  busy,
  setBusy,
  setStatusMessage,
  formatNos,
  stallTimeoutMs = 60_000,
}: Props) {
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const { show, hide, setMessage } = useGlobalLoading();

  const docsMap = useMemo(() => {
    const m = new Map<string, TestData>();
    for (const d of docs) {
      if (d.data) m.set(d.path, d.data);
    }
    return m;
  }, [docs]);

  const selectionMode = useMemo<SelectionMode>(() => {
    const first = selectedRows.values().next().value as string | undefined;
    if (!first) return null;
    const status = docsMap.get(first)?.status;
    return isStoppedStatus(status) ? 'stopped' : 'notStopped';
  }, [selectedRows, docsMap]);

  const stopActionLabel = selectionMode === 'stopped' ? '停止解除' : '出題停止';

  const selectedNos = useMemo(() => {
    return Array.from(selectedRows)
      .map((id) => docsMap.get(id)?.no)
      .filter((n): n is number => typeof n === 'number')
      .toSorted((a, b) => a - b);
  }, [selectedRows, docsMap]);

  const canOpenDialog = busy === null && selectionMode !== null;

  const startStopToggle = useCallback(() => {
    if (!canOpenDialog) return;
    setStopDialogOpen(true);
  }, [canOpenDialog]);

  const confirmStopToggle = useCallback(async () => {
    if (busy !== null) return;
    if (selectionMode === null) return;

    setStopDialogOpen(false);
    setBusy('stopToggle');

    const loadingId = show(`${stopActionLabel}中…`);
    try {
      const ids = Array.from(selectedRows);
      if (ids.length === 0) return;

      const mutationIds: string[] = [];
      const mutationIdToNo = new Map<string, number>();
      const enqueueFailedNos: number[] = [];

      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const doc = docsMap.get(id);
        const no = doc?.no;

        const patch: Partial<TestData> =
          selectionMode === 'stopped'
            ? {
                status: deriveTestDataStatusAfterResume({
                  autoCheckOk: doc?.autoCheck === true,
                  calibrationCheck: false,
                }),
                calibrationCheck: false,
                updatedAt: Timestamp.now(),
              }
            : {
                status: '停止中',
                updatedAt: Timestamp.now(),
              };

        try {
          const mutationId = await update(id, patch);
          mutationIds.push(mutationId);
          if (typeof no === 'number') mutationIdToNo.set(mutationId, no);
        } catch (_e) {
          if (typeof no === 'number') enqueueFailedNos.push(no);
        }

        setMessage(loadingId, `${stopActionLabel}中… ${i + 1}/${ids.length}件`);
      }

      if (mutationIds.length === 0) {
        setStatusMessage(`${stopActionLabel}に失敗しました`);
        return;
      }

      const settled = await waitOutboxSettled(
        mutationIds,
        stallTimeoutMs,
        (message) => setMessage(loadingId, message),
      );

      const outboxFailedNos = settled.failedMutationIds
        .map((mid) => mutationIdToNo.get(mid))
        .filter((n): n is number => typeof n === 'number');

      const failedNos = Array.from(
        new Set([...enqueueFailedNos, ...outboxFailedNos]),
      ).toSorted((a, b) => a - b);

      if (!settled.ok && settled.timeout) {
        setStatusMessage(
          `コミット待ちがタイムアウトしました。Outboxを確認してください。\n` +
            `成功=${settled.committed}件 / 失敗=${settled.failed}件 / 投入失敗=${enqueueFailedNos.length}件` +
            (failedNos.length ? `\n失敗No:\n${formatNos(failedNos)}` : ''),
        );
        return;
      }

      if (failedNos.length > 0) {
        setStatusMessage(
          `${stopActionLabel}完了（成功=${settled.committed}件 / 失敗=${settled.failed}件 / 投入失敗=${enqueueFailedNos.length}件）\n` +
            `失敗No:\n${formatNos(failedNos)}`,
        );
        return;
      }

      setStatusMessage(
        `${stopActionLabel}が完了しました（${settled.committed}件）`,
      );
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      hide(loadingId);
    }
  }, [
    busy,
    selectionMode,
    setBusy,
    show,
    stopActionLabel,
    selectedRows,
    docsMap,
    update,
    setMessage,
    stallTimeoutMs,
    hide,
    setStatusMessage,
    formatNos,
  ]);

  const onSelectedRowsChangeGuarded = useCallback(
    (next: Set<string>) => {
      const prev = selectedRows;
      const added = [...next].filter((id) => !prev.has(id));

      const deriveModeFromSet = (s: Set<string>): SelectionMode => {
        const base = s.values().next().value as string | undefined;
        if (!base) return null;
        const st = docsMap.get(base)?.status;
        return st == null
          ? null
          : isStoppedStatus(st)
            ? 'stopped'
            : 'notStopped';
      };

      const currentMode = deriveModeFromSet(prev);
      const mode =
        currentMode ??
        (() => {
          const base = (added[0] ?? next.values().next().value) as
            | string
            | undefined;
          if (!base) return null;
          const st = docsMap.get(base)?.status;
          return st == null
            ? null
            : isStoppedStatus(st)
              ? 'stopped'
              : 'notStopped';
        })();

      if (!mode) {
        setSelectedRows(next);
        return;
      }

      const filtered = new Set(
        [...next].filter((id) => modeMatches(docsMap.get(id)?.status, mode)),
      );
      setSelectedRows(filtered);
    },
    [selectedRows, docsMap, setSelectedRows],
  );

  return {
    stopDialogOpen,
    setStopDialogOpen,
    stopActionLabel,
    selectionMode,
    selectedNos,
    canOpenDialog,
    startStopToggle,
    confirmStopToggle,
    onSelectedRowsChangeGuarded,
  };
}
