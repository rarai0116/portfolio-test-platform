import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { cn } from '@renderer/api/utils';
import { Accordion, AccordionContent, AccordionItem } from '@ui/accordion';
import { Checkbox } from '@ui/checkbox';
import { ChevronDownIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useId } from 'react';

type Props = {
  big: string;
  /** 配下の全 selectable 小分類がチェック済みのとき true */
  checked: boolean;
  /** 一部チェック済みのとき true（shadcn Checkbox の 'indeterminate' 表示に使用） */
  indeterminate: boolean;
  /** 現在チェック済み行の count 合計 */
  selectedCount: number;
  /** 大カテゴリ配下の全問題数合計 */
  bigTotalCount: number;
  onBigCheck: () => void;
  onBigUncheck: () => void;
  children: ReactNode;
};

const WorkbookBigCategory = ({
  big,
  checked,
  indeterminate,
  selectedCount,
  bigTotalCount,
  onBigCheck,
  onBigUncheck,
  children,
}: Props) => {
  const checkboxId = useId();

  return (
    <Accordion type="single" defaultValue={big} collapsible>
      <AccordionItem
        value={big}
        className="px-4 border bg-white rounded-md shadow-xs"
      >
        {/*
         * AccordionTrigger（button）内に Checkbox（button）はネスト不可のため、
         * AccordionPrimitive を直接使いチェックボックスとトリガー矢印を分離する。
         */}
        <AccordionPrimitive.Header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id={checkboxId}
              checked={indeterminate ? 'indeterminate' : checked}
              onCheckedChange={(v) => (v ? onBigCheck() : onBigUncheck())}
            />
            <label
              htmlFor={checkboxId}
              className="cursor-pointer text-sm font-normal"
            >
              {big}
            </label>
            <span
              className={cn(
                'text-sm text-muted-foreground ml-2',
                selectedCount > bigTotalCount && 'text-destructive',
              )}
            >
              {selectedCount}/{bigTotalCount}
            </span>
          </div>
          <AccordionPrimitive.Trigger className="flex h-10 items-center data-[state=open]:[&>svg]:rotate-180">
            <ChevronDownIcon className="text-muted-foreground size-6 shrink-0 transition-transform duration-200" />
          </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>
        <AccordionContent>
          <div className="w-full flex flex-col gap-2 pl-4 pt-2">{children}</div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default WorkbookBigCategory;
