import { useTypedFirestoreHandler } from '@hooks/useTypedFirestoreHandler';
import { buildTestDataDisplayName } from '@renderer/api/testDataDisplayName';
import { waitOutboxSettled } from '@renderer/api/waitOutboxSettled';
import { useGlobalLoading } from '@renderer/hooks/useGlobalLoading';
import type { GradeId, TestData, Version } from '@shared/types/contracts';
import { deriveTestDataStatusAfterResume } from '@views/testDataEditor/api/testDataUtils';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import type { BusyKind } from '../index';

type CreateMode = 'new' | 'copy' | null;

type Props = {
  docs: { path: string; data?: TestData; updateTime: Version }[];
  grade: GradeId;
  selectedRows: Set<string>;

  busy: BusyKind;
  setBusy: (next: BusyKind) => void;
  setStatusMessage: (message: string) => void;

  formatNos: (nos: number[]) => string;
  stallTimeoutMs?: number;
};

type CreatePlanItem = {
  no: number;
  path: string;
  data: Partial<TestData>;
};

const toGradeNumber = (grade: GradeId): 0 | 1 =>
  grade === 'firstGrade' ? 0 : 1;

// 新規作成時の初期データ生成
const buildEmptyOriginalTestData = (
  no: number,
  grade: GradeId,
): Partial<TestData> => ({
  no,
  grade: toGradeNumber(grade),
  isOriginal: true,
  calibrationCheck: false,
  status: deriveTestDataStatusAfterResume({
    autoCheckOk: false,
    calibrationCheck: false,
  }),
  active: true,

  answerNumber: '',
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
  difficult: '',
  isConvertibleQaa: false,
  isNegativeAnswer: false,
  nengo: '',
  parentNo: 0,
  smallCategoryTag: '',
  subject: '学科Ⅰ',
  testNo: '',
  text: '',
  themeTag: '',
  year: '',
  autoCheck: false,
  answerEditorType: 'normal',
  questionEditorType: 'normal',
});

// コピー作成時の固定上書き込みデータ生成
const buildCopiedOriginalTestData = (
  source: TestData,
  no: number,
  grade: GradeId,
): Partial<TestData> => {
  const { id: _omitId, updatedAt: _omitUpdatedAt, ...rest } = source;

  return {
    answerEditorType: 'normal',
    questionEditorType: 'normal',
    ...rest,
    no,
    grade: toGradeNumber(grade),
    isOriginal: true,
    calibrationCheck: false,
    status: deriveTestDataStatusAfterResume({
      autoCheckOk: rest.autoCheck === true,
      calibrationCheck: false,
    }),
    active: true,
  };
};

export function useOriginalTestDataCreate({
  docs,
  grade,
  selectedRows,
  busy,
  setBusy,
  setStatusMessage,
  formatNos,
  stallTimeoutMs = 60_000,
}: Props) {
  const navigate = useNavigate();
  const { show, hide, setMessage } = useGlobalLoading();
  const { createAtPath } = useTypedFirestoreHandler(grade, {
    autoSubscribe: false,
  });

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>(null);
  const [createTargetNos, setCreateTargetNos] = useState<number[]>([]);
  const [createSourceNos, setCreateSourceNos] = useState<number[]>([]);

  const docsMap = useMemo(() => {
    const m = new Map<string, TestData>();
    for (const d of docs) {
      if (d.data) m.set(d.path, d.data);
    }
    return m;
  }, [docs]);

  const maxNo = useMemo(() => {
    const nos = docs
      .map((doc) => doc.data?.no)
      .filter((no): no is number => typeof no === 'number')
      .toSorted((a, b) => b - a);

    return nos[0] ?? 0;
  }, [docs]);

  const selectedSourceEntries = useMemo(() => {
    return Array.from(selectedRows)
      .map((path) => {
        const data = docsMap.get(path);
        if (!data || typeof data.no !== 'number') return null;
        return {
          path,
          no: data.no,
          data,
        };
      })
      .filter(
        (
          item,
        ): item is {
          path: string;
          no: number;
          data: TestData;
        } => item !== null,
      )
      .toSorted((a, b) => a.no - b.no);
  }, [selectedRows, docsMap]);

  // ダイアログを開く直前に採番結果を確定する
  const startCreateDialog = useCallback(() => {
    if (busy !== null) return;

    if (selectedSourceEntries.length === 0) {
      const newNo = maxNo + 1;
      setCreateMode('new');
      setCreateTargetNos([newNo]);
      setCreateSourceNos([]);
      setCreateDialogOpen(true);
      return;
    }

    const targetNos = selectedSourceEntries.map(
      (_, index) => maxNo + index + 1,
    );
    const sourceNos = selectedSourceEntries.map((item) => item.no);

    setCreateMode('copy');
    setCreateTargetNos(targetNos);
    setCreateSourceNos(sourceNos);
    setCreateDialogOpen(true);
  }, [busy, selectedSourceEntries, maxNo]);

  // mode と採番結果から create plan を組み立てる
  const createPlan = useMemo<CreatePlanItem[]>(() => {
    if (createMode === 'new') {
      const no = createTargetNos[0];
      if (typeof no !== 'number') return [];
      return [
        {
          no,
          path: `${grade}/${no}`,
          data: buildEmptyOriginalTestData(no, grade),
        },
      ];
    }

    if (createMode === 'copy') {
      return selectedSourceEntries.map((source, index) => {
        const no = createTargetNos[index];
        return {
          no,
          path: `${grade}/${no}`,
          data: buildCopiedOriginalTestData(source.data, no, grade),
        };
      });
    }

    return [];
  }, [createMode, createTargetNos, selectedSourceEntries, grade]);

  const confirmCreate = useCallback(async () => {
    if (busy !== null) return;
    if (createMode === null) return;
    if (createPlan.length === 0) {
      setStatusMessage('作成対象データが見つかりませんでした');
      return;
    }

    setCreateDialogOpen(false);
    setBusy('createOriginal');

    const actionLabel =
      createMode === 'new' ? 'オリジナル問題を作成中…' : 'コピーして作成中…';
    const loadingId = show(actionLabel);

    try {
      const mutationIds: string[] = [];
      const mutationIdToNo = new Map<string, number>();
      const enqueueFailedNos: number[] = [];

      for (let i = 0; i < createPlan.length; i++) {
        const item = createPlan[i];

        try {
          const mutationId = await createAtPath(item.path, item.data);
          mutationIds.push(mutationId);
          mutationIdToNo.set(mutationId, item.no);
        } catch (_e) {
          enqueueFailedNos.push(item.no);
        }

        setMessage(loadingId, `${actionLabel} ${i + 1}/${createPlan.length}件`);
      }

      if (mutationIds.length === 0) {
        setStatusMessage('オリジナル問題の作成に失敗しました');
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
          '作成結果の確認に失敗しました。一覧を再読込して状態を確認してください。' +
            (failedNos.length ? `\n失敗No:\n${formatNos(failedNos)}` : ''),
        );
        return;
      }

      const failedNoSet = new Set(failedNos);
      const createdNos = createPlan
        .map((item) => item.no)
        .filter((no) => !failedNoSet.has(no));

      if (failedNos.length > 0) {
        setStatusMessage(
          `一部のオリジナル問題を作成しました（成功=${createdNos.length}件 / 失敗=${failedNos.length}件）\n` +
            `失敗No:\n${formatNos(failedNos)}`,
        );
      } else {
        setStatusMessage(
          `オリジナル問題を作成しました（${createdNos.length}件）`,
        );
      }

      if (createdNos.length > 0) {
        navigate('/testDataEditor', {
          state: {
            grade,
            idList: createPlan
              .filter((item) => !failedNoSet.has(item.no))
              .map((item) => ({
                no: item.no,
                name: buildTestDataDisplayName(item.data as TestData),
                status: item.data.status as TestData['status'],
              })),
          },
        });
      }
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      hide(loadingId);
    }
  }, [
    busy,
    createMode,
    createPlan,
    createAtPath,
    stallTimeoutMs,
    setMessage,
    setStatusMessage,
    formatNos,
    setBusy,
    show,
    hide,
    navigate,
    grade,
  ]);

  return {
    createDialogOpen,
    setCreateDialogOpen,
    createMode,
    createTargetNos,
    createSourceNos,
    startCreateDialog,
    confirmCreate,
  };
}
