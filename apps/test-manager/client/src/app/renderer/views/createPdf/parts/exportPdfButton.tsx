import { Button } from '@renderer/components/ui/button';

type Props = {
  onClick: () => void;
  disabled?: boolean;
  isExporting?: boolean;
};

const ExportPdfButton = ({
  onClick,
  disabled = false,
  isExporting = false,
}: Props) => {
  return (
    <Button disabled={disabled} onClick={onClick}>
      {isExporting ? 'PDF を作成中...' : 'PDF を作成'}
    </Button>
  );
};

export default ExportPdfButton;
