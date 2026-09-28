import BasicDialog from '@parts/basicDialog';

type Props = {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
};

const ResetConfirmDialog = ({
  open,
  title,
  description,
  onConfirm,
  onCancel,
}: Props) => {
  return (
    <BasicDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
      title={title}
      description={description}
      primaryButtonText="続行"
      onClickPrimaryButton={onConfirm}
      secondaryButtonText="キャンセル"
      onClickSecondaryButton={onCancel}
    />
  );
};

export default ResetConfirmDialog;
