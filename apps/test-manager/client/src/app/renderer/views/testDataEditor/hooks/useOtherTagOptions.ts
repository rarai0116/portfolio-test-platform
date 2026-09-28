import type { BasicSingleCreatableSelectOption } from '@components/organism/basicSingleCreatableSelect';
import type { GradeId } from '@shared/types/contracts';
import * as React from 'react';

type Args = {
  grade: GradeId;
};

export type Result = {
  options: BasicSingleCreatableSelectOption[];
  addLocalOption: (createdValue: string) => void;
};

const normalizeKey = (value: string): string => value.trim();

const uniq = (keys: string[]): string[] => {
  const set = new Set<string>();

  for (const key of keys) {
    const normalized = normalizeKey(key);
    if (!normalized) continue;
    set.add(normalized);
  }

  return [...set];
};

const toOptions = (keys: string[]): BasicSingleCreatableSelectOption[] => {
  return uniq(keys).map((key) => ({
    value: key,
    label: key,
  }));
};

export const useOtherTagOptions = ({ grade }: Args): Result => {
  const [dbKeys, setDbKeys] = React.useState<string[]>([]);
  const [localKeys, setLocalKeys] = React.useState<string[]>([]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: grade変更時にローカル候補をリセットしたい
  React.useEffect(() => {
    setLocalKeys([]);
  }, [grade]);

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      const res = await window.testCategory.getOtherTagKeys({ grade });
      if (!res.ok) return;
      if (cancelled) return;
      setDbKeys(res.keys);
    })();

    return () => {
      cancelled = true;
    };
  }, [grade]);

  const addLocalOption = React.useCallback((createdValue: string) => {
    const normalized = normalizeKey(createdValue);
    if (!normalized) return;

    setLocalKeys((prev) =>
      prev.includes(normalized) ? prev : [...prev, normalized],
    );
  }, []);

  const options = React.useMemo(() => {
    return toOptions([...dbKeys, ...localKeys]);
  }, [dbKeys, localKeys]);

  return {
    options,
    addLocalOption,
  };
};
