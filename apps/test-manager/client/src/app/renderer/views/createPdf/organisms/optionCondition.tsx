import { createUid } from '@api/utils';
import BasicCreatableSelect from '@components/organism/basicCreatableSelect';
import type { BasicSingleCreatableSelectOption } from '@components/organism/basicSingleCreatableSelect';
import { Checkbox } from '@renderer/components/ui/checkbox';
import { useId } from 'react';

type OptionConditionProps = {
  tagOptions: BasicSingleCreatableSelectOption[];
  excludedTagIds: string[];
  excludePastExam: boolean;
  excludeOriginal: boolean;
  isShuffleChoices: boolean;
  onExcludedTagIdsChange: (value: string[]) => void;
  onExcludePastExamChange: (value: boolean) => void;
  onExcludeOriginalChange: (value: boolean) => void;
  onIsShuffleChoicesChange: (value: boolean) => void;
};

const OptionCondition = ({
  tagOptions,
  excludedTagIds,
  excludePastExam,
  excludeOriginal,
  isShuffleChoices,
  onExcludedTagIdsChange,
  onExcludePastExamChange,
  onExcludeOriginalChange,
  onIsShuffleChoicesChange,
}: OptionConditionProps) => {
  const id = useId();
  const excludePastExamId = createUid(id, { prefix: 'excludePastExamId' });
  const excludeOriginalId = createUid(id, { prefix: 'excludeOriginalId' });
  const shuffleChoicesId = createUid(id, { prefix: 'shuffleChoicesId' });

  return (
    <div className="flex flex-col gap-3">
      <div className="text-base font-medium">出題オプション</div>
      <div className="flex flex-col gap-3 px-2">
        <div className="flex flex-col gap-1">
          <div className="text-foreground text-sm">選択したタグを除外</div>
          <BasicCreatableSelect
            defaultOption={tagOptions}
            onChange={(v) => {
              onExcludedTagIdsChange(v);
            }}
            isNotCreatable
            placeholder="タグを選択"
            value={excludedTagIds}
          />
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            id={excludePastExamId}
            checked={excludePastExam}
            onCheckedChange={(v) => {
              onExcludePastExamChange(Boolean(v));
            }}
          />
          <label htmlFor={excludePastExamId} className="cursor-pointer text-sm">
            過去問を除外
          </label>
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            id={excludeOriginalId}
            checked={excludeOriginal}
            onCheckedChange={(v) => {
              onExcludeOriginalChange(Boolean(v));
            }}
          />
          <label htmlFor={excludeOriginalId} className="cursor-pointer text-sm">
            オリジナル問題を除外
          </label>
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            id={shuffleChoicesId}
            checked={isShuffleChoices}
            onCheckedChange={(v) => {
              onIsShuffleChoicesChange(Boolean(v));
            }}
            disabled={false}
          />
          <label htmlFor={shuffleChoicesId} className="cursor-pointer text-sm">
            選択肢をシャッフルする
          </label>
        </div>
      </div>
    </div>
  );
};

export default OptionCondition;
