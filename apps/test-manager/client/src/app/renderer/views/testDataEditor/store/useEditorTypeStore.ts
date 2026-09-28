import {
  type answerEditorType as _AnswerEditorType,
  answerEditorType as _answerEditorType,
  type questionEditorType as _QuestionEditorType,
  questionEditorType as _questionEditorType,
} from '@shared/types/contracts';
import { create } from 'zustand';

// 参照変更がコストかかりすぎるため、型はcontractsに直リンク
export const questionEditorType = _questionEditorType;
export type questionEditorType = _QuestionEditorType;
export const answerEditorType = _answerEditorType;
export type answerEditorType = _AnswerEditorType;

type EditorTypeState = {
  questionEditor: questionEditorType;
  setQuestionEditor: (type: questionEditorType) => void;
  answerEditor: answerEditorType;
  setAnswerEditor: (type: answerEditorType) => void;
};

const useEditorTypeStore = create<EditorTypeState>((set) => ({
  questionEditor: questionEditorType.normal,
  setQuestionEditor: (questionEditor) => set({ questionEditor }),
  answerEditor: answerEditorType.normal,
  setAnswerEditor: (answerEditor) => set({ answerEditor }),
}));

export default useEditorTypeStore;
