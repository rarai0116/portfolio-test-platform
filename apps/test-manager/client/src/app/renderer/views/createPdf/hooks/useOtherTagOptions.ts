import type { BasicSingleCreatableSelectOption } from '@components/organism/basicSingleCreatableSelect';
import { useEffect, useMemo, useState } from 'react';

type Args = {
  grade: 1 | 2;
};

export type Result = {
  tagOptions: BasicSingleCreatableSelectOption[];
};

export const useOtherTagOptions = ({ grade }: Args): Result => {
  const [dbKeys, setDbKeys] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const gradeId = grade === 1 ? 'firstGrade' : 'secondGrade';
      const res = await window.testCategory.getOtherTagKeys({ grade: gradeId });
      if (!res.ok) return;
      if (cancelled) return;
      setDbKeys(res.keys);
    })();

    return () => {
      cancelled = true;
    };
  }, [grade]);

  const tagOptions = useMemo(() => {
    return dbKeys.map((key) => ({
      value: key,
      label: key,
    }));
  }, [dbKeys]);

  return {
    tagOptions,
  };
};
