import { createUid } from '@api/utils';
import TextInput from '@renderer/components/parts/textInput';
import { RadioGroup, RadioGroupItem } from '@renderer/components/ui/radioGroup';
import type { CreationType } from '@shared/types/pdfPreview';
import { Label } from '@ui/label';
import { useId, useState } from 'react';

type BasicConditionProps = {
  grade: 1 | 2;
  title: string;
  creationType: CreationType;
  onTitleChange: (value: string) => void;
  onGradeChange: (value: 1 | 2) => void;
  onTitleEditStart: (editKey: string) => void;
  onTitleEditEnd: (editKey: string) => void;
};

const BasicCondition = ({
  grade,
  title,
  creationType,
  onTitleChange,
  onGradeChange,
  onTitleEditStart,
  onTitleEditEnd,
}: BasicConditionProps) => {
  const id = useId();
  const gradeId1 = createUid(id, { prefix: 'gradeId1' });
  const gradeId2 = createUid(id, { prefix: 'gradeId2' });
  const titleId = createUid(id, { prefix: 'titleId' });
  const titleEditKey = 'basic-condition:title';
  const maxTitleLength = creationType === 'exam' ? 14 : 18;

  const [titleInput, setTitleInput] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="text-base font-medium">タイトル</div>
        {/* タイトル入力 */}
        <div className="flex items-end gap-2 px-2">
          <TextInput
            id={titleId}
            className="w-80"
            placeholder="タイトルを入力"
            maxLength={maxTitleLength}
            value={titleInput ?? title}
            onFocus={() => {
              onTitleEditStart?.(titleEditKey);
            }}
            onChange={(e) => {
              setTitleInput(e.target.value);
            }}
            onBlur={() => {
              const nextTitle = titleInput ?? title;
              if (nextTitle !== title) {
                onTitleChange(nextTitle);
              }
              setTitleInput(null);
              onTitleEditEnd?.(titleEditKey);
            }}
          />
        </div>
      </div>

      {/* 級選択 */}
      <div className="flex flex-col gap-2">
        <div className="text-base font-medium ">級</div>
        <fieldset className="space-y-2 px-2">
          <RadioGroup
            className="flex flex-col gap-2"
            value={String(grade)}
            onValueChange={(v) => onGradeChange(Number(v) as 1 | 2)}
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="1" id={gradeId1} />
              <Label htmlFor={gradeId1} className="text-sm">
                1級
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="2" id={gradeId2} />
              <Label htmlFor={gradeId2} className="text-sm">
                2級
              </Label>
            </div>
          </RadioGroup>
        </fieldset>
      </div>
    </div>
  );
};

export default BasicCondition;
