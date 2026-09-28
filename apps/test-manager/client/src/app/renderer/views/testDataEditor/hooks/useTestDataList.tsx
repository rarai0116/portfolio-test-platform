import {
  useTypedFirestoreHandler,
  type ValidCollectionPath,
} from '@hooks/useTypedFirestoreHandler';
import { buildTestDataDisplayName } from '@renderer/api/testDataDisplayName';
import type { AssetData, TestData } from '@shared/types/contracts';
import {
  buildPastExamDuplicateIndex,
  type PastExamDuplicateEntry,
} from '@views/testDataEditor/api/pastExamDuplicate';
import useSaveActionsStore from '@views/testDataEditor/store/useSaveActionsStore';
import useSelectedDataDisplayStore from '@views/testDataEditor/store/useSelectedDataDisplayStore';
import useTestDataStore, {
  type TestDataEntry,
} from '@views/testDataEditor/store/useTestDataStore';
import { useEffect, useMemo } from 'react';

// Firestoreのドキュメントをストア用エントリに整形
const docToEntry = (d: {
  path: string;
  data?: TestData | AssetData | null;
}): TestDataEntry => {
  const id = d.path.split('/').pop() ?? '';
  const raw = (d.data ?? undefined) as TestData | undefined;
  return {
    id,
    raw,
    status: 'ready',
  };
};
type TestDataListProps = {
  selectedDataIdList: string[];
  grade: string;
};

const useTestDataList = (props: TestDataListProps) => {
  const collectionPath = useMemo(
    () => props.grade as ValidCollectionPath,
    [props.grade],
  );
  const h = useTypedFirestoreHandler(collectionPath, {
    autoSubscribe: true,
    excludeSelfCommittedFromStamp: true,
  });
  const { setSave, clearSave } = useSaveActionsStore();
  const updateDisplayEntry = useSelectedDataDisplayStore(
    (state) => state.updateDisplayEntry,
  );
  const selectedDataIdList = props.selectedDataIdList;
  const { setTestDataMap, setPastExamDuplicateIndex, pruneExcept } =
    useTestDataStore();
  const selectedPathSet = useMemo(() => {
    return new Set(selectedDataIdList.map((id) => `${collectionPath}/${id}`));
  }, [collectionPath, selectedDataIdList]);
  const committedSelectedTokens = useMemo(() => {
    const next: Record<string, string> = {};

    for (const doc of h.committedDocs) {
      if (!selectedPathSet.has(doc.path)) continue;

      const id = doc.path.split('/').pop() ?? '';
      next[id] = `${doc.updateTime.seconds}:${doc.updateTime.nanos}`;
    }

    return next;
  }, [h.committedDocs, selectedPathSet]);

  // 保存関数をストアにセット
  // biome-ignore lint/correctness/useExhaustiveDependencies: setSaveとclearSaveは不変のため
  useEffect(() => {
    const save = async (req: { id: string; patch: Partial<TestData> }) => {
      const path = `${collectionPath}/${req.id}`;
      try {
        await h.update(path, req.patch);
        return { ok: true };
      } catch (e) {
        console.error('save error', e);
        return {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    };
    setSave(save);
    return () => clearSave();
  }, [collectionPath]);

  // Firestore購読結果から、選択されたIDのみストアに反映
  // biome-ignore lint/correctness/useExhaustiveDependencies: useEffectのため
  useEffect(() => {
    console.log('useTestDataList: updating store with selected IDs', {
      docs: h.docs,
      selectedDataIdList,
    });
    const duplicateIndex = Array.isArray(h.docs)
      ? buildPastExamDuplicateIndex(
          h.docs.reduce<PastExamDuplicateEntry[]>((accumulator, doc) => {
            const data = doc.data as TestData | undefined;
            if (!data) return accumulator;

            accumulator.push({
              id: doc.path.split('/').pop() ?? '',
              data,
            });
            return accumulator;
          }, []),
        )
      : buildPastExamDuplicateIndex([]);
    setPastExamDuplicateIndex(duplicateIndex);

    if (!Array.isArray(h.docs) || selectedDataIdList.length === 0) {
      // 選択が空の場合はストアからも空に近づける（全削除）
      pruneExcept([]);
      return;
    }

    const targetDocs = h.docs.filter((d) => selectedPathSet.has(d.path));

    if (targetDocs.length === 0) {
      // ストアの掃除のみ実施
      pruneExcept(selectedDataIdList);
      return;
    }

    for (const doc of targetDocs) {
      const id = doc.path.split('/').pop() ?? '';
      const data = doc.data as TestData | undefined;
      if (!data) continue;

      updateDisplayEntry(id, {
        name: buildTestDataDisplayName(data),
        status: data.status,
      });
    }

    const entries = targetDocs.map(docToEntry);
    console.log('useTestDataList: derived entries', entries);
    setTestDataMap((prev) => {
      const next = { ...prev };
      for (const ent of entries) {
        const cur = next[ent.id];
        next[ent.id] = {
          id: ent.id,
          raw: ent.raw ?? cur?.raw,
          status: cur?.status ?? 'idle',
          error: cur?.error,
        };
      }
      console.log('useTestDataList: updated store entries', next);
      return next;
    });

    // 未選択のエントリは削除
    pruneExcept(selectedDataIdList);
  }, [
    collectionPath,
    h.docs,
    pruneExcept,
    selectedDataIdList,
    selectedPathSet,
    setPastExamDuplicateIndex,
    setTestDataMap,
    updateDisplayEntry,
  ]);

  // UI向けに、現在のロード状態等を返す（必要に応じて拡張）
  return {
    docs: h.docs,
    committedSelectedTokens,
    isSubscribed: h.isSubscribed,
    loading: h.loading,
    error: h.error,
  };
};

export default useTestDataList;
