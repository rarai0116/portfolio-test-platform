import { Button } from '@ui/button';

type Props = {
  onClick: () => void;
};

const ResetButton = ({ onClick }: Props) => {
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      初期状態に戻す
    </Button>
  );
};

export default ResetButton;
