import type {
  CreatePdfStatusReason,
  CreatePdfStatusReasonCode,
  CreatePdfStatusSeverity,
} from '@views/createPdf/types/statusState';

const DEFAULT_MESSAGES: Record<CreatePdfStatusReasonCode, string> = {
  'output-folder-missing': '出力先フォルダを選択してください',
  'test-table-empty': '問題テーブルが空です。抽選を行ってください。',
  'blank-row': '問題Noが未入力の行があります。',
  'qaa-choice-missing': '選択肢Noが未入力の行があります。',
  'invalid-no': '存在しない問題Noが指定されています。',
  'invalid-choice': '指定できない選択肢Noが含まれています。',
  'duplicate-question': '同一問題Noが複数行で指定されています。',
  'orphan-fixed-row': '削除済み条件に紐づく固定行があります。',
  'preview-window-closed':
    'プレビューウィンドウが閉じています。横のアイコンをクリックして再度開くことができます。',
  'preview-not-updated': 'プレビューに最新の内容が反映されていません。',
  'preview-committing': 'プレビューを更新中です。完了を待ってください。',
  'preview-rendering': '描画中です。完了を待ってください。',
  'preview-not-ready': '準備が完了していません。',
  'preview-target-mismatch':
    '別の対象を表示したプレビューウィンドウが開いています。',
  'preview-stale-revision':
    'プレビューの内容が古くなっています。更新ボタンを押すと最新の内容が反映されます。',
  'preview-has-issues': 'プレビューに未確定またはエラーが残っています。',
  'preview-unexpected-error': 'プレビューにエラーが発生しています。',
  exporting: 'PDFを作成中です。',
  'unapplied-draw-conditions':
    '現在の出力内容は最新の出題条件が反映されていません。出力前に内容を確認してください。',
  'draw-category-missing': '抽選条件が設定されていません。',
  'draw-bfs-calculating': '抽選準備中です。しばらくお待ちください',
  'draw-candidate-empty': '抽選対象の候補問題がありません。',
  'draw-fixed-count-exceeded': '固定行の数が条件の指定数を超えています。',
  'draw-engine-error': '指定の条件で抽選できない行があります。',
  'draw-validation-error':
    '指定の条件で抽選に失敗しました。条件を変えて抽選し直してください。',
  'subject-out-of-range': '指定された学科の対象外の問題Noが含まれています。',
};

export const createCreatePdfStatusReason = (params: {
  code: CreatePdfStatusReasonCode;
  severity: CreatePdfStatusSeverity;
  message?: string;
  target?: CreatePdfStatusReason['target'];
}): CreatePdfStatusReason => ({
  code: params.code,
  severity: params.severity,
  message: params.message ?? DEFAULT_MESSAGES[params.code],
  target: params.target,
});

export const dedupeStatusReasons = (
  reasons: readonly CreatePdfStatusReason[],
): CreatePdfStatusReason[] => {
  const seen = new Set<string>();
  const result: CreatePdfStatusReason[] = [];
  for (const reason of reasons) {
    const key = `${reason.code}:${reason.message}:${reason.target?.sectionId ?? ''}:${reason.target?.rowId ?? ''}:${reason.target?.conditionId ?? ''}:${reason.target?.slotId ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(reason);
  }
  return result;
};

export const toStatusMessages = (
  reasons: readonly CreatePdfStatusReason[],
): string[] => Array.from(new Set(reasons.map((reason) => reason.message)));
