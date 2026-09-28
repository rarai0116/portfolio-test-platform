import {
  type ManualCheckDisplay,
  manualCheckDisplay,
} from '@views/testDataList/types/reactGridDataTypes';
import { memo } from 'react';
import LockIcon from '../../assets/lock.svg';

type Props = {
  value: ManualCheckDisplay;
};

const ManualCheckPill = memo(({ value }: Props) => {
  const isLocked = value === manualCheckDisplay.lock; // 'ロック中' と 'ロックなし' を比較している前提

  return (
    <div className="flex items-center justify-center">
      {isLocked ? (
        <img src={LockIcon} alt="校正ロック" width={20} height={20} />
      ) : (
        <span className="text-base leading-none text-foreground">ー</span>
      )}
    </div>
  );
});

ManualCheckPill.displayName = 'ManualCheckPill';

export default ManualCheckPill;
