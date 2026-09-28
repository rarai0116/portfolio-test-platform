import { waitOutboxSettled } from '@renderer/api/waitOutboxSettled';
import { useGlobalLoading } from '@renderer/hooks/useGlobalLoading';
import {
  buildFirestorePatchFromCsvV1,
  parseTestDataCsvV1Bytes,
  stringifyTestDataCsvV1Bytes,
  validateCsvImportBytesFormat,
} from '@shared/services/testDataCsv';
import type {
  GradeId,
  TestData,
  TestSubject,
  Version,
} from '@shared/types/contracts';
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useMemo,
  useState,
} from 'react';

import type { BusyKind } from '../index';

type ImportMode = 'normal' | 'force';

type ImportPlanItem = {
  kind: 'update' | 'create';
  key: string;
  no: number;
  data: Partial<TestData>;
};

type DocPathParts = {
  collectionPath: string;
  docId: string;
};

const makeMutationId = () =>
  `t_csv_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const parseDocPath = (path: string): DocPathParts | null => {
  const segments = path.split('/').filter(Boolean);
  if (segments.length < 2 || segments.length % 2 !== 0) return null;

  const docId = segments.at(-1);
  const collectionPath = segments.slice(0, -1).join('/');
  if (!docId || !collectionPath) return null;

  return { collectionPath, docId };
};

const groupDocIdsByCollection = (paths: string[]) => {
  const grouped = new Map<string, Set<string>>();

  for (const path of paths) {
    const parsed = parseDocPath(path);
    if (!parsed) continue;

    const docIds = grouped.get(parsed.collectionPath) ?? new Set<string>();
    docIds.add(parsed.docId);
    grouped.set(parsed.collectionPath, docIds);
  }

  return [...grouped.entries()].map(([collectionPath, docIds]) => ({
    collectionPath,
    docIds: [...docIds].sort(),
  }));
};

const parseIntStrictCell = (s: string): number | null => {
  if (!/^-?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
};

const hasAllImmutableForCreate = (row: {
  grade: string;
  no: string;
  testNo: string;
  subject: string;
}) => {
  return (
    row.grade.trim() !== '' &&
    row.no.trim() !== '' &&
    row.testNo.trim() !== '' &&
    row.subject.trim() !== ''
  );
};

const isSameValue = (a: unknown, b: unknown) => {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const _a = a[i] === null ? '' : a[i];
      const _b = b[i] === null ? '' : b[i];
      // nullの場合は空文字列と同等とみなす（CSVのセルで空はnull扱いのため）
      if (_a !== _b) {
        console.log('Array values differ at index', i, ':', _a, '!==', _b);
        return false;
      }
    }
    return true;
  }
  const _a = a === null ? '' : a;
  const _b = b === null ? '' : b;
  // nullの場合は空文字列と同等とみなす（CSVのセルで空はnull扱いのため）
  return _a === _b;
};

const filterUnchangedPatch = (existing: TestData, patch: Partial<TestData>) => {
  const out: Partial<TestData> = {};
  for (const [k, v] of Object.entries(patch)) {
    const prev = (existing as Record<string, unknown>)[k];
    if (!isSameValue(prev, v)) {
      console.log('Value changed for key', k, ':', prev, '->', v);
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
};

type Props = {
  docs: { path: string; data?: TestData; updateTime: Version }[];
  setStatusMessage: Dispatch<SetStateAction<string>>;
  selectedRows: Set<string>;
  grade: GradeId;
  unsubscribe: () => Promise<void>;
  subscribe: () => Promise<void>;
  refresh: () => Promise<void>;
  busy: BusyKind;
  setBusy: Dispatch<SetStateAction<BusyKind>>;
};

export const useCsvIo = ({
  docs,
  setStatusMessage,
  selectedRows,
  grade,
  unsubscribe,
  subscribe,
  refresh,
  busy,
  setBusy,
}: Props) => {
  //  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFormatErrorDialogOpen, setImportFormatErrorDialogOpen] =
    useState(false);
  const [importFormatErrorMessage, setImportFormatErrorMessage] = useState('');
  const [importPlan, setImportPlan] = useState<ImportPlanItem[]>([]);
  const [importSummary, setImportSummary] = useState<{
    changedNos: number[];
    newNos: number[];
    skippedCount: number;
  } | null>(null);

  const { show, hide, setMessage } = useGlobalLoading();

  // docs から path -> TestData のMapを作る（エクスポート/インポートで参照）
  const docsMap = useMemo(() => {
    const m = new Map<string, TestData>();
    for (const d of docs) {
      if (d.data) m.set(d.path, d.data);
    }
    return m;
  }, [docs]);

  const handleExportCsv = useCallback(async () => {
    if (busy) return;
    if (!('csvFile' in window)) {
      setStatusMessage('csvFile API が見つかりません（preload未反映の可能性）');
      return;
    }

    setBusy('export');
    try {
      const keys = Array.from(selectedRows);
      const items = keys
        .map((key) => {
          const data = docsMap.get(key);
          return data ? { key, data } : null;
        })
        .filter((v): v is { key: string; data: TestData } => v !== null);

      if (items.length === 0) {
        setStatusMessage('エクスポート対象のデータが見つかりません');
        return;
      }

      // noを昇順にソート（選択順は保持しない）
      const sortedItems = items.sort((a, b) => {
        const noA = a.data.no;
        const noB = b.data.no;
        return noA - noB;
      });
      console.log('Exporting items (sorted by no):', sortedItems);

      const bytes = stringifyTestDataCsvV1Bytes(sortedItems);
      console.log('Generated CSV bytes:', bytes);
      const suggestedName = `testData_${grade}_${sortedItems.length}.csv`;

      const res = await window.csvFile.saveCsv(bytes, suggestedName);
      if (!res.ok) {
        setStatusMessage(res.error);
        return;
      }

      setStatusMessage(`CSVを保存しました（${sortedItems.length}件）`);
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [busy, docsMap, grade, selectedRows, setStatusMessage, setBusy]);

  // CSVインポート
  const handleImportCsv = useCallback(
    async (mode: ImportMode) => {
      const force = mode === 'force';

      if (busy) return;
      if (!('csvFile' in window)) {
        setStatusMessage(
          'csvFile API が見つかりません（preload未反映の可能性）',
        );
        return;
      }
      if (!('fs' in window)) {
        setStatusMessage(
          'Firestore API が見つかりません（preload未反映の可能性）',
        );
        return;
      }

      setBusy('import');
      try {
        const opened = await window.csvFile.openCsv();
        if (!opened.ok) {
          setStatusMessage(opened.error);
          return;
        }

        const formatValidation = validateCsvImportBytesFormat(opened.bytes);
        if (!formatValidation.ok) {
          setImportFormatErrorMessage(formatValidation.message);
          setImportFormatErrorDialogOpen(true);
          setStatusMessage(formatValidation.message);
          return;
        }

        const parsed = parseTestDataCsvV1Bytes(opened.bytes);

        const fatal = parsed.errors.filter((e) => e.rowIndex1 === 0);
        if (fatal.length > 0) {
          setStatusMessage(fatal.map((e) => e.message).join(' / '));
          return;
        }

        const plan: ImportPlanItem[] = [];
        const changedNos: number[] = [];
        const newNos: number[] = [];

        for (const row of parsed.rows) {
          const key = row.key;

          // v1は既存doc更新専用。存在しない key はスキップ（新規は今回は実装しない）
          const existing = docsMap.get(key);
          if (!existing) {
            if (!force) continue;

            // 「更新不可プロパティが全て空でない場合に限る」
            if (!hasAllImmutableForCreate(row)) continue;

            const gradeNum = parseIntStrictCell(row.grade);
            const noNum = parseIntStrictCell(row.no);
            if (gradeNum === null || noNum === null) continue;

            // buildFirestorePatchFromCsvV1 の共通ロジック（型変換/overlimit除外）を再利用するための疑似 existing
            const syntheticExisting = {
              grade: gradeNum,
              no: noNum,
              testNo: row.testNo,
              subject: row.subject,
            } as unknown as TestData;

            const patch = buildFirestorePatchFromCsvV1({
              row,
              existing: syntheticExisting,
            });
            if (!patch.ok) continue;

            // 新規作成時は immutable も含めて set する（要件）
            const createData: Partial<TestData> = {
              ...patch.data,
              grade: gradeNum,
              no: noNum,
              testNo: row.testNo,
              subject: row.subject as TestSubject,
            };

            plan.push({ kind: 'create', key, no: noNum, data: createData });
            newNos.push(noNum);
            continue;
          }

          const patch = buildFirestorePatchFromCsvV1({ row, existing });
          if (!patch.ok) continue;

          const nextData = force
            ? patch.data
            : filterUnchangedPatch(existing, patch.data);

          // 通常: 差分ゼロはスキップ / 強制: 差分ゼロでも投入（全件強制更新）
          if (!force && Object.keys(nextData).length === 0) continue;

          const no = Number(row.no);
          plan.push({ kind: 'update', key, no, data: nextData });
          if (Number.isFinite(no)) changedNos.push(no);
        }

        if (plan.length === 0) {
          setStatusMessage('変更対象が見つかりません');
          return;
        }

        setImportPlan(plan);
        setImportSummary({
          changedNos,
          newNos,
          skippedCount: parsed.rows.length - plan.length,
        });
        setImportDialogOpen(true);
        setStatusMessage(
          force
            ? `強制インポート確認: 対象=${plan.length}件（「はい」で反映）`
            : `インポート確認: 変更=${plan.length}件（「はい」で反映）`,
        );
      } catch (e) {
        setStatusMessage(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [busy, docsMap, setStatusMessage, setBusy],
  );

  const startImport = useCallback(async () => {
    if (!('fs' in window)) return;

    const loadingId = show('CSVインポート中…');
    setImportDialogOpen(false);
    setBusy('import');

    try {
      setStatusMessage('インポート準備中…（一覧購読を一時停止しています）');
      await unsubscribe(); // ここで listenQuery を止める

      setStatusMessage('インポート中…（Outboxへ投入しています）');

      const mutationIds: string[] = [];
      const mutationIdToPath = new Map<string, string>();
      for (const it of importPlan) {
        const mutationId = makeMutationId();
        mutationIds.push(mutationId);
        mutationIdToPath.set(mutationId, it.key);

        await window.fs.mutate({
          mutationId,
          kind: 'set',
          path: it.key,
          data: it.data,
        });

        setMessage(
          loadingId,
          `インポート中…（Outboxへ投入しています）: ${mutationIds.length}/${importPlan.length}件完了`,
        );

        await sleep(40);
      }
      setStatusMessage(
        `Outbox投入完了: ${mutationIds.length}/${importPlan.length}件。反映待ち…`,
      );
      setMessage(
        loadingId,
        `インポート中…（Outbox投入完了: ${mutationIds.length}/${importPlan.length}件。反映待ち…）`,
      );

      const settled = await waitOutboxSettled(mutationIds, 30_000, (message) =>
        setMessage(loadingId, message),
      );
      if (!settled.ok && settled.timeout) {
        setStatusMessage(
          `反映待ちがタイムアウトしました（Outboxで状況を確認してください）: 投入=${mutationIds.length}/${importPlan.length}件`,
        );
        return;
      }

      const committedPaths = mutationIds
        .filter((mutationId) => !settled.failedMutationIds.includes(mutationId))
        .map((mutationId) => mutationIdToPath.get(mutationId))
        .filter((path): path is string => typeof path === 'string');

      let cacheIndexSyncMessage = '';
      if (committedPaths.length > 0) {
        const syncTargets = groupDocIdsByCollection(committedPaths);
        setStatusMessage('cacheIndex同期中…');
        setMessage(
          loadingId,
          `cacheIndex同期中…（対象=${committedPaths.length}件）`,
        );

        const syncResults = await Promise.all(
          syncTargets.map((target) => window.fs.syncCacheIndexEntries(target)),
        );

        const syncedDocCount = syncResults.reduce(
          (total, result) => total + result.syncedDocCount,
          0,
        );
        const touchedShardCount = syncResults.reduce(
          (total, result) => total + result.touchedShardCount,
          0,
        );

        cacheIndexSyncMessage = `cacheIndex同期=${syncedDocCount}件/${touchedShardCount}shard`;
      }

      const skippedPart = ` / skipped=${importSummary?.skippedCount ? importSummary?.skippedCount : 0}件`;

      setStatusMessage(
        `インポート完了: committed=${settled.committed}件 / failed=${settled.failed}件${skippedPart}${cacheIndexSyncMessage ? ` / ${cacheIndexSyncMessage}` : ''}`,
      );

      if (settled.failed > 0) {
        setStatusMessage(
          `インポート完了: committed=${settled.committed}件 / failed=${settled.failed}件${skippedPart}${cacheIndexSyncMessage ? ` / ${cacheIndexSyncMessage}` : ''}。失敗があるため自動再読込は行いません`,
        );
        return;
      }

      // 反映後にリフレッシュ（失敗が多い場合は好みで条件分岐してもOK）
      await refresh();
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : String(e));
    } finally {
      subscribe();
      setBusy(null);
      setImportPlan([]);
      setImportSummary(null);
      hide(loadingId);
    }
  }, [
    importPlan,
    importSummary,
    show,
    hide,
    unsubscribe,
    subscribe,
    refresh,
    setStatusMessage,
    setMessage,
    setBusy,
  ]);

  return {
    busy,
    importPlan,
    setImportPlan,
    importSummary,
    setImportSummary,
    importDialogOpen,
    importFormatErrorDialogOpen,
    importFormatErrorMessage,
    setImportDialogOpen,
    setImportFormatErrorDialogOpen,
    handleExportCsv,
    handleImportCsv,
    startImport,
  };
};
