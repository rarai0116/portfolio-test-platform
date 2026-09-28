import { cn } from '@renderer/api/utils';
import { Input } from '@ui/input';
import type React from 'react';

type Props = Omit<
  React.ComponentProps<'input'>,
  'type' | 'inputMode' | 'onChange' | 'value'
> & {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  hasError?: boolean;
};

const errorClass = 'border-error-border ring-error-border ring-2';

const IntegerInput = ({
  value,
  onChange,
  placeholder = '',
  className,
  disabled = false,
  hasError = false,
  min,
  max,
  ...props
}: Props) => {
  return (
    <Input
      type="number"
      className={cn('h-7 w-16', hasError && errorClass, className)}
      placeholder={placeholder}
      value={value === 0 ? '' : value}
      min={min}
      max={max}
      disabled={disabled}
      onChange={(e) => {
        onChange(e.target.value === '' ? 0 : Number(e.target.value));
      }}
      onKeyDown={(e) => {
        // マイナス・小数点キーを除外
        if (['-', '.'].includes(e.key)) {
          e.preventDefault();
        }
      }}
      {...props}
    />
  );
};

export default IntegerInput;
