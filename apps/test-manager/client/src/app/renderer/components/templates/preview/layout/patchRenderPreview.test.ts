import { describe, expect, it } from 'vitest';
import type {
  PreviewChangedFields,
  PreviewPatchPayload,
  PreviewResolvedPayload,
} from '@shared/types/preview';
import { patchPreviewDom } from './patchRenderPreview';

const buildResolvedPayload = (
  overrides: Partial<PreviewResolvedPayload> = {},
): PreviewResolvedPayload => ({
  id: 'item-1',
  subject: '学科Ⅰ',
  type: 'full',
  difficult: 1,
  question: {
    textHtml: '<p>問題文</p>',
    choices: [],
  },
  answer: {
    textHtml: '<p>解説文</p>',
    choices: [],
    answerNo: '1',
  },
  ...overrides,
});

const buildPatchPayload = (
  changed: PreviewChangedFields,
  overrides: Partial<PreviewPatchPayload> = {},
): PreviewPatchPayload => ({
  id: 'item-1',
  type: 'patch',
  changed,
  ...overrides,
});

// patchPreviewDom が参照する最小限のDOM構造
// (question-wrapper配下にdata-item-idを持つ要素があれば choice-group を解決できる)
const buildQuestionWrapperDocument = (choiceGroupInnerHtml = '') => {
  document.open();
  document.write(
    `<div class="question-wrapper"><div class="question-meta" data-item-id="item-1"></div><div class="choice-group">${choiceGroupInnerHtml}</div></div>`,
  );
  document.close();
  return document;
};

describe('patchPreviewDom の選択肢番号インデント分離', () => {
  it('選択肢が新規追加される場合、番号をchoice-index-mark spanに分離する', async () => {
    const doc = buildQuestionWrapperDocument();

    const prev = buildResolvedPayload();
    const next = buildResolvedPayload({
      question: {
        textHtml: '<p>問題文</p>',
        choices: ['<p class="ql-indent-2">選択肢本文</p>'],
      },
    });
    const patch = buildPatchPayload({ questionChoices: true });

    const applied = await patchPreviewDom(prev, next, patch, doc);
    expect(applied).toBe(true);

    const choiceP = doc.querySelector(
      '[data-item-id="item-1"][data-part="question-choice"][data-index="0"] p',
    );
    expect(choiceP).not.toBeNull();
    // ql-indent-Nは選択肢本文側にそのまま残る(本文のインデント自体は維持する)
    expect(choiceP?.classList.contains('ql-indent-2')).toBe(true);

    const mark = choiceP?.firstElementChild;
    expect(mark?.classList.contains('choice-index-mark')).toBe(true);
    expect(mark?.textContent).toBe('1．');
  });

  it('既存選択肢の内容だけが変わる場合も、番号をchoice-index-mark spanに分離する（sanitize経由）', async () => {
    const doc = buildQuestionWrapperDocument(
      '<div data-item-id="item-1" data-part="question-choice" data-index="0"><p><span class="choice-index-mark">1．</span>旧本文</p></div>',
    );

    const prev = buildResolvedPayload({
      question: { textHtml: '<p>問題文</p>', choices: ['<p>旧本文</p>'] },
    });
    const next = buildResolvedPayload({
      question: {
        textHtml: '<p>問題文</p>',
        choices: ['<p class="ql-indent-3">新本文</p>'],
      },
    });
    const patch = buildPatchPayload({ questionChoices: true });

    const applied = await patchPreviewDom(prev, next, patch, doc);
    expect(applied).toBe(true);

    const choiceP = doc.querySelector(
      '[data-item-id="item-1"][data-part="question-choice"][data-index="0"] p',
    );
    expect(choiceP).not.toBeNull();
    // sanitizeForPreviewRenderを経由してもql-indent-Nとchoice-index-markは除去されない
    expect(choiceP?.classList.contains('ql-indent-3')).toBe(true);

    const mark = choiceP?.firstElementChild;
    expect(mark?.classList.contains('choice-index-mark')).toBe(true);
    expect(mark?.textContent).toBe('1．');
    expect(choiceP?.textContent).toBe('1．新本文');
  });
});
