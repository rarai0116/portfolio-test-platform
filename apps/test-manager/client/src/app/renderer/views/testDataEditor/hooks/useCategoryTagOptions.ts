import type { BasicSingleCreatableSelectOption } from '@components/organism/basicSingleCreatableSelect';
import type { GradeId, TestSubject } from '@shared/types/contracts';
import * as React from 'react';

type Args = {
  grade: GradeId;
  subject?: TestSubject | '未指定';
  bigCategoryTag?: string;
  firstOptionLabel?: string;
};

export type Result = {
  bigOptions: BasicSingleCreatableSelectOption[];
  smallOptions: BasicSingleCreatableSelectOption[];
  addLocalBigOption: (createdValue: string) => void;
  addLocalSmallOption: (createdValue: string, bigCategoryTag: string) => void;
};

const normalizeKey = (v: string): string => v.trim();

const uniq = (keys: string[]): string[] => {
  const set = new Set<string>();
  for (const k of keys) {
    const v = normalizeKey(k);
    if (v) set.add(v);
  }
  return [...set];
};

const toOptions = (keys: string[]): BasicSingleCreatableSelectOption[] => {
  return uniq(keys).map((k) => ({ value: k, label: k }));
};

export const useCategoryTagOptions = (args: Args): Result => {
  const { grade, subject, bigCategoryTag, firstOptionLabel } = args;

  // DB由来キー
  const [dbBigKeys, setDbBigKeys] = React.useState<string[]>([]);
  const [dbSmallKeys, setDbSmallKeys] = React.useState<string[]>([]);

  // UIで新規追加したキー（保存前でも保持したい）
  const [localBigKeys, setLocalBigKeys] = React.useState<string[]>([]);
  const [localSmallKeysByBig, setLocalSmallKeysByBig] = React.useState<
    Record<string, string[]>
  >({});

  // 学年または学科が変わったらローカル追加分はリセット
  // biome-ignore lint/correctness/useExhaustiveDependencies: grade、subjectの変更でリセットしたい
  React.useEffect(() => {
    setLocalBigKeys([]);
    setLocalSmallKeysByBig({});
  }, [grade, subject]);

  // 大カテゴリ候補（DB）
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      // 学科が未指定なら空配列を戻す
      if (!subject) {
        setDbBigKeys([]);
        return;
      }
      const res = await window.testCategory.getKey(
        grade,
        subject === '未指定' ? undefined : subject,
      );
      if (!res.ok) return;
      if (cancelled) return;
      setDbBigKeys(res.keys);
    })();

    return () => {
      cancelled = true;
    };
  }, [grade, subject]);

  // 小カテゴリ候補（DB）: 現在の大カテゴリに依存
  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      const big = normalizeKey(bigCategoryTag ?? '');
      if (!big) {
        setDbSmallKeys([]);
        return;
      }
      const res = await window.testCategory.getKey(
        grade,
        subject === '未指定' ? undefined : subject,
        big,
      );
      if (!res.ok) return;
      if (cancelled) return;
      setDbSmallKeys(res.keys);
    })();

    return () => {
      cancelled = true;
    };
  }, [grade, subject, bigCategoryTag]);

  const addLocalBigOption = React.useCallback((createdValue: string) => {
    const v = normalizeKey(createdValue);
    if (!v) return;

    setLocalBigKeys((prev) => (prev.includes(v) ? prev : [...prev, v]));
  }, []);

  const addLocalSmallOption = React.useCallback(
    (createdValue: string, parentBig: string) => {
      const v = normalizeKey(createdValue);
      const b = normalizeKey(parentBig);
      if (!v || !b) return;

      setLocalSmallKeysByBig((prev) => {
        const cur = prev[b] ?? [];
        if (cur.includes(v)) return prev;
        return { ...prev, [b]: [...cur, v] };
      });
    },
    [],
  );

  const firstLabel = firstOptionLabel ?? '未指定';

  const bigOptions = React.useMemo(() => {
    // DB + ローカル追加分を常に合成（問題切替しても消えない）
    return toOptions([firstLabel, ...dbBigKeys, ...localBigKeys]);
  }, [dbBigKeys, localBigKeys, firstLabel]);

  const smallOptions = React.useMemo(() => {
    const b = normalizeKey(bigCategoryTag ?? '');
    const localSmall = b ? (localSmallKeysByBig[b] ?? []) : [];
    // DB + ローカル追加分（bigごと）を合成
    return toOptions([firstLabel, ...dbSmallKeys, ...localSmall]);
  }, [dbSmallKeys, localSmallKeysByBig, bigCategoryTag, firstLabel]);

  return {
    bigOptions,
    smallOptions,
    addLocalBigOption,
    addLocalSmallOption,
  };
};
