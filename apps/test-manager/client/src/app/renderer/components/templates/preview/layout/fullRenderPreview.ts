/**
 * fullRenderPreviewは、tmp-answer-container/tmp-question-container内にPreviewItemの内容を整形して配置してレンダリングして
 * それぞれの分割可能可能要素(クラス:sub-dividable-**)の高さを計測・計算し、本番用コンテナ(answer-container/question-container)にsectionで改ページを行うスクリプト
 *
 *
 * <<クラスごとの役割表>>
 * Area...学科ごとの集まり
 * Wrapper...「そのセクションの」問題/解説1問のまとまり。問題/解説がセクションを飛び越える場合は、その都度Wrapperでまとめる
 * Title-Parent...問題/解説のタイトル(学科Ⅳ（構造）解説)
 * num-to-ichimonme...No.1 答2などのような番号などメタ情報部分
 * sub-dividable-group...分割可能なグループ。基本的には問題文全体、選択肢全体、解説文全体、メタ情報全てで1グループ。
 * sub-dividable-block...分割可能なブロック。グループをさらに概念で分割。本文全体、一つ一つの選択肢など。
 * sub-dividable-sentence...分割可能なセンテンス。最小単位。改行や画像丸ごとなど。センテンスが改ページで分割されることはない。
 */
/**
 * デバッグコマンド
 * 不足px表示
 * const frame = document.querySelector('iframe');
 frame?.contentDocument?.documentElement.setAttribute(
  'data-show-paginate-debug',
  '1',
);
 * シェル表示
 * const frame = document.querySelector('iframe');
frame?.contentDocument?.documentElement.setAttribute(
  'data-show-measure-shells'',
  '1',
);
 * 
 */
/* 追加クラス
 * answers-p→choices-block(変更)選択肢全体のブロック
 */

import { buildItemSeedStr, shuffleWithSeed } from '@api/shuffleSeed';
import { extractImageIdsFromHtml } from '@api/utils';
import type { TestSubject } from '@shared/types/contracts';
import type { ImageAssetMap } from '@stores/useImageAssetStore';
import { subjectSirializer } from '@templates/preview/layout/examCoverAssetUrls';
import { renderExamPreview } from '@templates/preview/layout/renderExamPreview';
import { realizeHtmlImages } from '../imageRealizer';
import { addCover } from './adjustTestCover';
import { paginateArea } from './paginateArea';
import type { LayoutState, PageMapEntry, PreviewItem } from './types';
import { extractOrWrapParagraph, lightAdjustBlock } from './utils';

/* ページごとのiemIdとページ番号の対応を保持するマップ */
const pageMapByItemId = new Map<string, PageMapEntry>();

type PageRange = {
  startPage: number;
  endPage: number;
};

type TocRow = {
  questionRange: PageRange;
  answerRange: PageRange;
};

const toCategoryKey = (subject: string, smallCategory: string) =>
  `${subject}\u0000${smallCategory}`;

const normalizePaginatePageCount = (nextPage: number) =>
  Math.max(0, nextPage - 1);

const getLeadingNumberedPageCount = (state: LayoutState) =>
  // workbook の表紙テンプレートは、無番号の表紙 1 枚 + 番号付き空白ページ 1 枚で構成される。
  // TOC のページ番号は後者から数え始めるため、表紙がある時だけ 1 ページ分を前に足す。
  state.options.hasCover ? 1 : 0;

const canRealizeHtmlImages = (
  html: string,
  images: ImageAssetMap | undefined,
): boolean => {
  const imageIds = extractImageIdsFromHtml(html);
  if (imageIds.length === 0) return false;
  if (!images) return false;

  return imageIds.every((imageId) => {
    const asset = images[imageId];
    if (!asset?.url) return false;
    return (
      asset.width != null &&
      asset.height != null &&
      asset.width > 0 &&
      asset.height > 0
    );
  });
};

const prepareLayoutHtml = (
  html: string,
  state: LayoutState,
  images: ImageAssetMap | undefined,
): string => {
  if (state.htmlImageState?.realized === true) return html;
  if (!canRealizeHtmlImages(html, images)) return html;
  if (!images) return html;
  return realizeHtmlImages(html, images);
};

const formatPageRange = ({ startPage, endPage }: PageRange) =>
  startPage >= endPage ? `P.${startPage}` : `P.${startPage}〜P.${endPage}`;

const buildSectionStartPages = (
  bySubject: ReturnType<typeof configureBySubject>,
  pageCountsBySubject: Map<string, number>,
  firstPage: number,
) => {
  const startPages = new Map<string, number>();
  let nextPage = firstPage;

  for (const [subject] of bySubject.entries()) {
    startPages.set(subject, nextPage);
    nextPage += pageCountsBySubject.get(subject) ?? 0;
  }

  return startPages;
};

const buildFirstEntryByCategory = () => {
  const firstEntryByCategory = new Map<string, PageMapEntry>();

  for (const entry of pageMapByItemId.values()) {
    const key = toCategoryKey(entry.subject, entry.smallCategory);
    const existing = firstEntryByCategory.get(key);

    if (!existing || entry.questionIndex < existing.questionIndex) {
      firstEntryByCategory.set(key, entry);
    }
  }

  return firstEntryByCategory;
};

const buildFallbackCategoryStartPages = (
  bySubject: ReturnType<typeof configureBySubject>,
  firstEntryByCategory: Map<string, PageMapEntry>,
  pageCountsBySubject: Map<string, number>,
  pageField: 'questionPage' | 'answerPage',
  firstPage: number,
) => {
  const sectionStartPages = buildSectionStartPages(
    bySubject,
    pageCountsBySubject,
    firstPage,
  );
  const startPages = new Map<string, number>();

  for (const [subject, catMap] of bySubject.entries()) {
    const sectionStart = sectionStartPages.get(subject) ?? firstPage;

    for (const [smallCategory] of catMap.entries()) {
      const key = toCategoryKey(subject, smallCategory);
      const firstEntry = firstEntryByCategory.get(key);
      const localPage = firstEntry?.[pageField];

      if (localPage !== undefined) {
        startPages.set(key, sectionStart + localPage - 1);
      }
    }
  }

  return startPages;
};

const collectRenderedCategoryStartPages = (
  container: HTMLElement | null,
  pageOffset: number,
) => {
  const startPages = new Map<string, number>();
  if (!container) return startPages;

  // 先頭見出しが単独ページになっても拾えるように、実際に描画された見出し位置を TOC の起点に使う。
  Array.from(container.children).forEach((section, index) => {
    const headings = Array.from(
      (section as HTMLElement).getElementsByClassName(
        'subcategory-name',
      ) as HTMLCollectionOf<HTMLElement>,
    );

    headings.forEach((heading) => {
      const subject = heading.dataset.subject;
      const smallCategory = heading.dataset.smallCategory;
      if (subject === undefined || smallCategory === undefined) return;

      const key = toCategoryKey(subject, smallCategory);
      if (!startPages.has(key)) {
        startPages.set(key, pageOffset + index + 1);
      }
    });
  });

  return startPages;
};

const buildTocRowsBySubject = (
  root: Document,
  bySubject: ReturnType<typeof configureBySubject>,
  questionPageCounts: Map<string, number>,
  answerPageCounts: Map<string, number>,
  leadingNumberedPageCount: number,
) => {
  const totalQuestionPages = Array.from(questionPageCounts.values()).reduce(
    (sum, pageCount) => sum + pageCount,
    0,
  );
  const totalAnswerPages = Array.from(answerPageCounts.values()).reduce(
    (sum, pageCount) => sum + pageCount,
    0,
  );
  const firstEntryByCategory = buildFirstEntryByCategory();

  const fallbackQuestionStarts = buildFallbackCategoryStartPages(
    bySubject,
    firstEntryByCategory,
    questionPageCounts,
    'questionPage',
    leadingNumberedPageCount + 1,
  );
  const fallbackAnswerStarts = buildFallbackCategoryStartPages(
    bySubject,
    firstEntryByCategory,
    answerPageCounts,
    'answerPage',
    leadingNumberedPageCount + totalQuestionPages + 1,
  );

  const renderedQuestionStarts = collectRenderedCategoryStartPages(
    root.getElementById('question-container') as HTMLElement | null,
    leadingNumberedPageCount,
  );
  const renderedAnswerStarts = collectRenderedCategoryStartPages(
    root.getElementById('answer-container') as HTMLElement | null,
    leadingNumberedPageCount + totalQuestionPages,
  );

  const orderedCategories: Array<{
    subject: string;
    questionStart?: number;
    answerStart?: number;
  }> = [];

  for (const [subject, catMap] of bySubject.entries()) {
    for (const [smallCategory] of catMap.entries()) {
      const key = toCategoryKey(subject, smallCategory);
      orderedCategories.push({
        subject,
        questionStart:
          renderedQuestionStarts.get(key) ?? fallbackQuestionStarts.get(key),
        answerStart:
          renderedAnswerStarts.get(key) ?? fallbackAnswerStarts.get(key),
      });
    }
  }

  const rowsBySubject = new Map<string, TocRow[]>();

  orderedCategories.forEach((current, index) => {
    if (
      current.questionStart === undefined ||
      current.answerStart === undefined
    ) {
      return;
    }

    const next = orderedCategories[index + 1];
    const questionEnd =
      (next?.questionStart ??
        leadingNumberedPageCount + totalQuestionPages + 1) - 1;
    const answerEnd =
      (next?.answerStart ??
        leadingNumberedPageCount + totalQuestionPages + totalAnswerPages + 1) -
      1;

    const rows = rowsBySubject.get(current.subject) ?? [];
    rows.push({
      questionRange: {
        startPage: current.questionStart,
        endPage: questionEnd,
      },
      answerRange: {
        startPage: current.answerStart,
        endPage: answerEnd,
      },
    });
    rowsBySubject.set(current.subject, rows);
  });

  return rowsBySubject;
};

const applyPreviewCssVars = (root: Document, state: LayoutState) => {
  const size = state.options.page?.size ?? 'A4';
  const page =
    size === 'B5'
      ? {
          widthMm: 176,
          heightMm: 245,
          imageScale: 0.16,
          fontSizePt: 10,
          padTop: 0,
          padRight: 0,
          padLeft: 0,
          padBottom: 0,
        }
      : {
          widthMm: 210,
          heightMm: 297,
          imageScale: 0.2,
          fontSizePt: 12,
          padTop: 10,
          padRight: 20,
          padLeft: 10,
          padBottom: 0,
        };

  const docEl = root.documentElement;
  docEl.style.setProperty('--page-width-mm', String(page.widthMm));
  docEl.style.setProperty('--page-height-mm', String(page.heightMm));
  docEl.style.setProperty('--font-size-pt', String(page.fontSizePt));
  docEl.style.setProperty('--wrapper-pad-top-mm', String(page.padTop));
  docEl.style.setProperty('--wrapper-pad-right-mm', String(page.padRight));
  docEl.style.setProperty('--image-scale', String(page.imageScale));
  docEl.style.setProperty('--wrapper-pad-bottom-mm', String(page.padBottom));
  docEl.style.setProperty('--wrapper-pad-left-mm', String(page.padLeft));
  docEl.style.setProperty('--page-footer-reserve-mm', '15');
};

export const addDataId = (
  element: HTMLElement,
  itemId: string,
  part: string,
  index?: number,
) => {
  element.dataset.itemId = itemId;
  element.dataset.part = part;
  if (index !== undefined) {
    element.dataset.index = String(index);
  }
};

export const appendExamSubjectHeading = (
  subject: string,
  qArea: HTMLElement,
  aArea: HTMLElement,
  root: Document,
  state: LayoutState,
) => {
  if (state.options.creationType !== 'exam') {
    return;
  }

  const gradeNumber = state.options.gradeNumber;
  if (gradeNumber === undefined)
    throw new Error('Grade number is required for exam preview');
  const subjectLabel = subjectSirializer(gradeNumber, subject as TestSubject);

  // area 直下の単独ノードとして置くことで、見出し自体に heighter を持たせたまま高さ計測できる。
  const questionTitle = root.createElement('p');
  questionTitle.classList.add('question-sub-title', 'sub-dividable-sentence');
  questionTitle.textContent = subjectLabel;

  const answerTitle = root.createElement('p');
  answerTitle.classList.add('answer-sub-title', 'sub-dividable-sentence');
  answerTitle.textContent = `${subjectLabel}解説`;

  if (state.options.mode !== 'onlyAnswer') {
    qArea.appendChild(questionTitle);
  }
  if (state.options.mode !== 'onlyQuestion') {
    aArea.appendChild(answerTitle);
  }
};

// tmpコンテナにPreviewItemを整形して配置する
export const configureBySubject = (state: LayoutState) => {
  // bySubjectでグループを作る
  const bySubject = new Map<string, Map<string, LayoutState['items']>>();

  for (const item of state.items) {
    const subject = item.subject || '';
    const small = item.smallCategoryTag || '';
    if (!bySubject.has(subject)) {
      bySubject.set(subject, new Map());
    }
    const catMap = bySubject.get(subject);
    if (catMap && !catMap.has(small)) {
      catMap.set(small, []);
    }
    catMap?.get(small)?.push(item);
  }
  // console.log('Grouped items by subject and category:', bySubject);
  return bySubject;
};

// 小カテゴリの見出し作成・配置
export const appendSubcategoryHeading = (
  smallCategory: string,
  qArea: HTMLElement,
  aArea: HTMLElement,
  root: Document,
  state: LayoutState,
  subject: string,
  sNo: number,
) => {
  const subQ = root.createElement('p');
  const item = state.items[0];
  subQ.classList.add('subcategory-name', 'test-section-div');
  subQ.dataset.subject = subject;
  subQ.dataset.smallCategory = smallCategory;
  subQ.innerText = `${sNo}．${
    smallCategory === 'なし' ? String(item.bigCategoryTag || '') : smallCategory
  }`;

  const subA = subQ.cloneNode(true) as HTMLElement;

  if (state.options.mode !== 'onlyAnswer') {
    qArea.appendChild(subQ);
  }
  if (state.options.mode !== 'onlyQuestion') {
    aArea.appendChild(subA);
  }
};

// 一問を要素ごとに配置
export const layoutTestElements = async ({
  prefix,
  root,
  state,
  subject,
  sNo,
  mNo,
  item,
  images,
}: {
  prefix: 'answer' | 'question';
  root: Document;
  state: LayoutState;
  subject: string;
  sNo: number;
  mNo: number;
  item: PreviewItem;
  images?: ImageAssetMap;
}) => {
  const temp = root.getElementById(`tmp-${prefix}`);
  if (!temp) throw new Error(`tmp-${prefix} template not found`);
  const exp = temp.cloneNode(true) as HTMLElement;
  exp.id = `${prefix}-${subject}-${sNo}-${mNo}`;
  exp.classList.remove('tmp');
  exp.classList.add(
    `${prefix}-column-${subject}-${sNo}`,
    `${prefix}-body`,
    `${prefix}-wrapper`,
  );

  exp.dataset.itemId = item.id;

  // forcePageBreak が true の場合、paginateArea 側で改ページトリガーとして参照する
  if (prefix === 'answer' && item.forcePageBreak) {
    exp.dataset.forcePageBreak = '1';
  }

  // PageMapEntry に answerNodeId を記録
  const entry = pageMapByItemId.get(item.id);
  if (entry) {
    if (prefix === 'answer') {
      entry.answerNodeId = exp.id;
    } else {
      entry.questionNodeId = exp.id;
    }
    pageMapByItemId.set(item.id, entry);
  }

  // メタ情報の配置
  const meta = exp.querySelector(`.${prefix}-meta`) as HTMLElement | null;
  if (!meta) throw new Error(`${prefix} meta element not found`);
  addDataId(meta, item.id, `${prefix}-meta`);
  let no = '';
  if (state.options.isSerialNumber) {
    no = `${mNo}`;
  } else {
    no = state.options.isOriginal ? item.id : item.publicationNo || item.id;
  }

  const num = meta.querySelector('.no') as HTMLElement;
  num.innerHTML = `No．${no}`;
  let isQaa = false;

  if (prefix === 'answer') {
    // 解説
    // qaa 系（一問一答・全部○・全部×）か否かを判定
    isQaa =
      state.options.creationType === 'workbook' &&
      state.options.workbookMode !== 'multipleChoice';
    //答え
    const kotae = meta.querySelector('.kotae') as HTMLElement;
    if (isQaa) {
      // 一問一答: answerBool で ◯/✕ のみ表示
      kotae.innerHTML = item.answerBool ? '◯' : '✕';
    } else {
      kotae.innerHTML = `答 ${item.answerNo}`;
    }
    // 年号・年度
    if (!state.options.hasNoNengoAndYear) {
      const year = meta.querySelector('.year') as HTMLElement;
      year.innerHTML = `${item.nengo === '平成' ? 'H' : 'R'}${String(item.year).padStart(2, '0')}―${String(item.testNo).padStart(2, '0')}`;
    }

    // 難易度: qaa 系では非表示
    if (!isQaa && !state.options.hasNoDifficult) {
      const difficult = meta.querySelector('.difficult') as HTMLElement;
      difficult.innerHTML = '☆'.repeat(Math.max(0, item.difficult));
    } else if (isQaa) {
      const difficult = meta.querySelector('.difficult') as HTMLElement | null;
      if (difficult) difficult.innerHTML = '';
    }
  } else {
    // 問題
    if (
      !state.options.creationType ||
      state.options.creationType === 'workbook'
    ) {
      // Noの横に表示を追加
      const display = meta.querySelector('.no-display') as HTMLElement;
      display.innerHTML = `　□□□`;
    }
  }

  const questionEditorType =
    item.questionEditorType ?? state.options.questionEditorType;
  const answerEditorType =
    item.answerEditorType ?? state.options.answerEditorType;

  // 本文グループの配置
  const hasHonbun =
    prefix === 'answer'
      ? (answerEditorType !== 'noHonbun' || isQaa) &&
        item.answerTextHtml &&
        item.answerTextHtml.length > 0
      : item.textHtml && item.textHtml.length > 0;
  const html = prefix === 'answer' ? item.answerTextHtml : item.textHtml;
  const honbun = exp.querySelector(`.${prefix}-honbun`) as HTMLElement;

  // ここは常に付与しておく
  addDataId(honbun, item.id, `${prefix}-text`);

  if (hasHonbun) {
    const realizedHtml = prepareLayoutHtml(html || '', state, images);
    extractOrWrapParagraph(realizedHtml, root, honbun, { addTopLevel: false });
    honbun.classList.remove('empty-hide-block');
    honbun.style.display = '';
  } else {
    honbun.classList.add('empty-hide-block');
    honbun.style.display = 'none';
  }

  // 選択肢グループの配置
  const hasChoices =
    prefix === 'answer'
      ? answerEditorType !== 'noChoice' &&
        item.answerChoicesHtml &&
        item.answerChoicesHtml.length > 0
      : questionEditorType !== 'noChoice' &&
        item.questionChoicesHtml &&
        item.questionChoicesHtml.length > 0;

  const choiceGroup = exp.querySelector('.choice-group') as HTMLElement;

  const isEmptyChoiceHtml = (value?: string) => {
    const normalized = (value ?? '').trim();
    return (
      normalized.length === 0 ||
      normalized === '<p><br></p>' ||
      normalized === '<p>　</p>'
    );
  };

  if (hasChoices) {
    const choicesHtml =
      prefix === 'answer' ? item.answerChoicesHtml : item.questionChoicesHtml;
    const normalizedChoices = choicesHtml ?? [];

    // シャッフル適用判定: buildItem 側で完結済みのためここでは shuffleSeed の値だけを見る
    const shouldShuffle =
      item.shuffleSeed !== undefined && item.shuffleSeed !== 0;
    let orderedChoices = normalizedChoices;
    if (shouldShuffle && item.shuffleSeed) {
      const itemSeedStr = buildItemSeedStr(item.shuffleSeed, item.id);
      const { shuffled, permutation } = shuffleWithSeed(
        normalizedChoices,
        itemSeedStr,
      );
      orderedChoices = shuffled;
      // answer 側: permutation から newAnswerNo を算出して kotae 表示を更新する
      if (prefix === 'answer' && !isQaa) {
        const origAnswerIdx = parseInt(item.answerNo, 10) - 1;
        if (origAnswerIdx >= 0 && origAnswerIdx < permutation.length) {
          const inversePermutation = new Array<number>(permutation.length);
          for (let k = 0; k < permutation.length; k++) {
            inversePermutation[permutation[k] as number] = k;
          }
          const newAnswerNo = String(
            (inversePermutation[origAnswerIdx] as number) + 1,
          );
          const kotae = meta?.querySelector('.kotae') as HTMLElement | null;
          if (kotae) kotae.innerHTML = `答 ${newAnswerNo}`;
        }
      }
    }

    let hasVisibleChoice = false;

    for (let idx = 0; idx < orderedChoices.length; idx++) {
      const html = orderedChoices[idx] ?? '';
      const realizedHtml = prepareLayoutHtml(html, state, images);
      const choiceBlock = extractOrWrapParagraph(realizedHtml, root);
      choiceBlock.classList.add('sub-dividable-block', `${prefix}-choices-p`);

      const p = choiceBlock.getElementsByTagName('p')[0];
      const isEmpty = isEmptyChoiceHtml(html);

      if (isEmpty) {
        choiceBlock.classList.add('empty-hide-block');
        choiceBlock.style.display = 'none';
      } else {
        hasVisibleChoice = true;
        // 番号はspanで分離し、ql-indent-Nのpadding-leftが番号ごと右にずれないようにする（CSS側で相殺）
        p.innerHTML = `<span class="choice-index-mark">${idx + 1}．</span>${p.innerHTML}`;
        choiceBlock.classList.remove('empty-hide-block');
        choiceBlock.style.display = '';
      }

      addDataId(choiceBlock, item.id, `${prefix}-choice`, idx);

      await lightAdjustBlock(choiceBlock, { divide: false });
      choiceGroup.appendChild(choiceBlock);
    }

    if (hasVisibleChoice) {
      choiceGroup.classList.remove('empty-hide-block');
      choiceGroup.style.display = '';
    } else {
      choiceGroup.classList.add('empty-hide-block');
      choiceGroup.style.display = 'none';
    }
  } else {
    // 選択肢がない場合はグループごと非表示
    choiceGroup.classList.add('empty-hide-block');
    choiceGroup.style.display = 'none';
  }
  return exp;
};

// tmpコンテナに各問題・解説を整形して配置する
export const layoutTmpTest = async (
  state: LayoutState,
  root: Document,
  bySubject: ReturnType<typeof configureBySubject>,
  images?: ImageAssetMap,
) => {
  const tmpQuestionContainer = root.getElementById('tmp-question-container');
  if (!tmpQuestionContainer)
    throw new Error('tmp-question-container not found');
  const tmpAnswerContainer = root.getElementById('tmp-answer-container');
  if (!tmpAnswerContainer) throw new Error('tmp-answer-container not found');

  // コンテナの初期化
  tmpQuestionContainer.innerHTML = '';
  tmpAnswerContainer.innerHTML = '';

  // 各subjectごとに問題・解説を整形してtmpコンテナに配置
  for (const [subject, catMap] of bySubject.entries()) {
    // 表紙（必要時）
    if (state.options.hasCover) {
      const titleContainer = root.getElementById('title-container');
      if (!titleContainer) throw new Error('title-container not found');
      addCover(bySubject, root, titleContainer, state);
    }

    const qArea = root.createElement('div');
    qArea.id = `question-area-${subject}`;
    /*
    qArea.style.padding = '10mm 15mm 0 15mm';
    qArea.style.position = 'relative';
    */
    qArea.classList.add('measure-page-shell');

    const aArea = root.createElement('div');
    aArea.id = `answer-area-${subject}`;
    /*
    aArea.style.padding = '10mm 15mm 0 15mm';
    aArea.style.position = 'relative';
    */
    aArea.classList.add('measure-page-shell');

    tmpQuestionContainer.appendChild(qArea);
    tmpAnswerContainer.appendChild(aArea);

    appendExamSubjectHeading(subject, qArea, aArea, root, state);

    let sNo = 0;
    let mNo = 0;
    for (const [smallCategory, items] of catMap.entries()) {
      sNo++;
      if (state.options.hasSubCategoryHeading) {
        appendSubcategoryHeading(
          smallCategory,
          qArea,
          aArea,
          root,
          state,
          subject,
          sNo,
        );
      }
      for (const item of items) {
        mNo++;
        // 見出し非表示時も TOC の fallback 集計に使えるよう、カテゴリ情報を先に保持しておく。
        const baseEntry: PageMapEntry = {
          itemId: item.id,
          subject,
          smallCategory,
          questionIndex: mNo,
        };
        const existing = pageMapByItemId.get(item.id);
        pageMapByItemId.set(item.id, existing ?? baseEntry);

        // 一問ごとに配置
        // 解説の配置
        if (state.options.mode !== 'onlyQuestion') {
          const answerElements = await layoutTestElements({
            prefix: 'answer',
            root,
            state,
            subject,
            sNo,
            mNo,
            item,
            images,
          });
          aArea.appendChild(answerElements);
        }
        // 問題の配置
        if (state.options.mode !== 'onlyAnswer') {
          const questionElements = await layoutTestElements({
            prefix: 'question',
            root,
            state,
            subject,
            sNo,
            mNo,
            item,
            images,
          });
          qArea.appendChild(questionElements);
        }
      }
    }
  }
};

// 要素の高さを計測して、適宜改ページする

export const adjustTestArea = async (
  root: Document,
  bySubject: ReturnType<typeof configureBySubject>,
  state: LayoutState,
) => {
  if (state.options.creationType === 'exam') {
    return renderExamPreview({
      root,
      state,
      pageMapByItemId,
    });
  }

  const questionPageCounts = new Map<string, number>();
  const answerPageCounts = new Map<string, number>();
  const leadingNumberedPageCount = getLeadingNumberedPageCount(state);

  for (const [subject, _catMap] of bySubject.entries()) {
    // 問題エリアのページ分割
    const qArea = root.getElementById(`question-area-${subject}`);
    if (qArea && state.options.mode !== 'onlyAnswer') {
      const nextQuestionPage = await paginateArea({
        areaNodes: qArea.children,
        prefix: 'question',
        root,
        pageMapByItemId,
      });
      questionPageCounts.set(
        subject,
        normalizePaginatePageCount(nextQuestionPage),
      );
    } else {
      questionPageCounts.set(subject, 0);
    }

    // 解説エリアのページ分割
    const aArea = root.getElementById(`answer-area-${subject}`);
    if (aArea && state.options.mode !== 'onlyQuestion') {
      const nextAnswerPage = await paginateArea({
        areaNodes: aArea.children,
        prefix: 'answer',
        root,
        pageMapByItemId,
      });
      answerPageCounts.set(subject, normalizePaginatePageCount(nextAnswerPage));
    } else {
      answerPageCounts.set(subject, 0);
    }
  }

  if (state.options.hasCover && state.options.mode === 'both') {
    // paginateArea は subject ごとに 1 ページから数え直すため、TOC 用に文書全体のページへ組み直す。
    const tocRowsBySubject = buildTocRowsBySubject(
      root,
      bySubject,
      questionPageCounts,
      answerPageCounts,
      leadingNumberedPageCount,
    );

    for (const [subject] of bySubject.entries()) {
      generateTOC(root, subject, tocRowsBySubject.get(subject) ?? []);
    }
  }

  const totalQuestionPages = Array.from(questionPageCounts.values()).reduce(
    (sum, pageCount) => sum + pageCount,
    0,
  );
  const totalAnswerPages = Array.from(answerPageCounts.values()).reduce(
    (sum, pageCount) => sum + pageCount,
    0,
  );

  return leadingNumberedPageCount + totalQuestionPages + totalAnswerPages;
};

// 目次の生成
export const generateTOC = (
  root: Document,
  subject: string,
  tocRows: TocRow[],
) => {
  const title = root.getElementById(`title-${subject}`) as HTMLElement | null;
  const tableDivs =
    (title?.getElementsByClassName(
      'category-wrapper',
    ) as HTMLCollectionOf<HTMLElement>) || [];

  Array.from(tableDivs).forEach((div, index) => {
    const tocRow = tocRows[index];
    if (!tocRow) return;

    const pageWrapper = root.createElement('div');
    pageWrapper.classList.add('page-wrapper');
    pageWrapper.innerHTML += `<div class="page-div"> ${formatPageRange(
      tocRow.questionRange,
    )}</div>`;
    pageWrapper.innerHTML += `<div class="page-div"> (${formatPageRange(
      tocRow.answerRange,
    )})</div>`;
    div.appendChild(pageWrapper);
  });
};

export const fullRenderPreview = async (
  state: LayoutState,
  doc?: Document,
  images?: ImageAssetMap,
) => {
  const root = doc ?? document;
  // ページマップの初期化
  pageMapByItemId.clear();

  // viewer.htmlのCSS変数をstateに基づいて設定
  applyPreviewCssVars(root, state);

  // subject → smallCategory(smallCategoryTag) でitemIdをグループ化
  const bySubject = configureBySubject(state);

  // tmpコンテナに各問題を配置
  await layoutTmpTest(state, root, bySubject, images);

  // 1フレームだけ待つ
  const nextFrame = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await nextFrame();

  // 問題・解説エリアの高さを計測して、改ページする
  await adjustTestArea(root, bySubject, state);
};
