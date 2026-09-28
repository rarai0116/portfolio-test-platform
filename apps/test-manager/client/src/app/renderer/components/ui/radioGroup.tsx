import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { cn } from '@renderer/api/utils';
import { CircleIcon } from 'lucide-react';
import type * as React from 'react';

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn('grid gap-1', className)}
      {...props}
    />
  );
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        `bg-white peer border-primary text-primary aspect-square size-5 shrink-0 
        rounded-full border shadow-xs transition-[color,box-shadow] outline-none 
        focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] 
        aria-invalid:ring-destructive/20 aria-invalid:border-destructive 
        disabled:cursor-not-allowed disabled:bg-muted/50 disabled:border-muted/50`,
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="relative flex items-center justify-center"
      >
        <CircleIcon className="fill-primary absolute top-1/2 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };
