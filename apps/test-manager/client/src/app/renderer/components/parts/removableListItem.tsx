import CrossIcon from '@components/icons/crossIcon';
import React from 'react';

export type RemovableListItemProps = {
  id: string;
  text: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

const RemovableListItem = React.memo(
  (props: RemovableListItemProps) => {
    return (
      <div className="flex justify-between w-full  text-base leading-none px-4 py-3 text-left hover:bg-secondary">
        <p className="break-all"> {props.text}</p>
        <button
          id={props.id}
          type="button"
          className="w-8 h-full px-2"
          onClick={props.onClick}
        >
          <CrossIcon
            fill="var(--color-icon)"
            hoverFill="var(--color-icon-hover)"
          />
        </button>
      </div>
    );
  },
  (prev, next) =>
    prev.id === next.id &&
    prev.text === next.text &&
    prev.onClick === next.onClick,
);

export default RemovableListItem;
