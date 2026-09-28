import type { GradeId } from './contracts'; // 既存の GradeId を利用

export const EditorChannels = {
  insert: 'editor:insert',
} as const;

export type EditorInsertPayload = {
  grade: GradeId;
  key: string; // alt に入れる画像キー
  name?: string; // 表示名（必要なら）
  target?: 'current'; // 仕様拡張用（現状はフォーカス中へ）
};
