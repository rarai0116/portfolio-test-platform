import { cn } from '@renderer/api/utils';
import { Button } from '@renderer/components/ui/button';
import type { DifficultySliderDynamicBounds } from '@views/createPdf/api/difficultyUtils';
import type { DifficultyRange } from '@views/createPdf/types/draftState';
import { type ChangeEvent, useCallback, useMemo, useState } from 'react';

const COLORS = [
  'var(--color-demoblue-300)',
  'var(--color-green-300)',
  'var(--color-red-300)',
] as const;
const STARS = ['★', '★★', '★★★'] as const;
const TICK_POSITIONS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;

// 2本のrange inputに共通するTailwindクラス
// pointer-events-none でトラック誤クリックを防ぎ、thumbのみ pointer-events-auto にする（原設計に準拠）
const RANGE_BASE_CLASS = [
  'absolute inset-y-0 my-auto w-full appearance-none outline-none bg-transparent pointer-events-none',
  '[&::-webkit-slider-runnable-track]:h-5',
  '[&::-webkit-slider-thumb]:appearance-none',
  '[&::-webkit-slider-thumb]:pointer-events-auto',
  '[&::-webkit-slider-thumb]:relative',
  '[&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5',
  '[&::-webkit-slider-thumb]:rounded-full',
  '[&::-webkit-slider-thumb]:bg-white',
  '[&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-border',
  '[&::-webkit-slider-thumb]:cursor-pointer',
].join(' ');

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

type Props = {
  // store 由来
  isCalculated: boolean;
  ratios: [number, number]; // 確定スライダー位置
  settableDifficultyRanges:
    | [DifficultyRange, DifficultyRange, DifficultyRange]
    | null;
  dynamicBounds: DifficultySliderDynamicBounds | null;
  // イベントハンドラ
  // onDragStart/onDraggingRatioChange はコンポーネント内部で完結（再レンダリング範囲を限定するため）
  onRatioCommit: (ratio: [number, number]) => void; // ドラッグ終了時に確定値を渡す
  onCalculate: () => void | Promise<void>;
  isCalculateDisabled: boolean;
};

const DifficultyAdjustment = ({
  isCalculated,
  ratios,
  settableDifficultyRanges,
  dynamicBounds,
  onRatioCommit,
  onCalculate,
  isCalculateDisabled,
}: Props) => {
  // draggingRatio: コンポーネント内で管理することで再レンダリング範囲をこのコンポーネント内に限定
  const [draggingRatio, setDraggingRatio] = useState<[number, number] | null>(
    null,
  );
  const displayRatio = draggingRatio ?? ratios;
  const [thumb1, thumb2] = displayRatio;

  // ★=thumb1%, ★★=(thumb2-thumb1)%, ★★★=(100-thumb2)%
  const percentages: [number, number, number] = [
    thumb1,
    thumb2 - thumb1,
    100 - thumb2,
  ];

  const trackGradient = useMemo(
    () =>
      `linear-gradient(to right, ${COLORS[0]} ${thumb1}%, ${COLORS[1]} ${thumb1}%, ${COLORS[1]} ${thumb2}%, ${COLORS[2]} ${thumb2}%)`,
    [thumb1, thumb2],
  );

  // ドラッグ開始時に確定値で初期化（useEffect 不要）
  const handlePointerDown = useCallback(() => {
    setDraggingRatio(ratios);
  }, [ratios]);

  const clampThumb1 = useCallback(
    (value: number, fixedThumb2: number) => {
      let r1 = Math.min(clamp(value, 0, 100), fixedThumb2);
      if (settableDifficultyRanges !== null) {
        // d0% = r1 と d1% = fixedThumb2 - r1 の両方が表示rangeに収まるよう制限する
        const r1Min = Math.max(
          settableDifficultyRanges[0].min,
          fixedThumb2 - settableDifficultyRanges[1].max,
        );
        const r1Max = Math.min(
          fixedThumb2,
          settableDifficultyRanges[0].max,
          fixedThumb2 - settableDifficultyRanges[1].min,
        );
        r1 = clamp(r1, r1Min, r1Max);
      }
      if (dynamicBounds?.thumb1 !== null && dynamicBounds?.thumb1 !== undefined) {
        r1 = clamp(r1, dynamicBounds.thumb1.min, dynamicBounds.thumb1.max);
      }
      return Math.min(r1, fixedThumb2);
    },
    [dynamicBounds, settableDifficultyRanges],
  );

  const clampThumb2 = useCallback(
    (value: number, fixedThumb1: number) => {
      let r2 = Math.max(clamp(value, 0, 100), fixedThumb1);
      if (settableDifficultyRanges !== null) {
        // d1% = r2 - fixedThumb1 が [d1_min, d1_max] に収まるよう、かつ
        // d2% = 100 - r2 が [d2_min, d2_max] に収まるよう r2 を制限する
        const r2Min = Math.max(
          fixedThumb1 + settableDifficultyRanges[1].min,
          100 - settableDifficultyRanges[2].max,
        );
        const r2Max = Math.min(
          fixedThumb1 + settableDifficultyRanges[1].max,
          100 - settableDifficultyRanges[2].min,
        );
        r2 = clamp(r2, r2Min, r2Max);
      }
      if (dynamicBounds?.thumb2 !== null && dynamicBounds?.thumb2 !== undefined) {
        r2 = clamp(r2, dynamicBounds.thumb2.min, dynamicBounds.thumb2.max);
      }
      return Math.max(r2, fixedThumb1);
    },
    [dynamicBounds, settableDifficultyRanges],
  );

  const handleThumb1Change = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const r1 = clampThumb1(Number(e.target.value), thumb2);
      // ブラウザのドラッグ内部状態も強制更新しないと、次の onChange で上書きされる
      e.target.value = String(r1);
      setDraggingRatio([r1, thumb2]);
    },
    [thumb2, clampThumb1],
  );

  const handleThumb2Change = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const r2 = clampThumb2(Number(e.target.value), thumb1);
      e.target.value = String(r2);
      setDraggingRatio([thumb1, r2]);
    },
    [thumb1, clampThumb2],
  );

  // ドラッグ終了時: クランプしてフック側に確定値を渡す
  const handlePointerUp = useCallback(() => {
    if (draggingRatio === null) return;
    let [r1, r2] = draggingRatio;
    r1 = clampThumb1(r1, r2);
    r2 = clampThumb2(r2, r1);
    onRatioCommit([r1, r2]);
    setDraggingRatio(null);
  }, [draggingRatio, clampThumb1, clampThumb2, onRatioCommit]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        {/* タイトル行 */}
        <div className="text-base font-medium">難易度調整</div>

        {/* 計算ボタン: グレーアウト対象外 */}
        <div className="flex items-center gap-3 pr-2">
          {isCalculated && (
            <span className="text-xs text-primary">計算が完了しました</span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onCalculate}
            disabled={isCalculateDisabled}
          >
            難易度計算
          </Button>
        </div>
      </div>

      {/* isCalculated が false の場合はスライダー・バルーンをグレーアウト */}
      <div
        className={cn(
          !isCalculated && 'pointer-events-none opacity-40',
          'px-2',
        )}
      >
        <div className="flex justify-around pb-2">
          {STARS.map((stars, i) => (
            <div
              key={stars}
              className="relative flex flex-col gap-1 text-xs w-16 rounded-md text-white text-center leading-none pt-2 pb-3"
              style={{ backgroundColor: COLORS[i] }}
            >
              <div>{stars}</div>
              <div>{percentages[i]}%</div>
              {settableDifficultyRanges !== null ? (
                <div className="h-3">
                  {settableDifficultyRanges[i].min}～
                  {settableDifficultyRanges[i].max}%
                </div>
              ) : (
                <div className="h-3" />
              )}
              {/* 吹き出し三角 */}
              <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{
                  top: '100%',
                  width: 0,
                  height: 0,
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderTop: `5px solid ${COLORS[i]}`,
                }}
              />
            </div>
          ))}
        </div>

        {/* スライダー本体: pointer-events-none でトラック誤クリックを防ぐ */}
        <div className="relative pointer-events-none py-4">
          {/* グラデーショントラック */}
          <div
            className="absolute inset-y-0 my-auto w-full h-5 rounded-full"
            style={{ background: trackGradient }}
          />
          {/* thumb1: ★/★★ の境界 */}
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={thumb1}
            onPointerDown={handlePointerDown}
            onChange={handleThumb1Change}
            onPointerUp={handlePointerUp}
            className={`${RANGE_BASE_CLASS} [&::-webkit-slider-thumb]:z-0`}
          />
          {/* thumb2: ★★/★★★ の境界。thumb1 より前面に表示 */}
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={thumb2}
            onPointerDown={handlePointerDown}
            onChange={handleThumb2Change}
            onPointerUp={handlePointerUp}
            className={`${RANGE_BASE_CLASS} [&::-webkit-slider-thumb]:z-1`}
          />
        </div>

        {/* 目盛り */}
        <div className="relative ml-0.5">
          {/* 水平線 */}
          <div className="absolute top-1.25 left-0 right-0 h-0.5 bg-border" />
          {/* ティック11本（0, 10, 20, …, 100） */}
          <div className="relative flex justify-between w-full mb-2">
            {TICK_POSITIONS.map((pos) => (
              <div key={pos} className="w-0.5 h-3 bg-border" />
            ))}
          </div>
          {/* パーセントラベル（0 / 50 / 100） */}
          <div className="flex justify-between text-sm text-foreground">
            <span>0</span>
            <span className="ml-3">50</span>
            <span>100</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DifficultyAdjustment;
