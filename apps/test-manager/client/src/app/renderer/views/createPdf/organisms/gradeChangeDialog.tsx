import BasicDialog from '@parts/basicDialog';

type Props = {
  isOpen: boolean;
  pendingGrade: 1 | 2 | null;
  onConfirm: () => void;
  onCancel: () => void;
};

const GradeChangeDialog = ({
  isOpen,
  pendingGrade,
  onConfirm,
  onCancel,
}: Props) => {
  return (
    <BasicDialog
      open={isOpen}
      // ESCキーやオーバーレイクリックによる閉じ操作はキャンセル扱いにする
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      title="級の変更確認"
      description={`級を${pendingGrade ?? ''}級に変更すると、出題条件・問題テーブルが初期化されます。続行しますか？`}
      primaryButtonText="続行"
      onClickPrimaryButton={onConfirm}
      secondaryButtonText="キャンセル"
      onClickSecondaryButton={onCancel}
    />
  );
};

export default GradeChangeDialog;
