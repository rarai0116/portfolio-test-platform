import { questionEditorType } from '@shared/types/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QuestionEditor from './questionEditor';

// Editorコンポーネントのモック
vi.mock('@parts/editor', () => ({
  default: () => <div data-testid="mock-editor" />,
}));

// ストアのモック
import useSelectedIdStore from '@views/testDataEditor/store/useSelectedIdStore';
import useTestDataStore from '@views/testDataEditor/store/useTestDataStore';

vi.mock('@views/testDataEditor/store/useSelectedIdStore', () => ({
  default: vi.fn(),
}));
vi.mock('@views/testDataEditor/store/useTestDataStore', () => ({
  default: vi.fn(),
}));

describe('QuestionEditor', () => {
  const selectedDataId = 'dummy-id';
  const mockApplyEditPatch = vi.fn();

  const setStore = (type: questionEditorType) => {
    vi.mocked(useSelectedIdStore).mockReturnValue({
      selectedDataId,
    });
    vi.mocked(useTestDataStore).mockReturnValue({
      editMap: {
        [selectedDataId]: {
          data: {
            questionEditorType: type,
          },
        },
      },
      applyEditPatch: mockApplyEditPatch,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setStore(questionEditorType.normal);
  });

  const getQuestionBodyFrame = () => {
    const frame = screen.getAllByTestId('mock-editor')[0]?.parentElement;
    if (!frame) throw new Error('問題本文のエディタ枠が見つかりません');

    return frame;
  };

  it('問題本文エディタが表示される', () => {
    render(<QuestionEditor />);
    expect(screen.getByText('問題本文')).toBeVisible();
  });

  it('通常モードの場合、選択肢エディタが表示される', () => {
    render(<QuestionEditor />);
    expect(screen.getByText('選択肢1')).toBeVisible();
    expect(screen.getByText('選択肢2')).toBeVisible();
    expect(screen.getByText('選択肢3')).toBeVisible();
    expect(screen.getByText('選択肢4')).toBeVisible();
  });

  it('第二級の場合、選択肢5が表示される', () => {
    render(<QuestionEditor isSecondGrade />);
    expect(screen.getByText('選択肢5')).toBeVisible();
  });

  it('選択肢なしモードの場合、選択肢エディタが表示されない', () => {
    setStore(questionEditorType.noChoice);
    render(<QuestionEditor isSecondGrade />);
    // 親コンテナで非表示になるため「可視でない」ことを検証
    expect(screen.getByText('問題本文')).toBeVisible();
    // 選択肢1-5 を含む親コンテナに hidden クラスが付いていることを確認
    const answersContainer = screen
      .getByText('選択肢1')
      .closest('div')?.parentElement;
    expect(answersContainer).toHaveClass('hidden');
  });

  it('エディタの種類を切り替えられる', async () => {
    const user = userEvent.setup();
    render(<QuestionEditor />);
    const noChoiceRadio = screen.getByLabelText('選択肢なし');
    await user.click(noChoiceRadio);
    expect(mockApplyEditPatch).toHaveBeenCalledWith(selectedDataId, {
      questionEditorType: questionEditorType.noChoice,
    });
  });

  it('非アクティブでもエラーがある場合は赤枠になる', () => {
    render(
      <QuestionEditor
        invalidEditorKeys={new Set(['text'])}
        activeEditorKey={null}
      />,
    );

    expect(getQuestionBodyFrame()).toHaveClass('border-error-border');
    expect(getQuestionBodyFrame()).not.toHaveClass('border-transparent');
  });

  it('アクティブ時はエラーよりアクティブ枠を優先する', () => {
    render(
      <QuestionEditor
        invalidEditorKeys={new Set(['text'])}
        activeEditorKey="text"
      />,
    );

    expect(getQuestionBodyFrame()).toHaveClass('border-demoblue-100');
    expect(getQuestionBodyFrame()).not.toHaveClass('border-error-border');
  });
});
