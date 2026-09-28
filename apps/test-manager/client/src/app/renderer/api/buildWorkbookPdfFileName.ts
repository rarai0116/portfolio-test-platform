import type { CreatePdfWorkbookMode } from '@shared/types/pdfPreview';

const workbookModeLabels: Record<CreatePdfWorkbookMode, string> = {
  qaa: '一問一答',
  qaaAllTrue: '一問一答（全て◯）',
  qaaAllFalse: '一問一答（全て×）',
  multipleChoice: '選択問題',
};

export const normalizeWorkbookPdfTitle = (title: string): string =>
  title.trim() || 'タイトル未入力';

export const buildWorkbookPdfFileName = ({
  grade,
  title,
  workbookMode,
}: {
  grade: 1 | 2;
  title: string;
  workbookMode: CreatePdfWorkbookMode | null;
}): string => {
  const modeLabel = workbookMode ? workbookModeLabels[workbookMode] : '未設定';

  return `問題集_${grade}級_${modeLabel}_${normalizeWorkbookPdfTitle(title)}.pdf`;
};
