import PreviewIcon from '@components/icons/previewIcon';
import { Button } from '@ui/button';

type Props = {
  onClick: () => void;
};

const PreviewWindowReopenButton = ({ onClick }: Props) => {
  return (
    <Button
      aria-label="プレビューウィンドウを再表示"
      className="h-7 w-7 px-1"
      onClick={onClick}
      size="sm"
      title="プレビューウィンドウを再表示"
      type="button"
      variant="ghost"
    >
      <PreviewIcon
        fill="var(--color-icon)"
        hoverFill="var(--color-icon-hover)"
        size={20}
        title="プレビューウィンドウを再表示"
      />
    </Button>
  );
};

export default PreviewWindowReopenButton;
