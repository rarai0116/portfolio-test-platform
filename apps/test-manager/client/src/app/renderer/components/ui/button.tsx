import { Slot } from '@radix-ui/react-slot';
import { cn } from '@renderer/api/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

const buttonVariants = cva(
  ` flex items-center justify-center rounded-lg whitespace-nowrap
    focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]
    disabled:pointer-events-none`,
  {
    variants: {
      variant: {
        primary: `bg-primary text-primary-foreground items-center
          hover:bg-primary-active
          active:bg-primary-hover 
          disabled:bg-muted/50 disabled:text-white`,
        outline: `border text-primary border-primary bg-white 
          hover:bg-demoblue-50
          active:bg-demoblue-100
          disabled:bg-muted/50 disabled:text-white disabled:border-none`,
        ghost: `text-primary hover:bg-demoblue-50 active:bg-demoblue-100 disabled:bg-transparent disabled:text-muted`,
      },
      size: {
        sm: 'h-7 w-fit px-2 py-1 text-xs leading-none',
        md: 'h-8 w-fit px-3 py-2 text-sm leading-none',
        lg: 'h-10 w-fit px-5 py-3 text-sm leading-none',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

const Button = ({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) => {
  const Comp = asChild ? Slot : ('button' as React.ElementType);

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
};

export { Button, buttonVariants };
