import { cn } from '@renderer/api/utils';
import type * as React from 'react';

const Input = ({
  className,
  type,
  ...props
}: React.ComponentProps<'input'>) => {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        `placeholder:text-muted-foreground 
        selection:bg-primary selection:text-primary-foreground 
        h-10 flex min-w-0 rounded-md border-border border bg-white 
        px-2 py-1 text-sm transition-[color,box-shadow] outline-none 
        file:inline-flex file:h-10 file:border-0 file:text-foreground file:bg-transparent file:text-sm file:font-medium 
        disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-30 md:text-sm
        focus-visible:border-demoblue-100 focus-visible:ring-demoblue-100 focus-visible:ring-2
        aria-invalid:ring-destructive/20 aria-invalid:border-destructive`,
        className,
      )}
      {...props}
    />
  );
};

export { Input };
