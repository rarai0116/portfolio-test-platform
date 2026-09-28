import StatusMessage from '@parts/statusMessage';

type Props = {
  drawBlocked: boolean;
  blockingMessage: string;
  /**
   * 抽選ブロックの主因が候補不足(draw-candidate-empty)か。
   * 未抽選時は候補不足エラーより空テーブル誘導を優先するため区別する。
   */
  isCandidateShortageBlock: boolean;
  /** 問題テーブルが未抽選（抽選済み行が無い）か */
  isNotDrawn: boolean;
  hasUnapplied: boolean;
  /** 抽選済みかつ条件変更なし → 完了メッセージ表示 */
  isDrawCompleted: boolean;
};

/**
 * ドローボタン横ステータス表示。
 * 優先順位:
 *   抽選前エラー(候補不足以外) > 未抽選(空テーブル誘導) > 候補不足エラー(再抽選) > 未反映 > 完了 > 表示なし
 */
const DrawStatusMessage = ({
  drawBlocked,
  blockingMessage,
  isCandidateShortageBlock,
  isNotDrawn,
  hasUnapplied,
  isDrawCompleted,
}: Props) => {
  // カテゴリ未設定・抽選準備中などセットアップ系ブロックは最優先で赤表示する
  if (drawBlocked && !isCandidateShortageBlock) {
    return <StatusMessage color="red" text={blockingMessage} />;
  }
  // 未抽選時は「まず抽選してください」を一次情報として表示する。
  // 候補不足ブロック（級変更直後のデータロード中など一時的なものを含む）はここに吸収する。
  if (isNotDrawn) {
    return (
      <StatusMessage
        color="gray"
        text="問題テーブルが空です。抽選を行ってください。"
      />
    );
  }
  // 抽選済みだが候補不足（再抽選が必要な状態）はブロックとして赤表示する
  if (drawBlocked) {
    return <StatusMessage color="red" text={blockingMessage} />;
  }
  if (hasUnapplied) {
    return <StatusMessage color="yellow" text="条件が変更されています。" />;
  }
  if (isDrawCompleted) {
    return <StatusMessage color="green" text="抽選が完了しました。" />;
  }
  return null;
};

export default DrawStatusMessage;
