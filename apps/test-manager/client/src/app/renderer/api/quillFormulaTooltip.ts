import Quill from 'quill';

type TooltipLike = {
  root: HTMLDivElement;
  textbox: HTMLInputElement | null;
  edit: (mode?: string, preview?: string | null) => void;
  save: () => void;
  hide: () => void;
};

type ToolbarLike = {
  addHandler: (format: string, handler: (value: unknown) => void) => void;
};

type ThemeWithTooltip = {
  tooltip?: TooltipLike;
};

const isFormulaEditing = (tooltip: TooltipLike) => {
  return (
    tooltip.root.getAttribute('data-mode') === 'formula' &&
    tooltip.root.classList.contains('ql-editing')
  );
};

export function installFormulaTooltipExtension(quill: Quill): () => void {
  const theme = quill.theme as ThemeWithTooltip | undefined;
  const tooltip = theme?.tooltip;

  if (!tooltip) return () => undefined;
  if (tooltip.root.dataset.formulaTooltipExtended === 'true') {
    return () => undefined;
  }

  tooltip.root.dataset.formulaTooltipExtended = 'true';

  const state = {
    targetFormulaIndex: null as number | null,
    allowHideOnce: false,
  };

  const originalHide = tooltip.hide.bind(tooltip);
  const originalSave = tooltip.save.bind(tooltip);

  const removeAnchor = tooltip.root.querySelector(
    'a.ql-remove',
  ) as HTMLAnchorElement | null;

  const clearFormulaState = () => {
    state.targetFormulaIndex = null;
  };

  const forceHide = () => {
    state.allowHideOnce = true;
    try {
      // 変更点:
      // ql-editing が残ると CSS の display:flex が勝つため、先に外す
      tooltip.root.classList.remove('ql-editing');
      originalHide();
    } finally {
      state.allowHideOnce = false;
      clearFormulaState();
      if (tooltip.textbox) {
        tooltip.textbox.value = '';
      }
    }
  };

  const openFormulaEditor = (
    initialValue: string,
    targetFormulaIndex: number | null,
  ) => {
    state.targetFormulaIndex = targetFormulaIndex;

    if (targetFormulaIndex != null) {
      quill.setSelection(targetFormulaIndex, 1, 'silent');
    }

    tooltip.edit('formula');

    if (tooltip.textbox) {
      tooltip.textbox.value = initialValue;
      tooltip.textbox.focus();
      tooltip.textbox.select();
    }
  };

  const saveFormula = () => {
    const value = tooltip.textbox?.value?.trim() ?? '';
    if (!value) {
      forceHide();
      return;
    }

    if (state.targetFormulaIndex != null) {
      const index = state.targetFormulaIndex;
      quill.deleteText(index, 1, Quill.sources.USER);
      quill.insertEmbed(index, 'formula', value, Quill.sources.USER);
      quill.setSelection(index + 1, 0, 'silent');
      forceHide();
      return;
    }

    const range = quill.getSelection(true);
    const index = range
      ? range.index + range.length
      : Math.max(0, quill.getLength() - 1);

    quill.insertEmbed(index, 'formula', value, Quill.sources.USER);
    quill.insertText(index + 1, ' ', Quill.sources.USER);
    quill.setSelection(index + 2, 0, 'silent');
    forceHide();
  };

  tooltip.hide = () => {
    if (isFormulaEditing(tooltip) && !state.allowHideOnce) return;
    originalHide();
  };

  tooltip.save = () => {
    if (!isFormulaEditing(tooltip)) {
      originalSave();
      clearFormulaState();
      return;
    }
    saveFormula();
  };

  // 変更点:
  // 既存の a.ql-remove を formula 編集時の Close に使う
  const handleRemoveClick = (event: MouseEvent) => {
    if (!isFormulaEditing(tooltip)) return;
    event.preventDefault();
    event.stopPropagation();
    forceHide();
  };

  removeAnchor?.addEventListener('click', handleRemoveClick);

  const toolbar = quill.getModule('toolbar') as ToolbarLike | null;
  toolbar?.addHandler('formula', () => {
    openFormulaEditor('', null);
  });

  const handleFormulaClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const formulaEl = target?.closest('.ql-formula') as HTMLElement | null;

    if (!formulaEl) return;
    if (quill.root.getAttribute('contenteditable') === 'false') return;

    const value = formulaEl.getAttribute('data-value') ?? '';
    const formulaBlot = Quill.find(formulaEl) as
      | Parameters<Quill['getIndex']>[0]
      | null;

    if (!formulaBlot) return;

    const index = quill.getIndex(formulaBlot);

    event.preventDefault();
    event.stopPropagation();

    openFormulaEditor(value, index);
  };

  quill.root.addEventListener('click', handleFormulaClick);

  return () => {
    tooltip.hide = originalHide;
    tooltip.save = originalSave;
    quill.root.removeEventListener('click', handleFormulaClick);
    removeAnchor?.removeEventListener('click', handleRemoveClick);
    delete tooltip.root.dataset.formulaTooltipExtended;
    clearFormulaState();
  };
}
