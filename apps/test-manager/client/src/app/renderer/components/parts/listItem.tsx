import { cn } from '@api/utils';
import React from 'react';

export type ListItemProps = {
  id: string;
  text: string;
  textClassName?: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  isSelected: boolean;
  size?: 'small' | 'medium' | 'large';
  suffix?: React.ReactNode;
};

const ListItem = React.memo(
  (props: ListItemProps) => {
    return (
      <button
        id={props.id}
        type="button"
        onClick={props.onClick}
        className={cn(
          'w-full flex items-center leading-none px-4 py-2 hover:bg-secondary',
          props.size === 'small'
            ? 'text-sm'
            : props.size === 'large'
              ? 'text-lg'
              : 'text-base',
          props.isSelected ? 'bg-demoblue-50 ' : 'bg-white',
        )}
      >
        <span className={cn('flex-1 text-left truncate', props.textClassName)}>
          {props.text}
        </span>
        {props.suffix ? (
          <span className="ml-auto pl-2">{props.suffix}</span>
        ) : null}
      </button>
    );
  },
  (prev, next) =>
    prev.id === next.id &&
    prev.text === next.text &&
    prev.textClassName === next.textClassName &&
    prev.size === next.size &&
    prev.isSelected === next.isSelected &&
    Boolean(prev.suffix) === Boolean(next.suffix) &&
    prev.onClick === next.onClick,
);

export default ListItem;
