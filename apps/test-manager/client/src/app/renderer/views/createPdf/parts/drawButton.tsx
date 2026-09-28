import { Button } from '@renderer/components/ui/button';

type Props = {
  onClick: () => void;
  disabled?: boolean;
};

const DrawButton = ({ onClick, disabled = false }: Props) => {
  return (
    <div className="flex">
      <Button size="md" onClick={onClick} disabled={disabled}>
        抽選を実行
      </Button>
    </div>
  );
};

export default DrawButton;
