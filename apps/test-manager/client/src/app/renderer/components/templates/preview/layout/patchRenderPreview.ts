import { sanitizeForPreviewRender } from '@api/htmlSanitizer';
import { realizeHtmlImages } from '@components/templates/preview/imageRealizer';
import type {
  PreviewChangedFields,
  PreviewPatchPayload,
  PreviewResolvedPayload,
  PreviewSetPayload,
} from '@shared/types/preview';
import {
  extractOrWrapParagraph,
  lightAdjustBlock,
} from '@templates/preview/layout/utils';

const isEmptyPreviewHtml = (html?: string) => {
  const normalized = (html ?? '').trim();
  return (
    normalized.length === 0 ||
    normalized === '<p><br></p>' ||
    normalized === '<p>　</p>'
  );
};

const showElement = (el: HTMLElement) => {
  el.classList.remove('empty-hide-block');
  el.style.display = '';
};

const hideElement = (el: HTMLElement) => {
  el.classList.add('empty-hide-block');
  el.style.display = 'none';
};

const syncChoiceGroupVisibility = (
  doc: Document,
  itemId: string,
  part: 'question-choice' | 'answer-choice',
  choices: (string | undefined)[],
) => {
  const group = ensureChoiceGroup(doc, itemId, part);
  if (!group) return;

  const hasVisibleChoice = choices.some(
    (choice) => !isEmptyPreviewHtml(choice),
  );

  if (hasVisibleChoice) {
    showElement(group);
  } else {
    hideElement(group);
  }
};

// 選択肢グループ取得/作成ヘルパー
const ensureChoiceGroup = (
  doc: Document,
  itemId: string,
  part: 'question-choice' | 'answer-choice',
): HTMLElement | null => {
  const wrapperSelector =
    part === 'question-choice'
      ? `.question-wrapper [data-item-id="${itemId}"]`
      : `.answer-wrapper [data-item-id="${itemId}"]`;

  const wrapper = doc
    .querySelector<HTMLElement>(wrapperSelector)
    ?.closest(
      part === 'question-choice' ? '.question-wrapper' : '.answer-wrapper',
    );

  if (!wrapper) return null;

  let group = wrapper.querySelector<HTMLElement>('.choice-group');
  if (!group) {
    group = doc.createElement('div');
    group.classList.add('sub-dividable-group', 'choice-group');
    wrapper.appendChild(group);
  }

  return group;
};

// 選択肢ブロックの生成ヘルパー
const createChoiceBlock = async (
  doc: Document,
  itemId: string,
  part: 'question-choice' | 'answer-choice',
  index: number,
  html?: string,
): Promise<HTMLElement> => {
  const blk = extractOrWrapParagraph(html || '', doc);

  // full 側（fullRenderPreview）と同じクラス構成に揃える。
  // choices-p / answers-p を付けると二重インデントになるため付けない。
  blk.classList.add(
    'sub-dividable-block',
    part === 'question-choice' ? 'question-choices-p' : 'answer-choices-p',
  );

  blk.dataset.part = part;
  blk.dataset.itemId = itemId;
  blk.dataset.index = String(index);

  const p = blk.getElementsByTagName('p')[0];
  const isEmpty = isEmptyPreviewHtml(html);

  if (isEmpty) {
    blk.innerHTML = '';
    hideElement(blk);
  } else {
    // 番号はspanで分離し、ql-indent-Nのpadding-leftが番号ごと右にずれないようにする（CSS側で相殺）
    p.innerHTML = `<span class="choice-index-mark">${index + 1}．</span>${p.innerHTML}`;
    showElement(blk);
  }

  await lightAdjustBlock(blk);
  return blk;
};

// 選択肢の追加/削除を同期
const syncChoiceCount = async (
  doc: Document,
  itemId: string,
  part: 'question-choice' | 'answer-choice',
  prevChoices: (string | undefined)[],
  nextChoices: (string | undefined)[],
) => {
  const group = ensureChoiceGroup(doc, itemId, part);
  if (!group) return;

  for (let i = nextChoices.length; i < prevChoices.length; i++) {
    const el = group.querySelector<HTMLElement>(
      `[data-item-id="${itemId}"][data-part="${part}"][data-index="${i}"]`,
    );
    if (el) el.remove();
  }

  // next に存在し prev に無い index を作成
  for (let i = 0; i < nextChoices.length; i++) {
    const exists = group.querySelector<HTMLElement>(
      `[data-item-id="${itemId}"][data-part="${part}"][data-index="${i}"]`,
    );
    if (!exists && nextChoices[i] !== undefined) {
      // full 側と同様に空選択肢でも hidden ブロックを生成する。
      // 空を skip すると、後から同 index に文字を入力しても対象要素が無く
      // updateHtmlPart が false で終わり編集が反映されない（Bug 3）。
      const blk = await createChoiceBlock(doc, itemId, part, i, nextChoices[i]);
      // 挿入位置: i より後ろの index を持つ最初の既存ブロックの前に入れる。
      // 新規作成直後は data-index=i の要素が存在しないため i 自身では探さない（Bug 2）。
      const followers: HTMLElement[] = Array.from(
        group.querySelectorAll<HTMLElement>(
          `[data-item-id="${itemId}"][data-part="${part}"][data-index]`,
        ),
      ).filter((el) => Number(el.dataset.index) > i);
      const anchor: HTMLElement | null =
        followers.length > 0 ? followers[0] : null;
      if (anchor && anchor.parentElement === group) {
        group.insertBefore(blk, anchor);
      } else {
        group.appendChild(blk);
      }
    }
  }
};

const setElementText = (
  el: HTMLElement | null | undefined,
  text: string,
): boolean => {
  if (!el) return false;
  if (el.textContent !== text) {
    el.textContent = text;
  }
  return true;
};

const getNumberPrefix = (text: string | null | undefined, fallback = '1．') => {
  const match = text?.match(/^\d+．/);
  return match?.[0] ?? fallback;
};

const getCategoryLabel = (payload: PreviewSetPayload) => {
  return payload.smallCategoryTag === 'なし'
    ? String(payload.bigCategoryTag ?? '')
    : String(payload.smallCategoryTag ?? '');
};

const getAnswerMetaYear = (payload: PreviewSetPayload) => {
  return `${payload.nengo === '平成' ? 'H' : 'R'}${String(
    payload.year ?? '',
  ).padStart(2, '0')}―${String(payload.testNo ?? '').padStart(2, '0')}`;
};

const hasChanged = (
  patch: PreviewPatchPayload,
  ...keys: Array<keyof PreviewChangedFields>
) => {
  return keys.some((key) => patch.changed[key] === true);
};

export const mergePreviewPayload = (
  base: PreviewResolvedPayload,
  patch: PreviewPatchPayload,
): PreviewResolvedPayload => {
  return {
    ...base,
    type: 'full',
    id: String(patch.id),
    subject: patch.subject ?? base.subject,
    bigCategoryTag: patch.bigCategoryTag ?? base.bigCategoryTag,
    smallCategoryTag: patch.smallCategoryTag ?? base.smallCategoryTag,
    nengo: patch.nengo ?? base.nengo,
    year: patch.year ?? base.year,
    testNo: patch.testNo ?? base.testNo,
    difficult: patch.difficult ?? base.difficult,
    question: {
      ...base.question,
      ...patch.question,
      choices: patch.question?.choices ?? base.question.choices,
    },
    answer: {
      ...base.answer,
      ...patch.answer,
      choices: patch.answer?.choices ?? base.answer.choices,
    },
    questionEditorType: patch.questionEditorType ?? base.questionEditorType,
    answerEditorType: patch.answerEditorType ?? base.answerEditorType,
    publicationYear: patch.publicationYear ?? base.publicationYear,
    publicationNo: patch.publicationNo ?? base.publicationNo,
    otherTags: patch.otherTags ?? base.otherTags,
    images: patch.images ?? base.images,
    options: patch.options ?? base.options,
  };
};

export const patchPreviewDom = async (
  prev: PreviewResolvedPayload,
  next: PreviewResolvedPayload,
  patch: PreviewPatchPayload,
  doc: Document,
): Promise<boolean> => {
  if (String(prev.id) !== String(next.id)) return false;

  // 構造（表示条件・area 構成・科目見出し）に影響する変更は patch の局所更新では
  // 追従しきれないため、full レンダリングに任せる（Bug 7）。
  if (
    hasChanged(
      patch,
      'subject',
      'questionEditorType',
      'answerEditorType',
      'options',
    )
  ) {
    return false;
  }

  const imagesMap = next.images ?? prev.images ?? {};
  const realize = (html?: string) => {
    const sanitizedHtml = sanitizeForPreviewRender(html || '').sanitizedHtml;
    return realizeHtmlImages(sanitizedHtml, imagesMap);
  };
  const itemId = String(next.id);

  // updateHtmlPart が 1 つでも対象要素を見つけられず失敗したら false を返し、
  // 呼び出し側（processPayload）の full フォールバックに乗せる（Bug 3 / Bug 7）。
  let allApplied = true;

  const updateHtmlPart = async (
    part: string,
    html?: string,
    index?: number,
    isSkippableEmpty?: boolean,
  ): Promise<boolean> => {
    const selector =
      index != null
        ? `[data-item-id="${itemId}"][data-part="${part}"][data-index="${index}"]`
        : `[data-item-id="${itemId}"][data-part="${part}"]`;

    const el = doc.querySelector<HTMLElement>(selector);
    if (!el) return false;

    if (index !== undefined) {
      if (isEmptyPreviewHtml(html)) {
        el.innerHTML = '';
        hideElement(el);
        return true;
      }

      const wrapped = extractOrWrapParagraph(html || '', doc);
      const pContents = wrapped.getElementsByTagName('p');
      const nextHtml = Array.from(pContents).reduce((acc, p, i) => {
        if (i === 0) {
          // 番号はspanで分離し、ql-indent-Nのpadding-leftが番号ごと右にずれないようにする（CSS側で相殺）
          p.innerHTML = `<span class="choice-index-mark">${index + 1}．</span>${p.innerHTML}`;
        }
        return `${acc}
${p.outerHTML}`;
      }, '');

      const newHtml = realize(nextHtml);
      if (el.innerHTML !== newHtml) {
        el.innerHTML = newHtml;
      }

      showElement(el);
      await lightAdjustBlock(el);
      return true;
    }

    if (
      isSkippableEmpty &&
      (!html || html.trim().length === 0 || html === '<p><br></p>')
    ) {
      el.innerHTML = '';
      hideElement(el);
      return true;
    }

    if (isEmptyPreviewHtml(html)) {
      el.innerHTML = '';
      hideElement(el);
      return true;
    }

    // full 側（fullRenderPreview の honbun 配置）と同じく top-level は付けない。
    // 付けると本文先頭段落のインデント・行組みが変わってしまう。
    const wrappedDiv = extractOrWrapParagraph(html || '', doc, undefined, {
      addTopLevel: false,
    });
    const newHtml = realize(wrappedDiv.innerHTML);
    if (el.innerHTML !== newHtml) {
      el.innerHTML = newHtml;
    }

    showElement(el);
    await lightAdjustBlock(el);
    return true;
  };

  if (hasChanged(patch, 'questionTextHtml')) {
    if (!(await updateHtmlPart('question-text', next.question.textHtml))) {
      allApplied = false;
    }
  }

  if (hasChanged(patch, 'questionChoices')) {
    const prevQChoices = prev.question.choices ?? [];
    const nextQChoices = next.question.choices ?? [];
    await syncChoiceCount(
      doc,
      itemId,
      'question-choice',
      prevQChoices,
      nextQChoices,
    );

    syncChoiceGroupVisibility(doc, itemId, 'question-choice', nextQChoices);

    const maxQ = Math.max(prevQChoices.length, nextQChoices.length);
    for (let i = 0; i < maxQ; i++) {
      if (prevQChoices[i] !== nextQChoices[i]) {
        if (!(await updateHtmlPart('question-choice', nextQChoices[i], i))) {
          allApplied = false;
        }
      }
    }
  }

  if (hasChanged(patch, 'answerChoices')) {
    const prevAChoices = prev.answer.choices ?? [];
    const nextAChoices = next.answer.choices ?? [];
    await syncChoiceCount(
      doc,
      itemId,
      'answer-choice',
      prevAChoices,
      nextAChoices,
    );

    syncChoiceGroupVisibility(doc, itemId, 'answer-choice', nextAChoices);

    const maxA = Math.max(prevAChoices.length, nextAChoices.length);
    for (let i = 0; i < maxA; i++) {
      if (prevAChoices[i] !== nextAChoices[i]) {
        if (
          !(await updateHtmlPart(
            'answer-choice',
            nextAChoices[i],
            i,
            next.answerEditorType === 'partialNoChoice',
          ))
        ) {
          allApplied = false;
        }
      }
    }
  }
  if (hasChanged(patch, 'answerTextHtml')) {
    if (!(await updateHtmlPart('answer-text', next.answer.textHtml))) {
      allApplied = false;
    }
  }

  if (hasChanged(patch, 'bigCategoryTag', 'smallCategoryTag')) {
    const nextCategoryLabel = getCategoryLabel(next);

    const coverCategoryEl = doc.querySelector<HTMLElement>('.category-wrapper');
    if (coverCategoryEl) {
      const prefix = getNumberPrefix(coverCategoryEl.textContent, '1．');
      setElementText(coverCategoryEl, `${prefix}${nextCategoryLabel}`);
    }

    const questionBody = doc.querySelector<HTMLElement>(
      `.question-body[data-item-id="${itemId}"]`,
    );
    const questionCategoryEl = questionBody?.previousElementSibling as
      | HTMLElement
      | undefined;
    if (questionCategoryEl?.classList.contains('subcategory-name')) {
      const prefix = getNumberPrefix(questionCategoryEl.textContent, '1．');
      setElementText(questionCategoryEl, `${prefix}${nextCategoryLabel}`);
    }

    const answerBody = doc.querySelector<HTMLElement>(
      `.answer-body[data-item-id="${itemId}"]`,
    );
    const answerCategoryEl = answerBody?.previousElementSibling as
      | HTMLElement
      | undefined;
    if (answerCategoryEl?.classList.contains('subcategory-name')) {
      const prefix = getNumberPrefix(answerCategoryEl.textContent, '1．');
      setElementText(answerCategoryEl, `${prefix}${nextCategoryLabel}`);
    }
  }

  if (hasChanged(patch, 'publicationNo', 'options')) {
    const prevNo = prev.options?.isOriginal
      ? prev.id
      : (prev.publicationNo ?? prev.id);
    const nextNo = next.options?.isOriginal
      ? next.id
      : (next.publicationNo ?? next.id);

    if (prevNo !== nextNo) {
      const el = doc.querySelector<HTMLElement>(
        `.question-wrapper .question-meta[data-item-id="${itemId}"] .no`,
      );
      if (el) {
        setElementText(el, `No．${nextNo}`);
      }
    }
  }

  if (hasChanged(patch, 'answerNo')) {
    const el = doc.querySelector<HTMLElement>(
      `.answer-wrapper .answer-meta[data-item-id="${itemId}"] .kotae`,
    );
    if (el) {
      setElementText(el, `答 ${next.answer.answerNo ?? ''}`);
    }
  }

  if (hasChanged(patch, 'difficult')) {
    const el = doc.querySelector<HTMLElement>(
      `.answer-wrapper .answer-meta[data-item-id="${itemId}"] .difficult`,
    );
    if (el) {
      // full 側（L513）と同じく負値ガードを入れて RangeError を防ぐ
      setElementText(el, `${'☆'.repeat(Math.max(0, next.difficult ?? 0))}`);
    }
  }

  if (hasChanged(patch, 'answerBool')) {
    // data-part="answer-mark" は createPdf 系レイアウトのみが生成する要素で、
    // testDataEditor の full レンダリング（layoutTestElements）は生成しない。
    // そのため testDataEditor 経由ではこの分岐は常に no-op（Bug 8）。
    const el = doc.querySelector<HTMLElement>(
      `[data-item-id="${itemId}"][data-part="answer-mark"]`,
    );
    if (el) {
      el.textContent = next.answer.answerBool ? '◯' : '✕';
    }
  }

  if (hasChanged(patch, 'nengo', 'year', 'testNo')) {
    const answerYearEl = doc.querySelector<HTMLElement>(
      `.answer-wrapper .answer-meta[data-item-id="${itemId}"] .year`,
    );
    if (answerYearEl) {
      setElementText(answerYearEl, getAnswerMetaYear(next));
    }
  }

  return allApplied;
};
