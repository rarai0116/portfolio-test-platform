import CrossIcon from '@components/icons/crossIcon';
import type { ReactNode } from 'react';

export type Props = { children?: ReactNode };

const ToolBar = (_props: Props) => {
  return (
    <>
      <div className="draggable h-7 bg-accent rounded-t-md flex items-center justify-end px-1">
        <CrossIcon fill="#ffffff" />
      </div>
      {/* {props.children} */}
    </>
  );
};

export default ToolBar;
