import StatusMessage from '@parts/statusMessage';

type Props = {
  isExporting: boolean;
  errorMessage: string | null;
  isSuccess: boolean;
};

/**
 * PDF作成ボタン横ステータス表示。
 * 優先順位: 作成中(isExporting) → 非表示 > エラー(errorMessage) > 完了(isSuccess) > 非表示
 */
const ExportPdfStatusMessage = ({
  isExporting,
  errorMessage,
  isSuccess,
}: Props) => {
  if (isExporting) {
    return null;
  }
  if (errorMessage !== null) {
    return <StatusMessage color="red" text="PDFを作成できませんでした。" />;
  }
  if (isSuccess) {
    return <StatusMessage color="green" text="PDFの作成が完了しました。" />;
  }
  return null;
};

export default ExportPdfStatusMessage;
