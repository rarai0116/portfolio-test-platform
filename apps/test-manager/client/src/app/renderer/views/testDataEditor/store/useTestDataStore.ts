import type { Delta } from '@renderer/types/quillType';
import type { TestData } from '@shared/types/contracts';
import {
  createEmptyPastExamDuplicateIndex,
  type PastExamDuplicateIndex,
} from '@views/testDataEditor/api/pastExamDuplicate';
import {
  applyCommonRulesToTestData,
  applyEditorRuntimeRulesToHtml,
  HTML_FIELD_SET,
  type HTML_FIELDS,
  normalizeEditorTypesInTestData,
} from '@views/testDataEditor/api/testDataUtils';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
export type QuillOptimizedTestData = {
  // 必要に応じて拡張。今は代表的な項目のみ。
  question?: Delta;
  choices?: Array<Delta | undefined>; // 1〜5
  old?: Delta;
  answerBody?: Delta;
  answers?: Array<Delta | undefined>; // 1〜5
};

export type TestDataEntry = {
  id: string;
  // Firestore取得そのまま（raw）
  raw?: TestData;
  status: 'idle' | 'loading' | 'ready' | 'failed' | 'uploading';
  error?: string;
};

// Store 型
export type EditDataEntry = {
  id: string;
  data: TestData; // 「画像未埋め込み（デコード済み）」の編集ソース
  updatedAtMs: number;
};

const buildEditEntriesFromTestData = (args: {
  idList: string[];
  testDataMap: Record<string, TestDataEntry>;
}): Record<string, EditDataEntry> => {
  const { idList, testDataMap } = args;
  const fresh: Record<string, EditDataEntry> = {};

  idList.forEach((id) => {
    const src = testDataMap[id];
    const base = src?.raw;
    if (!base) return;

    const [normalized] = normalizeEditorTypesInTestData({
      ...base,
    });

    const decoded = applyCommonRulesToTestData(normalized, {
      boundary: 'load',
      itemId: id,
    });

    fresh[id] = {
      id,
      data: decoded,
      updatedAtMs: Date.now(),
    };
  });

  return fresh;
};

type State = {
  testDataMap: Record<string, TestDataEntry>;
  pastExamDuplicateIndex: PastExamDuplicateIndex;
  setTestDataMap: (
    updater: (
      prev: Record<string, TestDataEntry>,
    ) => Record<string, TestDataEntry>,
  ) => void;
  setPastExamDuplicateIndex: (index: PastExamDuplicateIndex) => void;

  // Quill準備済みフラグ
  isQuillPrepared: Record<string, boolean>;
  setIsQuillPrepared: (
    updater: (prev: Record<string, boolean>) => Record<string, boolean>,
  ) => void;

  // 未選択IDの削除
  pruneExcept: (ids: string[]) => void;
  // id -> 編集データ
  editMap: Record<string, EditDataEntry>;

  // 初期化: 既存データを破棄し、指定IDの testDataMap からコピー（画像未埋め込みに変換）
  initializeFromTestData: (args: {
    idList: string[];
    testDataMap: Record<string, TestDataEntry>;
    isOverWritten?: boolean;
  }) => Record<string, EditDataEntry>;

  mergeFromTestData: (args: {
    idList: string[];
    testDataMap: Record<string, TestDataEntry>;
  }) => Record<string, EditDataEntry>;

  // Quillからの編集結果（HTML）を受け取り、デコードして編集データへ反映
  applyQuillHtml: (
    id: string,
    patch: Partial<Pick<TestData, (typeof HTML_FIELDS)[number]>>,
  ) => EditDataEntry | undefined;

  // 任意フィールドの部分更新（メタ情報も含む）
  applyEditPatch: (
    id: string,
    patch: Partial<TestData>,
  ) => TestData | undefined;

  // 任意更新
  updateBy: (
    id: string,
    updater: (prev: EditDataEntry | undefined) => EditDataEntry | undefined,
  ) => void;

  // 全消去
  clearEditMap: () => void;
};

// 永続化キー
const STORE_KEY = 'tde:edit-data:v1';

const useTestDataStore = create<State>()(
  persist(
    (set) => ({
      testDataMap: {},
      pastExamDuplicateIndex: createEmptyPastExamDuplicateIndex(),
      setTestDataMap: (updater) =>
        set((prev) => {
          const nextMap = updater(prev.testDataMap);
          const normalized: Record<string, TestDataEntry> = {};

          for (const [id, entry] of Object.entries(nextMap)) {
            normalized[id] = {
              ...entry,
              raw: entry.raw
                ? applyCommonRulesToTestData(entry.raw, {
                    boundary: 'load',
                    itemId: id,
                  })
                : undefined,
            };
          }

          return { testDataMap: normalized };
        }),
      setPastExamDuplicateIndex: (index) =>
        set({ pastExamDuplicateIndex: index }),

      isQuillPrepared: {},
      setIsQuillPrepared: (updater) =>
        set((prev) => ({ isQuillPrepared: updater(prev.isQuillPrepared) })),

      pruneExcept: (ids) =>
        set((prev) => {
          const keep = new Set(ids);
          const next: Record<string, TestDataEntry> = {};
          for (const [k, v] of Object.entries(prev.testDataMap)) {
            if (keep.has(k)) next[k] = v;
          }
          const nextPrepared: Record<string, boolean> = {};
          for (const [k, v] of Object.entries(prev.isQuillPrepared)) {
            if (keep.has(k)) nextPrepared[k] = v;
          }
          return { testDataMap: next, isQuillPrepared: nextPrepared };
        }),
      editMap: {},
      initializeFromTestData: ({ idList, testDataMap, isOverWritten }) => {
        console.log('Initializing from test data with IDs:', idList);
        const fresh = buildEditEntriesFromTestData({
          idList,
          testDataMap,
        });

        Object.entries(fresh).forEach(([id, entry]) => {
          console.log('Decoded data for ID:', id, entry.data);
        });

        set((prev) => {
          return {
            editMap: {
              ...fresh,
              ...(isOverWritten ? {} : prev.editMap),
            },
          };
        });

        return fresh;
      },

      mergeFromTestData: ({ idList, testDataMap }) => {
        const fresh = buildEditEntriesFromTestData({
          idList,
          testDataMap,
        });

        set((prev) => ({
          editMap: {
            ...prev.editMap,
            ...fresh,
          },
        }));

        return fresh;
      },

      applyQuillHtml: (id, patch) => {
        if (!id) return;
        console.log('Applying Quill HTML patch for ID:', id, patch);
        let next: EditDataEntry | undefined;
        set((prev) => {
          const cur = prev.editMap[id];
          if (!cur) return { editMap: prev.editMap };

          // パッチの各HTMLをデコードして反映
          const decodedPatch: Partial<TestData> = {};
          for (const [k, v] of Object.entries(patch)) {
            if (typeof v === 'string') {
              decodedPatch[k as keyof TestData] = applyEditorRuntimeRulesToHtml(
                v,
                {
                  itemId: id,
                  fieldName: k,
                },
              );
            }
          }

          next = {
            id,
            data: { ...cur.data, ...decodedPatch },
            updatedAtMs: Date.now(),
          };
          return { editMap: { ...prev.editMap, [id]: next } };
        });
        return next;
      },
      applyEditPatch: (id, patch) => {
        if (!id) return;
        console.log('Applying edit patch for ID:', id);
        let nextData: TestData | undefined;
        set((prev) => {
          const cur = prev.editMap[id];
          if (!cur) return { editMap: prev.editMap };

          nextData = { ...cur.data };
          for (const [k, v] of Object.entries(patch)) {
            const key = k as keyof TestData;
            if (HTML_FIELD_SET.has(key) && typeof v === 'string') {
              nextData[key] = applyEditorRuntimeRulesToHtml(v, {
                itemId: id,
                fieldName: k,
              });
            } else {
              // 数値/文字列/真偽値/配列などをそのまま反映
              nextData[key] = v;
            }
          }

          const next: EditDataEntry = {
            id,
            data: nextData,
            updatedAtMs: Date.now(),
          };
          return { editMap: { ...prev.editMap, [id]: next } };
        });
        return nextData;
      },

      updateBy: (id, updater) => {
        set((prev) => {
          const next = updater(prev.editMap[id]);
          if (!next) {
            // undefined を返した場合は削除扱い
            const { [id]: _omit, ...rest } = prev.editMap;
            return { editMap: rest };
          }
          return { editMap: { ...prev.editMap, [id]: next } };
        });
      },

      clearEditMap: () => set({ editMap: {} }),
    }),
    {
      name: STORE_KEY,
      version: 1,
      storage: createJSONStorage(() => window.localStorage),
      // 大きな base64 を持たない構造なのでそのまま保存
      partialize: (s) => ({ editMap: s.editMap }),
      migrate: (persisted, version) => {
        if (!persisted) return { editMap: {} };
        if (version === 1) return persisted as State;
        // それ以外のバージョン移行は現時点なし
        // biome-ignore lint/suspicious/noExplicitAny:　localstorageからのデータのため型指定できないから
        return { editMap: (persisted as any).editMap ?? {} } as State;
      },
    },
  ),
);

export default useTestDataStore;
