//Shadcn/uiのTabsのスタイルを上書きしたもの
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@renderer/api/utils';
import type * as React from 'react';

const LineTabs = ({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) => {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col  w-full h-full @container', className)}
      {...props}
    />
  );
};

const LineTabsList = ({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) => {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        `w-full p-0 bg-background justify-start border-b 
        text-muted-foreground inline-flex h-10 items-center`,
        className,
      )}
      {...props}
    />
  );
};

const LineTabsTrigger = ({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) => {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        `bg-background border-b-2 text-foreground text-sm sm:text-xs
        inline-flex h-[calc(100%-1px)]  items-center 
        justify-center border-transparent px-2 py-2 @[400px]:px-6
        whitespace-nowrap transition-[color,box-shadow] 
        data-[state=active]:border-primary data-[state=active]:text-foreground 
        focus-visible:ring-[3px] focus-visible:outline-1 focus-visible:border-ring 
        focus-visible:ring-ring/50 focus-visible:outline-ring`,
        className,
      )}
      {...props}
    />
  );
};

const LineTabsContent = ({
  className,
  keepMounted = true,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content> & {
  keepMounted?: boolean;
}) => {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      // 非アクティブでもDOMに残す
      forceMount={keepMounted || undefined}
      // 非アクティブは隠す。アクティブのみflex表示。
      className={cn(
        'bg-background hidden data-[state=active]:flex outline-none h-[calc(100%-2.5rem)]',
        className,
      )}
      {...props}
    />
  );
};

export { LineTabs, LineTabsContent, LineTabsList, LineTabsTrigger };
