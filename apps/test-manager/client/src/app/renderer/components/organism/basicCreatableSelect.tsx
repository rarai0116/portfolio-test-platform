import CrossIcon from '@components/icons/crossIcon';
import { ChevronDownIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import {
  type ClearIndicatorProps,
  components,
  type MultiValue,
  type MultiValueRemoveProps,
} from 'react-select';
import CreatableSelect from 'react-select/creatable';

type OptionType = {
  value: string;
  label: string;
};

// 区切り線を非表示にする
const IndicatorSeparator = () => null;

const ClearIcon = () => {
  return (
    <div className="w-4 mr-1 flex items-center justify-center">
      <CrossIcon size={16} fill="var(--color-icon)" />
    </div>
  );
};

// マルチセレクトのタグ削除アイコン
const MultiValueRemove = (props: MultiValueRemoveProps<OptionType>) => {
  return (
    <components.MultiValueRemove {...props}>
      <ClearIcon />
    </components.MultiValueRemove>
  );
};

// 全削除アイコン
const ClearIndicator = (props: ClearIndicatorProps<OptionType>) => {
  return (
    <components.ClearIndicator {...props}>
      <ClearIcon />
    </components.ClearIndicator>
  );
};

const DropdownIndicator = () => {
  return (
    <div className="mr-2 flex items-center justify-center">
      <ChevronDownIcon size={24} stroke="var(--color-icon)" />
    </div>
  );
};

type Props = {
  defaultOption?: OptionType[];

  // controlled（推奨）
  value?: string[];
  onChange?: (next: string[]) => void;
  onCreateOption?: (createdValue: string) => void;

  disabled?: boolean;
  placeholder?: string;
  invalid?: boolean;
  isNotCreatable?: boolean;
};

const toOption = (v: string): OptionType => ({ value: v, label: v });

const activeBorderColor = 'var(--color-demoblue-100)';
const activeRingColor = '0 0 0 2px var(--color-demoblue-100)';

const BasicCreatableSelect = (props: Props) => {
  const isControlled = typeof props.onChange === 'function';

  // inputValue はコンポーネント内で保持（react-selectの挙動安定のため）
  const [tag, setTag] = useState('');

  // uncontrolled fallback
  const [internalValues, setInternalValues] = useState<string[]>([]);

  const values: string[] = props.value ?? internalValues;

  const selectedOptions = useMemo(() => values.map(toOption), [values]);

  const emit = useCallback(
    (next: string[]) => {
      if (isControlled) props.onChange?.(next);
      else setInternalValues(next);
    },
    [isControlled, props.onChange],
  );

  const onChange = useCallback(
    (next: MultiValue<OptionType>) => {
      emit(next.map((o) => o.value));
    },
    [emit],
  );

  const onInputChange = useCallback((value: string) => {
    setTag(value);
  }, []);

  const handleCreateOption = useCallback(
    (createdValue: string) => {
      const normalizedTag = createdValue.trim();
      if (!normalizedTag) return;
      if (values.some((value) => value.trim() === normalizedTag)) return;

      props.onCreateOption?.(normalizedTag);
      emit([...values, normalizedTag]);
      setTag('');
    },
    [emit, props.onCreateOption, values],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const normalizedTag = tag.trim();
      if (!normalizedTag) return;

      switch (event.key) {
        case 'Enter':
        case 'Tab': {
          handleCreateOption(normalizedTag);
          event.preventDefault();
        }
      }
    },
    [handleCreateOption, tag],
  );

  return (
    <CreatableSelect
      menuPortalTarget={document.body} // メニューをbody直下に置いて、overflowやz-indexの影響を受けないようにする
      menuPosition="fixed"
      isMulti
      isClearable
      isSearchable
      isDisabled={props.disabled}
      value={selectedOptions}
      inputValue={tag}
      options={props.defaultOption}
      closeMenuOnSelect={false}
      createOptionPosition="first"
      formatCreateLabel={(inputValue) => `新規追加 ：${inputValue}`}
      placeholder={props.placeholder ?? 'タグを選択/追加'}
      noOptionsMessage={() => 'タグがありません'}
      components={{
        IndicatorSeparator,
        MultiValueRemove,
        ClearIndicator,
        DropdownIndicator,
      }}
      onCreateOption={handleCreateOption}
      onChange={onChange}
      onInputChange={onInputChange}
      isValidNewOption={props.isNotCreatable ? () => false : undefined}
      onKeyDown={props.isNotCreatable ? undefined : onKeyDown}
      styles={{
        control: (base, state) => ({
          ...base,
          fontSize: '14px',
          backgroundColor: 'var(--color-white)',
          borderRadius: '6px',
          width: 'auto',
          boxShadow: state.isFocused
            ? activeRingColor
            : props.invalid
              ? '0 0 0 2px var(--color-error-border)'
              : 'none',
          opacity: state.isDisabled ? 0.3 : 1,
          borderColor: state.isFocused
            ? activeBorderColor
            : props.invalid
              ? 'var(--color-error-border)'
              : 'var(--color-border)',
          '&:hover': {
            borderColor: state.isFocused
              ? activeBorderColor
              : props.invalid
                ? 'var(--color-error-border)'
                : 'var(--color-border)',
          },
        }),
        valueContainer: (base) => ({
          ...base,
          paddingLeft: '4px',
        }),
        menuList: (base) => ({
          ...base,
          backgroundColor: 'var(--color-white)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }),
        option: (base) => ({
          ...base,
          fontSize: '14px',
          width: '98%',
          backgroundColor: 'var(--color-white)',
          color: 'var(--color-foreground)',
          '&:hover': {
            backgroundColor: 'var(--color-secondary)',
            color: 'var(--color-secondary-foreground)',
            borderRadius: '6px',
          },
        }),
        multiValue: (base) => ({
          ...base,
          backgroundColor: 'var(--color-demoblue-50)',
          display: 'flex',
        }),
        multiValueRemove: (base) => ({
          ...base,
          '&:hover': {
            backgroundColor: 'var(--color-demoblue-100)',
          },
        }),
      }}
    />
  );
};

export default BasicCreatableSelect;
