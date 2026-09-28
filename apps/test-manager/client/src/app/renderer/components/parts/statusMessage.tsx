const statusColorMap: Record<
  string,
  {
    bg: string;
    text: string;
    defaultText: string;
  }
> = {
  red: {
    bg: 'bg-error-bg',
    text: 'text-error-text',
    defaultText: 'エラー',
  },
  green: {
    bg: 'bg-success-bg',
    text: 'text-success-text',
    defaultText: '準備完了',
  },
  yellow: {
    bg: 'bg-warning-bg',
    text: 'text-warning-text',
    defaultText: '準備中',
  },
  violet: {
    bg: 'bg-secondary',
    text: 'text-secondary-foreground',
    defaultText: '停止中',
  },
  gray: {
    bg: 'bg-secondary',
    text: 'text-secondary-foreground',
    defaultText: '不明',
  },
};

type Props = {
  color: keyof typeof statusColorMap;
  text: string;
};

const StatusMessage = ({ color, text }: Props) => {
  const c = statusColorMap[color];
  return (
    <div
      className={[
        'rounded-md px-2 py-2 text-xs whitespace-nowrap flex leading-none items-center h-fit　',
        c.bg,
        /*    c.text, */
      ].join(' ')}
    >
      {text}
    </div>
  );
};

export default StatusMessage;
