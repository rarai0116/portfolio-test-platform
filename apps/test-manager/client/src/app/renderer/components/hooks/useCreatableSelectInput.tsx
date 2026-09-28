import { useCallback, useState } from 'react';
import type { MultiValue } from 'react-select';

export type CreatableSelectOption = {
  value: string;
  label: string;
};

type CreatableSelectInput = {
  tag: string;
  tagList: CreatableSelectOption[];
  onChange: (value: MultiValue<CreatableSelectOption>) => void;
  onSingleChange: (value: CreatableSelectOption | null) => void;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void; // 型を修正
};
const useCreatableSelectInput = (): CreatableSelectInput => {
  const [tag, setTag] = useState('');
  const [tagList, setTagList] = useState<CreatableSelectOption[]>([]);

  const onChange = useCallback(
    (value: MultiValue<CreatableSelectOption>): void => {
      setTagList([...value]);
    },
    [],
  );

  const onSingleChange = useCallback(
    (value: CreatableSelectOption | null): void => {
      setTagList(value ? [value] : []);
    },
    [],
  );

  const onInputChange = useCallback((value: string): void => {
    setTag(value);
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>): void => {
      const normalizedTag = tag.trim();
      if (!normalizedTag) {
        return;
      }
      switch (event.key) {
        case 'Enter':
        case 'Tab':
          if (tagList.some((t) => t.value.trim() === normalizedTag)) {
            return;
          }
          setTagList((prev) => [
            ...prev,
            { value: normalizedTag, label: normalizedTag },
          ]);
          setTag('');
          event.preventDefault();
      }
    },
    [tag, tagList],
  );
  return { tag, tagList, onChange, onSingleChange, onInputChange, onKeyDown };
};

export default useCreatableSelectInput;
