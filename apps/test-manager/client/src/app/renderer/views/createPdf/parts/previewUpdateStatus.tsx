import { Button } from '@ui/button';
import type { CreatePdfPreviewUpdateStatus } from '@views/createPdf/types/previewUpdate';

type Props = {
  status: CreatePdfPreviewUpdateStatus;
  onManualCommit: () => Promise<void>;
};

const PreviewUpdateStatus = ({ status, onManualCommit }: Props) => {
  const isManualCommitDisabled =
    !status.hasCommitKey ||
    status.isCommitting ||
    status.isLoadingTestData ||
    status.activeGuardReasons.length > 0;

  return (
    <Button
      disabled={isManualCommitDisabled}
      onClick={() => {
        void onManualCommit();
      }}
      size="sm"
      variant="ghost"
    >
      {status.isCommitting
        ? '更新中...'
        : status.isLoadingTestData
          ? '問題データ読込中...'
          : 'プレビュー更新'}
    </Button>
  );
};

/*
    <div className="space-y-3 rounded border px-4 py-3 text-sm text-muted-foreground">
      <div className="flex items-center gap-3">
        <Button
          className="h-8"
          disabled={isManualCommitDisabled}
          onClick={() => {
            void onManualCommit();
          }}
          size="sm"
          variant="outline"
        >
          {status.isCommitting
            ? '更新中...'
            : status.isLoadingTestData
              ? '問題データ読込中...'
              : 'プレビューを更新'}
        </Button>
        {status.lastMeta && (
          <span>
            rev.{status.lastMeta.revision} / {status.lastMeta.updatedAt}
          </span>
        )}
      </div>

      {status.activeGuardReasons.length > 0 && (
        <div className="space-y-1">
          <p className="font-medium text-foreground">自動更新保留</p>
          <ul className="list-disc pl-5">
            {status.activeGuardReasons.map((reason) => (
              <li key={reason.id}>{reason.message}</li>
            ))}
          </ul>
        </div>
      )}

      {status.issues.length > 0 && (
        <div className="space-y-1">
          <p className="font-medium text-foreground">preview issues</p>
          <ul className="list-disc pl-5">
            {status.issues.map((issue) => (
              <li key={issue.id}>
                {issue.type}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
    */

export default PreviewUpdateStatus;
