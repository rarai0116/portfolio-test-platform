import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { cn } from '@renderer/api/utils';
import { CheckIcon } from 'lucide-react';
import type * as React from 'react';

const Checkbox = ({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) => {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        `peer border-primary bg-input text-primary-foreground 
        size-5 shrink-0 rounded-sm border shadow-xs transition-shadow outline-none 
        data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground 
        data-[state=checked]:border-primary 
        focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] 
        aria-invalid:ring-destructive/20 aria-invalid:border-destructive 
        disabled:cursor-not-allowed disabled:bg-muted/50 disabled:border-muted/50`,
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-none"
      >
        <CheckIcon className="size-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
};

export { Checkbox };
