import { Button } from '@ui/button';

type Props = { onLoad: () => void };

const JsonLoadButtons = ({ onLoad }: Props) => {
  return (
    <Button variant="ghost" size="sm" onClick={onLoad}>
      インポート
    </Button>
  );
};

export default JsonLoadButtons;
