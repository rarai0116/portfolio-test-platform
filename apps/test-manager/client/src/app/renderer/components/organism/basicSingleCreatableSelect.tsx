import CrossIcon from '@components/icons/crossIcon';
import { ChevronDownIcon } from 'lucide-react';
import type { ActionMeta, SingleValue } from 'react-select';
import { type ClearIndicatorProps, components } from 'react-select';
import CreatableSelect from 'react-select/creatable';

export type BasicSingleCreatableSelectOption = {
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

// 全削除アイコン
const ClearIndicator = (
  props: ClearIndicatorProps<BasicSingleCreatableSelectOption>,
) => {
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
  value: string | undefined;
  options: BasicSingleCreatableSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;

  // 選択（or クリア）時
  onChange: (nextValue: string) => void;

  // 新規作成を許可したい場合のみ指定
  allowCreate?: boolean;
  onCreateOption?: (createdValue: string) => void;
};

const activeBorderColor = 'var(--color-demoblue-100)';
const activeRingColor = '0 0 0 2px var(--color-demoblue-100)';

const BasicSingleCreatableSelect = (props: Props) => {
  const selected: BasicSingleCreatableSelectOption | null =
    props.value != null && props.value !== ''
      ? { value: props.value, label: props.value }
      : null;

  return (
    <CreatableSelect<BasicSingleCreatableSelectOption, false>
      menuPortalTarget={document.body} // メニューをbody直下に置いて、overflowやz-indexの影響を受けないようにする
      menuPosition="fixed"
      isClearable
      isSearchable
      isDisabled={props.disabled}
      value={selected}
      options={props.options}
      placeholder={props.placeholder ?? 'タグを選択'}
      closeMenuOnSelect
      createOptionPosition="first"
      formatCreateLabel={(inputValue) => `新規追加 ：${inputValue}`}
      noOptionsMessage={() => 'タグがありません'}
      isValidNewOption={(inputValue, _value, _options) => {
        if (!props.allowCreate) return false;
        return inputValue.trim().length > 0;
      }}
      onCreateOption={(inputValue) => {
        const v = inputValue.trim();
        if (!v) return;
        if (!props.allowCreate) return;
        props.onCreateOption?.(v);
      }}
      components={{
        IndicatorSeparator,
        ClearIndicator,
        DropdownIndicator,
      }}
      onChange={(
        opt: SingleValue<BasicSingleCreatableSelectOption>,
        _actionMeta: ActionMeta<BasicSingleCreatableSelectOption>,
      ) => {
        props.onChange(opt?.value ?? '');
      }}
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
      }}
    />
  );
};

export default BasicSingleCreatableSelect;
