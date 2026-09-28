import CrossIcon from '@components/icons/crossIcon';
import { Separator } from '@ui/separator';
import Switch from '@ui/switch';
import { CircleIcon } from 'lucide-react';
import { memo, useId } from 'react';
import type { JudgeResultWithReason } from '../../../api/judgeTestData';
import LockIcon from '../../../assets/lock.svg';
import LockOpenIcon from '../../../assets/lock-open.svg';
import StatusPill, {
  type StatusKind,
} from '../../../components/parts/statusPill';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';

export type StatusBarProps = {
  autoCheckMessage: string;
  autoCheckHasError: boolean;
  autoCheckDetails?: string[];

  // ユーザー操作可
  calibrationLocked: boolean;
  onChangeCalibrationLocked?: (checked: boolean) => void;

  // 自動付与タグ判定バッジ
  isShuffleableBadge?: JudgeResultWithReason;
  isConvertibleQaaBadge?: JudgeResultWithReason;
  answerFormBadge?:
    | { type: 'positive' }
    | { type: 'negative'; matchedWord?: string }
    | { type: 'not-applicable' };

  // 保存ボタン
  onSave?: () => void; // 保存アクション
  saveDisabled?: boolean; // 保存の無効化

  // 保存前に戻す（リセット）
  onRevert?: () => void;
  revertDisabled?: boolean;

  // 出題停止または出題停止解除
  onStop?: () => void;
  stopped?: boolean;

  // 現在状態
  status: StatusKind;
  statusText?: string;

  className?: string;
  disabled?: boolean; // ユーザー操作（校正チェック）の無効化に利用
  'data-testid'?: string;
};

const AutoCheckHelp = memo(
  (props: { hasError: boolean; details?: string[] }) => {
    if (!props.hasError || !props.details || props.details.length === 0) {
      return null;
    }
    const detailsMap: { id: string; message: string }[] = props.details.map(
      (detail, index) => ({
        id: `detail-${index}`,
        message: detail,
      }),
    );

    return (
      <div className="relative group">
        <button
          type="button"
          tabIndex={0}
          aria-label="自動チェックエラー詳細を表示"
          className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border border-error-border text-[14px] font-bold leading-none text-error-text bg-white"
        >
          ?
        </button>

        <div
          className="
          pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-40 -translate-x-1/2
          rounded-md border border-error-border bg-white p-3 shadow-lg
          group-hover:block group-focus-within:block
        "
        >
          {/* 変更: このパネルが何を示しているかを明示 */}
          <div className="mb-2 text-xs font-semibold text-error-text">
            エラー内容
          </div>

          <ul className=" overflow-y-auto space-y-1 text-xs text-foreground">
            {detailsMap.map((detail) => (
              <li key={detail.id} className="leading-5">
                ・{detail.message}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.hasError === next.hasError &&
      JSON.stringify(prev.details ?? []) === JSON.stringify(next.details ?? [])
    );
  },
);

/** シャッフル/一問一答化バッジ（× のときホバーで理由 Tooltip 表示） */
const JudgeBadge = memo(
  (props: { label: string; result: boolean; reasons: string[] }) => {
    const mark = props.result ? (
      <CircleIcon size={16} color="var(--color-success-icon)" />
    ) : (
      <CrossIcon size={16} fill="var(--color-error-icon)" />
    );
    const markClass = props.result ? 'text-success-text' : 'text-error-text';

    if (props.result || props.reasons.length === 0) {
      return (
        <span className="inline-flex shrink-0 items-center whitespace-nowrap text-xs tracking-tighter">
          <span>{props.label}：</span>
          <span className={`ml-0.5 font-medium ${markClass}`}>{mark}</span>
        </span>
      );
    }

    return (
      <div className="relative group inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap">
        <span className="text-xs tracking-tighter">{props.label}：</span>
        <span className={`text-xs font-medium cursor-help ${markClass}`}>
          {mark}
        </span>
        <div
          className="
            pointer-events-none absolute left-0 top-full z-50 mt-2 hidden w-50
            rounded-md border border-error-border bg-white px-2 py-2 shadow-sm
            group-hover:block group-focus-within:block
          "
        >
          <div className="mb-0.5 text-xs text-error-text">理由</div>
          <ul className="text-xs text-foreground">
            {props.reasons.map((r, i) => {
              const key = `reason-${i}`;
              return (
                <li
                  key={key}
                  className="whitespace-normal wrap-break-word leading-5"
                >
                  ・{r}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.label === next.label &&
    prev.result === next.result &&
    JSON.stringify(prev.reasons) === JSON.stringify(next.reasons),
);

export const StatusBar = memo(
  function StatusBar({
    autoCheckMessage,
    autoCheckHasError,
    autoCheckDetails,
    calibrationLocked,
    onChangeCalibrationLocked,
    isShuffleableBadge,
    isConvertibleQaaBadge,
    answerFormBadge,
    onSave,
    saveDisabled,
    onRevert,
    revertDisabled,
    status,
    statusText,
    className,
    disabled,
    onStop,
    stopped,

    'data-testid': dataTestId,
  }: StatusBarProps) {
    const id = useId();
    const rootClass =
      'sticky top-0 z-10 w-full bg-white shadow-sm p-4 flex flex-wrap min-w-0 items-center justify-between gap-3';

    return (
      <div
        className={className ? `${rootClass} ${className}` : rootClass}
        data-testid={dataTestId ?? 'status-bar'}
      >
        <div className="w-full flex flex-wrap items-center gap-2 justify-between">
          {/* 自動付与タグ判定バッジ（judgeDetail が null = 未チェック時は非表示） */}
          <div className="w-full flex items-center gap-x-4 gap-y-1 justify-between flex-wrap">
            <div className="flex items-center gap-4">
              {isShuffleableBadge && (
                <JudgeBadge
                  label="シャッフル"
                  result={isShuffleableBadge.result}
                  reasons={isShuffleableBadge.reasons}
                />
              )}
              {isConvertibleQaaBadge && (
                <JudgeBadge
                  label="一問一答化"
                  result={isConvertibleQaaBadge.result}
                  reasons={isConvertibleQaaBadge.reasons}
                />
              )}
              {answerFormBadge && answerFormBadge.type !== 'negative' && (
                <span className="text-xs tracking-tighter">
                  形式：
                  <span className="font-medium ml-0.5">
                    {answerFormBadge.type === 'positive' && '正答選択'}
                    {answerFormBadge.type === 'not-applicable' && '\u2015'}
                  </span>
                </span>
              )}
              {answerFormBadge?.type === 'negative' && (
                <div className="relative group inline-flex items-center gap-0.5">
                  <span className="text-xs text-nowrap">形式：</span>
                  <span className="text-xs ml-0.5 cursor-help text-nowrap">
                    誤答選択
                  </span>
                  {answerFormBadge.matchedWord && (
                    <div
                      className="
                    pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-36 -translate-x-1/2
                    rounded-md border border-border bg-white p-3 shadow-lg
                    group-hover:block group-focus-within:block
                  "
                    >
                      <div className="mb-1 text-xs font-semibold text-muted-foreground">
                        否定キーワード
                      </div>
                      <p className="text-xs text-foreground">
                        ・{answerFormBadge.matchedWord}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <StatusPill kind={status} text={statusText} />
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <div
              className="flex items-center gap-1 flex-wrap"
              data-testid="auto-check-message"
            >
              <span className="text-xs text-nowrap">自動チェック：</span>
              <span
                className={`text-xs font-medium text-nowrap ${
                  autoCheckHasError ? ' text-error-text' : ' text-success-text '
                }`}
              >
                {autoCheckMessage}
              </span>
              <AutoCheckHelp
                hasError={autoCheckHasError}
                details={autoCheckDetails}
              />
            </div>
          </div>
        </div>
        <Separator orientation="horizontal" />

        <div className="w-full flex flex-row gap-2 items-center justify-between">
          <div className="flex gap-1">
            <Switch
              id={`${id}-calibration-locked`}
              disabled={disabled}
              data-testid="calibration-locked"
              checked={calibrationLocked}
              className="h-6 w-11"
              icon={
                calibrationLocked ? (
                  <img src={LockIcon} alt="校正ロック" width={12} height={12} />
                ) : (
                  <img
                    src={LockOpenIcon}
                    alt="校正ロック解除"
                    width={12}
                    height={12}
                  />
                )
              }
              onCheckedChange={(v) => {
                onChangeCalibrationLocked?.(v === true);
              }}
              thumbClassName="h-5 w-5 data-[state=checked]:translate-x-5"
            />
            <Label
              htmlFor={`${id}-calibration-locked`}
              className="text-xs text-nowrap"
            >
              校正ロック
            </Label>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              disabled={saveDisabled}
              data-testid="save-button"
              className="px-3"
            >
              保存
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRevert}
              disabled={revertDisabled}
              data-testid="revert-button"
              className="px-3"
            >
              変更を破棄
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onStop}
              data-testid="stop-button"
              className="px-3"
            >
              {stopped ? '停止解除' : '出題停止'}
            </Button>
          </div>
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.autoCheckMessage === next.autoCheckMessage &&
      prev.autoCheckHasError === next.autoCheckHasError &&
      JSON.stringify(prev.autoCheckDetails ?? []) ===
        JSON.stringify(next.autoCheckDetails ?? []) &&
      prev.calibrationLocked === next.calibrationLocked &&
      prev.onChangeCalibrationLocked === next.onChangeCalibrationLocked &&
      prev.isShuffleableBadge?.result === next.isShuffleableBadge?.result &&
      JSON.stringify(prev.isShuffleableBadge?.reasons ?? []) ===
        JSON.stringify(next.isShuffleableBadge?.reasons ?? []) &&
      prev.isConvertibleQaaBadge?.result ===
        next.isConvertibleQaaBadge?.result &&
      JSON.stringify(prev.isConvertibleQaaBadge?.reasons ?? []) ===
        JSON.stringify(next.isConvertibleQaaBadge?.reasons ?? []) &&
      JSON.stringify(prev.answerFormBadge) ===
        JSON.stringify(next.answerFormBadge) &&
      prev.onSave === next.onSave &&
      prev.saveDisabled === next.saveDisabled &&
      prev.onRevert === next.onRevert &&
      prev.revertDisabled === next.revertDisabled &&
      prev.status === next.status &&
      prev.statusText === next.statusText &&
      prev.className === next.className &&
      prev.disabled === next.disabled &&
      prev.onStop === next.onStop &&
      prev.stopped === next.stopped
    );
  },
);

export default StatusBar;
