import BasicDialog from '@parts/basicDialog';
import { useState } from 'react';

const UnappliedDrawConditionDialog = () => {
  const [open, setOpen] = useState(true);
  return (
    <BasicDialog
      open={open}
      onOpenChange={setOpen}
      title="出題条件が未反映です"
      description="現在の出力内容は最新の出題条件が反映されていません。出力を続行しますか？"
      primaryButtonText="続行"
      secondaryButtonText="キャンセル"
    />
  );
};

export default UnappliedDrawConditionDialog;
