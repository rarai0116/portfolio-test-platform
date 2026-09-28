import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@ui/tooltip';

type StatusDotColor = 'green' | 'yellow' | 'red';

const colorVarMap: Record<StatusDotColor, string> = {
  green: 'var(--color-success-icon)',
  yellow: 'var(--color-warning-icon)',
  red: 'var(--color-error-icon)',
};

type Props = {
  color: StatusDotColor;
  label: string;
  tooltip?: string[];
};

const StatusDot = ({ color, label, tooltip }: Props) => {
  const dot = (
    <div className="flex items-center gap-1.5 text-sm text-nowrap">
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: colorVarMap[color] }}
      />
      <span>{label}</span>
    </div>
  );

  if (!tooltip || tooltip.length === 0) {
    return dot;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>{dot}</TooltipTrigger>
        <TooltipContent>
          <div className="flex flex-col gap-1 text-xs">
            {tooltip.map((msg) => (
              <div key={msg}>{msg}</div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default StatusDot;
