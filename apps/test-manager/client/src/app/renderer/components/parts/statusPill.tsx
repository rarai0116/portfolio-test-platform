export const statusKindMap = {
  エラー: 'error',
  準備完了: 'ok',
  準備中: 'waiting',
  停止中: 'stopped',
  不明: 'unknown',
} as const;
export type StatusKind = (typeof statusKindMap)[keyof typeof statusKindMap];

const statusColorMap: Record<
  StatusKind,
  {
    bg: string;
    text: string;
    defaultText: string;
  }
> = {
  error: {
    bg: 'bg-error-bg',
    text: 'text-error-text',
    defaultText: 'エラー',
  },
  ok: {
    bg: 'bg-success-bg',
    text: 'text-success-text',
    defaultText: '準備完了',
  },
  waiting: {
    bg: 'bg-warning-bg',
    text: 'text-warning-text',
    defaultText: '準備中',
  },
  stopped: {
    bg: 'bg-secondary',
    text: 'text-secondary-foreground',
    defaultText: '停止中',
  },
  unknown: {
    bg: 'bg-secondary',
    text: 'text-secondary-foreground',
    defaultText: '不明',
  },
};

type Props = {
  kind: StatusKind;
  text?: string;
};

const StatusPill = (props: Props) => {
  const c = statusColorMap[props.kind];
  const label = props.text ?? c.defaultText;
  return (
    <span
      data-testid="status-pill"
      className={[
        'inline-flex items-center justify-center gap-1  rounded-full  px-2 py-1 text-xs font-medium text-nowrap',
        c.bg,
        c.text,
      ].join(' ')}
    >
      {label}
    </span>
  );
};

export default StatusPill;
