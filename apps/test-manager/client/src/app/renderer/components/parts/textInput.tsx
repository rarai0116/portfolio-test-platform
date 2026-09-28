import { Input } from '@ui/input';
import type React from 'react';

const isHalfWidthCharacter = (character: string) => {
  const codePoint = character.codePointAt(0);
  return (
    codePoint !== undefined &&
    (codePoint <= 0x007f || (codePoint >= 0xff61 && codePoint <= 0xff9f))
  );
};

const getCharacterLength = (character: string) =>
  isHalfWidthCharacter(character) ? 0.5 : 1;

export const getTextLength = (value: string) =>
  Array.from(value).reduce(
    (length, character) => length + getCharacterLength(character),
    0,
  );

const truncateText = (value: string, maxLength: number) => {
  let length = 0;
  let result = '';

  for (const character of value) {
    const characterLength = getCharacterLength(character);
    if (length + characterLength > maxLength) break;
    result += character;
    length += characterLength;
  }

  return result;
};

type TextInputProps = Omit<React.ComponentProps<'input'>, 'type'>;

const TextInput = ({
  maxLength,
  onChange,
  value,
  ...props
}: TextInputProps) => {
  return (
    <div className="flex items-end gap-2">
      <Input
        {...props}
        type="text"
        value={value}
        maxLength={maxLength === undefined ? undefined : maxLength * 2}
        onChange={(event) => {
          if (maxLength !== undefined) {
            event.currentTarget.value = truncateText(
              event.currentTarget.value,
              maxLength,
            );
          }
          onChange?.(event);
        }}
      />
      {maxLength !== undefined && (
        <p className="pb-0.5 text-sm text-muted-foreground">
          {getTextLength(value == null ? '' : String(value))}/{maxLength}
        </p>
      )}
    </div>
  );
};

export default TextInput;
