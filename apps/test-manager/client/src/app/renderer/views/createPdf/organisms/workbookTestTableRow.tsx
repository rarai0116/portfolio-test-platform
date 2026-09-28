import { Checkbox } from '@ui/checkbox';
import { Input } from '@ui/input';
import { TableCell, TableRow } from '@ui/table';
import type { CreatePdfPreviewUpdateAdapter } from '@views/createPdf/types/previewUpdate';
import { useId, useState } from 'react';

type Props = {
  rowId?: string;
  previewUpdate?: Pick<
    CreatePdfPreviewUpdateAdapter,
    'beginGuardedEdit' | 'endGuardedEdit'
  >;
};

const normalizeSelectedNo = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeChoiceIndex = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  const next = Number(trimmed);
  if (!Number.isFinite(next) || next <= 0) return null;
  return next - 1;
};

const WorkbookTestTableRow = ({
  rowId = 'workbook-row',
  previewUpdate,
}: Props) => {
  const fixedId = useId();
  const pageBreakId = useId();
  const [committedSelectedNo, setCommittedSelectedNo] = useState<string | null>(
    null,
  );
  const [committedChoiceIndex, setCommittedChoiceIndex] = useState<
    number | null
  >(null);
  // staged input を local に閉じ、確定値だけを preview 更新対象へ流す。
  const [selectedNoInput, setSelectedNoInput] = useState<string | null>(null);
  const [choiceNoInput, setChoiceNoInput] = useState<string | null>(null);

  const selectedNoEditKey = `${rowId}:selected-no`;
  const choiceNoEditKey = `${rowId}:choice-no`;

  const finalizeSelectedNo = () => {
    setCommittedSelectedNo(normalizeSelectedNo(selectedNoInput ?? ''));
    setSelectedNoInput(null);
    previewUpdate?.endGuardedEdit(selectedNoEditKey);
  };

  const finalizeChoiceNo = () => {
    setCommittedChoiceIndex(normalizeChoiceIndex(choiceNoInput ?? ''));
    setChoiceNoInput(null);
    previewUpdate?.endGuardedEdit(choiceNoEditKey);
  };

  return (
    <TableRow>
      <TableCell>1</TableCell>
      <TableCell className="text-muted-foreground">
        大分類 &gt; 小分類
      </TableCell>
      <TableCell>
        <Input
          aria-label="問題No"
          className="h-7 w-16"
          onBlur={finalizeSelectedNo}
          onChange={(event) => setSelectedNoInput(event.target.value)}
          onFocus={() => {
            setSelectedNoInput(committedSelectedNo ?? '');
            previewUpdate?.beginGuardedEdit(selectedNoEditKey);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              finalizeSelectedNo();
            }
            if (event.key === 'Escape') {
              setSelectedNoInput(null);
              previewUpdate?.endGuardedEdit(selectedNoEditKey);
            }
          }}
          placeholder="--"
          type="number"
          value={selectedNoInput ?? committedSelectedNo ?? ''}
        />
      </TableCell>
      {/* 選択肢No: qaa 系モードのみ表示（UI確認用に常時表示） */}
      <TableCell>
        <Input
          aria-label="選択肢No"
          className="h-7 w-12"
          onBlur={finalizeChoiceNo}
          onChange={(event) => setChoiceNoInput(event.target.value)}
          onFocus={() => {
            setChoiceNoInput(
              committedChoiceIndex == null
                ? ''
                : String(committedChoiceIndex + 1),
            );
            previewUpdate?.beginGuardedEdit(choiceNoEditKey);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              finalizeChoiceNo();
            }
            if (event.key === 'Escape') {
              setChoiceNoInput(null);
              previewUpdate?.endGuardedEdit(choiceNoEditKey);
            }
          }}
          placeholder="--"
          type="number"
          value={
            choiceNoInput ??
            (committedChoiceIndex == null
              ? ''
              : String(committedChoiceIndex + 1))
          }
        />
      </TableCell>
      <TableCell>
        <Checkbox id={fixedId} />
      </TableCell>
      <TableCell>
        <Checkbox id={pageBreakId} />
      </TableCell>
    </TableRow>
  );
};

export default WorkbookTestTableRow;
