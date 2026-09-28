import { cn } from '@renderer/api/utils';
import { Input } from '@ui/input';
import type React from 'react';
import { useMemo, useRef, useState } from 'react';

type Props = Omit<
  React.ComponentProps<'input'>,
  | 'type'
  | 'inputMode'
  | 'onChange'
  | 'value'
  | 'onKeyDown'
  | 'onFocus'
  | 'onBlur'
> & {
  value: number; // 0 = 空欄
  onChange: (value: number) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** リストから番号を選択して確定したときに呼ばれる */
  onChoose?: (value: number) => void;
  /** 出題オプション・使用済みNo除外済みの候補No一覧 */
  suggestedNos: readonly number[];
  /** 不正な問題No入力時に赤枠表示する */
  hasError?: boolean;
  min?: number;
  max?: number;
};

const SUGGEST_LIMIT = 100;
const errorClass = 'border-error-border ring-error-border ring-2';

const QuestionNoSuggestInput = ({
  value,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
  onChoose,
  suggestedNos,
  hasError = false,
  className,
  min,
  max,
  ...props
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // mousedown 中フラグ: input の blur をリスト選択時に抑制するため
  const isMouseDownOnList = useRef(false);

  // 打鍵内容に関係なく全候補を表示する（絞り込みなし）
  const filteredNos = useMemo(
    () => suggestedNos.slice(0, SUGGEST_LIMIT).sort((a, b) => a - b),
    [suggestedNos],
  );

  const handleFocus = () => {
    setIsOpen(true);
    setActiveIndex(-1);
    onFocus?.();
  };

  const handleBlur = () => {
    // mousedown 中はリスト選択として扱うため blur を無視
    if (isMouseDownOnList.current) return;
    setIsOpen(false);
    setActiveIndex(-1);
    onBlur?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isOpen && filteredNos.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) =>
          prev < filteredNos.length - 1 ? prev + 1 : 0,
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) =>
          prev > 0 ? prev - 1 : filteredNos.length - 1,
        );
        return;
      }
      if (e.key === 'Enter' && activeIndex >= 0) {
        const chosen = filteredNos[activeIndex];
        if (chosen !== undefined) {
          e.preventDefault();
          onChange(chosen);
          onChoose?.(chosen);
          setIsOpen(false);
          setActiveIndex(-1);
          return;
        }
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setActiveIndex(-1);
        // Escape は親にも委譲してリセット処理を走らせる
      }
      if (e.key === 'Tab') {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    onKeyDown?.(e);
  };

  const handleChoose = (no: number) => {
    onChange(no);
    onChoose?.(no);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div className="relative">
      <Input
        type="number"
        className={cn('h-7 w-full', hasError && errorClass, className)}
        value={value === 0 ? '' : value}
        min={min}
        max={max}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onChange={(e) => {
          onChange(e.target.value === '' ? 0 : Number(e.target.value));
        }}
        {...props}
      />
      {isOpen && filteredNos.length > 0 && (
        <div
          role="listbox"
          aria-label="候補番号リスト"
          className="absolute top-full left-0 z-50 mt-0.5 px-1 py-1.5 text-xs flex min-w-16 max-h-52 flex-col overflow-y-auto
                     rounded-md border border-border bg-popover shadow-md"
          // blur より先に mousedown が発火するため、blur 抑制フラグを立てる
          onMouseDown={() => {
            isMouseDownOnList.current = true;
          }}
          onMouseUp={() => {
            isMouseDownOnList.current = false;
          }}
        >
          {filteredNos.map((no, _idx) => (
            <button
              key={no}
              type="button"
              className={cn(
                'block w-full cursor-pointer py-1 rounded-md text-left text-sm hover:bg-secondary hover:text-foreground',
              )}
              onClick={() => handleChoose(no)}
            >
              <span className="px-2">{no}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuestionNoSuggestInput;
