import { Table, TableBody, TableHead, TableHeader, TableRow } from '@ui/table';
import type { CreatePdfPreviewUpdateAdapter } from '@views/createPdf/types/previewUpdate';
import type { TestTableRow } from '@views/createPdf/types/testTable';
import WorkbookTestTableRow from './workbookTestTableRow';

type Props = {
  isDrawn: boolean;
  tableRows: TestTableRow[];
  previewUpdate?: Pick<
    CreatePdfPreviewUpdateAdapter,
    'beginGuardedEdit' | 'endGuardedEdit'
  >;
};

const WorkbookTestTable = ({ isDrawn, tableRows, previewUpdate }: Props) => {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-lg text-primary">問題テーブル</div>
      <div className="flex flex-col gap-3 px-2">
        <div className="overflow-x-auto">
          <Table className={` ${isDrawn ? '' : 'opacity-30'}`}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">No</TableHead>
                <TableHead>カテゴリ条件</TableHead>
                <TableHead className="w-20">問題No</TableHead>
                <TableHead className="w-20">選択肢No</TableHead>
                <TableHead className="w-12">固定</TableHead>
                <TableHead className="w-12">改ページ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.map((row) => (
                <WorkbookTestTableRow
                  key={row.id}
                  previewUpdate={previewUpdate}
                  rowId={row.id}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default WorkbookTestTable;
