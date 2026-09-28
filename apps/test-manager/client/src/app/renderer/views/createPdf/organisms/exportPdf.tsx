// import { createUid } from '@api/utils';
import type { ExamDateOption } from '@shared/types/createPdfConditionJson';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Label } from '@ui/label';
import { useId } from 'react';

// import { Checkbox } from '@ui/checkbox';
// import { Label } from '@ui/label';
// import { useId } from 'react';

type Props = {
  outputDirectory?: string | null;
  expectedFileNames?: string[];
  warningMessages?: string[];
  blockingReasons?: string[];
  errorMessage?: string | null;
  lastOutputFolderPath?: string | null;
  lastExportedFiles?: string[];
  isSelectingOutputDirectory?: boolean;
  includeCover?: boolean;
  excludeMiddleCover?: boolean;
  showExcludeMiddleCover?: boolean;
  saveConditionJson?: boolean;
  showExamDateOption?: boolean;
  examDate?: ExamDateOption;
  onSelectOutputDirectory?: () => void;
  onIncludeCoverChange?: (value: boolean) => void;
  onExcludeMiddleCoverChange?: (value: boolean) => void;
  onSaveConditionJsonChange?: (value: boolean) => void;
  onExamDateChange?: (value: ExamDateOption) => void;
};

const ExportPdf = ({
  outputDirectory,
  expectedFileNames,
  errorMessage,
  lastOutputFolderPath,
  lastExportedFiles,
  isSelectingOutputDirectory = false,
  showExamDateOption = false,
  examDate,
  onSelectOutputDirectory,
  onExamDateChange,
  /*  excludeMiddleCover,
  showExcludeMiddleCover = false,
  saveConditionJson,
  onIncludeCoverChange,
  onExcludeMiddleCoverChange,
  onSaveConditionJsonChange,
  */
}: Props) => {
  const examDateId = useId();
  /*
  const id = useId();
  const includeCoverId = createUid(id, { prefix: 'includeCover' });
  const excludeMiddleCoverId = createUid(id, {
    prefix: 'excludeMiddleCover',
  });
  const saveConditionJsonId = createUid(id, { prefix: 'saveConditionJson' });
  */

  return (
    <div className="flex flex-col gap-6">
      <div className="text-lg text-primary">PDF出力</div>

      {showExamDateOption && (
        <div className="flex flex-col gap-3">
          <div className="text-base font-medium">実施年月日</div>
          <div className="flex flex-wrap items-center gap-2 px-2">
            {(
              [
                ['year', '年'],
                ['month', '月'],
                ['day', '日'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1">
                <Input
                  className={key === 'year' ? 'w-24' : 'w-16'}
                  id={`${examDateId}-${key}`}
                  value={examDate?.[key] ?? ''}
                  maxLength={key === 'year' ? 4 : 2}
                  width={4}
                  onChange={(event) =>
                    onExamDateChange?.({
                      year: examDate?.year ?? '',
                      month: examDate?.month ?? '',
                      day: examDate?.day ?? '',
                      [key]: event.currentTarget.value,
                    })
                  }
                />
                <Label htmlFor={`${examDateId}-${key}`} className="text-sm">
                  {label}
                </Label>
              </div>
            ))}
            <span className="text-sm">実施</span>
          </div>
        </div>
      )}

      {/*      <div className="flex flex-col gap-3">
        <div className="text-base font-medium">オプション</div>
        <div className="flex flex-col gap-2 px-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id={includeCoverId}
              checked={includeCover}
              onCheckedChange={(v) => onIncludeCoverChange?.(v === true)}
            />
            <Label htmlFor={includeCoverId} className="text-sm">
              表紙を含める
            </Label>
          </div>
          {showExcludeMiddleCover && (
            <div className="flex items-center gap-2">
              <Checkbox
                id={excludeMiddleCoverId}
                checked={excludeMiddleCover}
                onCheckedChange={(v) =>
                  onExcludeMiddleCoverChange?.(v === false)
                }
              />
              <Label htmlFor={excludeMiddleCoverId} className="text-sm">
                中表紙を含める
              </Label>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Checkbox
              id={saveConditionJsonId}
              checked={saveConditionJson}
              onCheckedChange={(v) => onSaveConditionJsonChange?.(v === true)}
            />
            <Label htmlFor={saveConditionJsonId} className="text-sm">
              出題条件データを同時保存
            </Label>
          </div>
        </div>
      </div>
    */}
      <div className="flex flex-col gap-2">
        <div className="text-base font-medium">出力先フォルダ</div>
        <div className="flex items-center gap-2 px-2">
          <div className="flex-1 rounded border px-3 py-2 text-sm text-muted-foreground">
            {outputDirectory || '未選択'}
          </div>
          <Button
            disabled={isSelectingOutputDirectory}
            onClick={() => onSelectOutputDirectory?.()}
            variant="outline"
            size="sm"
          >
            参照
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-base font-medium">出力予定ファイル</div>
        <div className="flex flex-col gap-2 px-2">
          {expectedFileNames?.map((name) => (
            <div key={name} className="text-sm text-muted-foreground">
              ・{name}
            </div>
          ))}
        </div>
      </div>

      {errorMessage && (
        <div
          className="rounded border-2 border-error-borderp-3 text-sm text-error-text"
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      {lastOutputFolderPath && (lastExportedFiles?.length ?? 0) > 0 && (
        <div className="rounded border p-3 text-sm wrap-break-word">
          <div className="font-medium">直近の出力結果</div>
          <div className="mt-2 flex flex-col gap-1 text-muted-foreground">
            {lastExportedFiles?.map((filePath) => (
              <div key={filePath}>{filePath}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportPdf;
