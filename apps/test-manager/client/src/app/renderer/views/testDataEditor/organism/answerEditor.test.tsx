import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { answerEditorType } from '@views/testDataEditor/store/useEditorTypeStore';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnswerEditor from './answerEditor';

// EditorはDOM存在確認のための簡易モック
vi.mock('@parts/editor', () => ({
  default: () => <div data-testid="mock-editor" />,
}));

import useSelectedIdStore from '@views/testDataEditor/store/useSelectedIdStore';
import useTestDataStore from '@views/testDataEditor/store/useTestDataStore';

vi.mock('@views/testDataEditor/store/useSelectedIdStore', () => ({
  default: vi.fn(),
}));
vi.mock('@views/testDataEditor/store/useTestDataStore', () => ({
  default: vi.fn(),
}));

describe('AnswerEditor', () => {
  const selectedDataId = 'dummy-id';
  const mockApplyEditPatch = vi.fn();

  const setStore = (type: answerEditorType) => {
    vi.mocked(useSelectedIdStore).mockReturnValue({
      selectedDataId,
    });
    vi.mocked(useTestDataStore).mockReturnValue({
      editMap: {
        [selectedDataId]: {
          data: {
            answerEditorType: type,
          },
        },
      },
      applyEditPatch: mockApplyEditPatch,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setStore(answerEditorType.normal);
  });

  const getAnswerBodyFrame = () => {
    const frame = screen.getAllByTestId('mock-editor')[0]?.parentElement;
    if (!frame) throw new Error('解説本文のエディタ枠が見つかりません');

    return frame;
  };

  it('通常モードの場合、解説本文と解答エディタが表示される', () => {
    render(<AnswerEditor isSecondGrade={true} />);
    expect(screen.getByText('解説本文')).toBeVisible();
    expect(screen.getByText('解答1')).toBeVisible();
    expect(screen.getByText('解答2')).toBeVisible();
    expect(screen.getByText('解答3')).toBeVisible();
    expect(screen.getByText('解答4')).toBeVisible();
    expect(screen.getByText('解答5')).toBeVisible();
  });

  it('解説本文なしモードの場合、解説本文が表示されない', () => {
    setStore(answerEditorType.noHonbun);
    render(<AnswerEditor />);
    //Vitest 環境で Tailwind CSS の hidden クラスが CSS として適用されていないため
    //toBeVisible() で要素が「見える」と判定される
    //expect(screen.getByText('解説本文')).not.toBeVisible();

    // 「hidden」クラスが付いていることを確認（CSSは実行されなくてもクラスは存在する）
    const container = screen.getByText('解説本文').closest('div');
    expect(container).toHaveClass('hidden');

    // 選択肢は通常表示
    expect(screen.getByText('解答1')).toBeVisible();
  });

  it('選択肢なしモードの場合、解答エディタが表示されない', () => {
    setStore(answerEditorType.noChoice);
    render(<AnswerEditor isSecondGrade={true} />);
    // 親コンテナで非表示になるため「可視でない」ことを検証

    expect(screen.getByText('解説本文')).toBeVisible();

    // 解答1-5 を含む親コンテナに hidden クラスが付いていることを確認
    const answersContainer = screen
      .getByText('解答1')
      .closest('div')?.parentElement;
    expect(answersContainer).toHaveClass('hidden');
  });

  it('一部選択肢なしモードの場合、解説本文と解答エディタが表示される', () => {
    setStore(answerEditorType.partialNoChoice);
    render(<AnswerEditor isSecondGrade={true} />);

    expect(screen.getByText('解説本文')).toBeVisible();
    expect(screen.getByText('解答1')).toBeVisible();
    expect(screen.getByLabelText('一部選択肢なし')).toBeChecked();
  });

  it('エディタの種類を切り替えられる', async () => {
    const user = userEvent.setup();
    render(<AnswerEditor />);
    const noHonbunRadio = screen.getByLabelText('解説本文なし');
    await user.click(noHonbunRadio);
    expect(mockApplyEditPatch).toHaveBeenCalledWith(selectedDataId, {
      answerEditorType: answerEditorType.noHonbun,
    });
  });

  it('一部選択肢なしに切り替えられる', async () => {
    const user = userEvent.setup();
    render(<AnswerEditor />);
    const partialNoChoiceRadio = screen.getByLabelText('一部選択肢なし');
    await user.click(partialNoChoiceRadio);
    expect(mockApplyEditPatch).toHaveBeenCalledWith(selectedDataId, {
      answerEditorType: answerEditorType.partialNoChoice,
    });
  });

  it('非アクティブでもエラーがある場合は赤枠になる', () => {
    render(
      <AnswerEditor
        invalidEditorKeys={new Set(['answerText'])}
        activeEditorKey={null}
      />,
    );

    expect(getAnswerBodyFrame()).toHaveClass('border-error-border');
    expect(getAnswerBodyFrame()).not.toHaveClass('border-transparent');
  });

  it('アクティブ時はエラーよりアクティブ枠を優先する', () => {
    render(
      <AnswerEditor
        invalidEditorKeys={new Set(['answerText'])}
        activeEditorKey="answerText"
      />,
    );

    expect(getAnswerBodyFrame()).toHaveClass('border-demoblue-100');
    expect(getAnswerBodyFrame()).not.toHaveClass('border-error-border');
  });
});
