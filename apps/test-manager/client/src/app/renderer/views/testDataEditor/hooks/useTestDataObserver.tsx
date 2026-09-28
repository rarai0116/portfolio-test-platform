import type { TestData } from '@shared/types/contracts';
import useTestDataStore, {
  type TestDataEntry,
} from '@views/testDataEditor/store/useTestDataStore';
import { useCallback, useEffect, useRef } from 'react';

const toQuillOptimized = (raw: TestData) => {
  return raw;
};

type UseTestDataObserver = {
  // DataList のコンテナに付与する ref（子要素の button[id=問題ID] を監視）
  listRef: React.RefObject<HTMLDivElement | null>;
  testDataMap: Record<string, TestDataEntry>;
  setTestDataMap: (
    updater: (
      prev: Record<string, TestDataEntry>,
    ) => Record<string, TestDataEntry>,
  ) => void;
};

type Props = {
  // 監視対象のIDリスト（通常は selectedDataIdList を渡す）
  idList: string[];
  // 先読み件数（デフォルト5）
  preloadCount?: number;
};

const useTestDataObserver = (props: Props): UseTestDataObserver => {
  const listRef = useRef<HTMLDivElement>(null);
  const { testDataMap, setTestDataMap, isQuillPrepared, setIsQuillPrepared } =
    useTestDataStore();

  // Quill最適化データの準備(仮)
  const ensureQuillPrepared = useCallback(
    (id: string) => {
      const ent = testDataMap[id];
      if (!ent?.raw) return; // raw未取得
      if (isQuillPrepared[id]) return; // 準備済み

      const quill = toQuillOptimized(ent.raw);
      setTestDataMap((prev) => ({
        ...prev,
        [id]: {
          ...(prev[id] ?? { id, status: 'idle' as const }),
          quill,
          status: 'ready',
        },
      }));
      setIsQuillPrepared((prev) => ({ ...prev, [id]: true }));
    },
    [testDataMap, isQuillPrepared, setTestDataMap, setIsQuillPrepared],
  );

  // 事前準備（最初のN件）
  const preLoad = useCallback(() => {
    const n = props.preloadCount ?? 5;
    const preloadIds = props.idList.slice(0, n);
    for (const id of preloadIds) ensureQuillPrepared(id);
  }, [props.idList, props.preloadCount, ensureQuillPrepared]);

  // 初回プレロード
  // biome-ignore lint/correctness/useExhaustiveDependencies: 初回のみのため
  useEffect(() => {
    if (props.idList.length === 0) return;
    preLoad();
  }, []);

  // IntersectionObserverで表示されたIDのQuillを準備
  // biome-ignore lint/correctness/useExhaustiveDependencies: useEffectのため
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;

    const elements = Array.from(
      container.querySelectorAll('button[id]'),
    ) as HTMLElement[];
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const targetId = (entry.target as HTMLElement)?.id;
          if (!targetId) continue;

          if (entry.isIntersecting) {
            ensureQuillPrepared(targetId);
          }
        }
      },
      {
        rootMargin: '300px 0px 300px 0px',
        threshold: 0,
      },
    );

    elements.map((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [props.idList]);

  return { listRef, testDataMap, setTestDataMap };
};

export default useTestDataObserver;
