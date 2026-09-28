import type { LayoutState, PageMapEntry } from './types';
import { extractOrWrapParagraph, lightAdjustBlock } from './utils';

export const addTestArea = async (
  root: Document,
  state: LayoutState,
  pageMapByItemId: Map<string, PageMapEntry>,
  qArea: HTMLElement,
  aArea: HTMLElement,
  catMap: Map<string, LayoutState['items']>,
  subject: string,
) => {
  let sNo = 0;
  let mNo = 0;

  for (const [smallCategory, items] of catMap.entries()) {
    sNo++;

    // サブカテゴリ見出し
    const subQ = root.createElement('p');
    subQ.classList.add('subcategory-name', 'test-section-div');
    subQ.innerText = `${sNo}．${
      smallCategory === 'なし'
        ? String(items[0]?.bigCategoryTag || '')
        : smallCategory
    }`;

    if (state.options.mode !== 'onlyAnswer') {
      qArea.appendChild(subQ);
    }
    if (state.options.mode !== 'onlyQuestion') {
      const subA = subQ.cloneNode(true) as HTMLElement;
      aArea.appendChild(subA);
    }

    for (const it of items) {
      mNo++;

      // PageMapEntry を初期登録
      const baseEntry: PageMapEntry = {
        itemId: it.id,
        subject,
        smallCategory,
        questionIndex: mNo,
      };
      const existing = pageMapByItemId.get(it.id);
      pageMapByItemId.set(it.id, existing ?? baseEntry);

      // 問題本文と選択肢
      if (state.options.mode !== 'onlyAnswer') {
        const testTemplate = root.getElementById(
          'tmp-test',
        ) as HTMLElement | null;
        if (testTemplate) {
          const test = testTemplate.cloneNode(true) as HTMLElement;
          test.id = `test-${subject}-${sNo}-${mNo}`;
          test.classList.remove('tmp');
          test.classList.add(
            `test-column-${subject}-${sNo}`,
            'test-section-div',
            'test-body',
          );

          // 対応する PreviewItem のidを保持
          test.dataset.itemId = it.id;
          /*
          const qWrapper = test.querySelector(
            '.question-wrapper',
          ) as HTMLElement;
           */

          const num = test.querySelector('.question-num') as HTMLElement | null;
          if (num) {
            num.innerHTML = `No．${it.id}`;
            num.dataset.part = 'meta-number';
            num.dataset.itemId = it.id;
          }

          // 本文グループ
          const qGroup = root.createElement('div');
          qGroup.classList.add('sub-dividable-group');

          const qBlock = extractOrWrapParagraph(it.textHtml || '', root);
          qBlock.classList.add('sub-dividable-block', 'question-p');
          qBlock.dataset.part = 'question-text';
          qBlock.dataset.itemId = it.id;
          await lightAdjustBlock(qBlock, { divide: false });

          // console.log(qBlock);

          qGroup.appendChild(qBlock);

          const questionP = test.querySelector('.question-honbun');
          if (questionP?.parentNode) {
            questionP.parentNode.replaceChild(qGroup, questionP);
          }

          // 選択肢グループ
          const qChoices = it.questionChoicesHtml as string[] | undefined;
          const filteredChoices = (qChoices ?? []).filter(Boolean);

          if (filteredChoices.length > 0) {
            const qChoiceGroup = root.createElement('div');
            qChoiceGroup.classList.add('sub-dividable-group', 'choice-group');
            for (let idx = 0; idx < filteredChoices.length; idx++) {
              const html = filteredChoices[idx];
              const blk = extractOrWrapParagraph(html, root);
              blk.classList.add('sub-dividable-block', 'choices-p');

              const _p = blk.getElementsByTagName('p')[0];
              _p.innerHTML = `${idx + 1}．${_p.innerHTML}`;

              blk.dataset.part = 'question-choice';
              blk.dataset.itemId = it.id;
              blk.dataset.index = String(idx);

              await lightAdjustBlock(blk, { divide: false });
              qChoiceGroup.appendChild(blk);
            }
            qArea.appendChild(qChoiceGroup);
          }

          qArea.appendChild(test);
        }
      }

      // 解説本文と選択肢
      if (state.options.mode !== 'onlyQuestion') {
        const ansTemplate = root.getElementById(
          'tmp-answer',
        ) as HTMLElement | null;
        if (ansTemplate) {
          const ans = ansTemplate.cloneNode(true) as HTMLElement;
          ans.id = `answer-${subject}-${sNo}-${mNo}`;
          ans.classList.remove('tmp');
          ans.classList.add(
            `answer-column-${subject}-${sNo}`,
            'test-section-div',
            'answer-body',
          );

          // PageMapEntry に answerNodeId を記録
          ans.dataset.itemId = it.id;
          {
            const entry = pageMapByItemId.get(it.id);
            if (entry) {
              entry.answerNodeId = ans.id;
              pageMapByItemId.set(it.id, entry);
            }
          }

          // console.log(ans);
          const ansNum = ans.querySelector('.num-p') as HTMLElement;
          // console.log(ansNum);
          const ansNo = ansNum.querySelector('.no') as HTMLElement;
          ansNo.innerHTML = `No．${it.id}`;
          const ansMeta = ansNum.querySelector('.answer-meta') as HTMLElement;
          // console.log(ansMeta);
          const kotae = ansMeta.querySelector('.kotae') as HTMLElement;
          kotae.innerHTML = `答 ${it.answerNo}`;
          const year = ansMeta.querySelector('.year') as HTMLElement;
          year.innerHTML = `${it.nengo === '平成' ? 'H' : 'R'}―${String(it.year).padStart(2, '0')}`;
          /*
            const ansNum = ans.querySelector(
              '.answer-num',
            ) as HTMLElement | null;
            if (ansNum) {
              ansNum.innerText = `${mNo}．`;
              const ansMark = root.createElement('span');
              ansMark.classList.add('answer');
              ansMark.innerText = it.answerBool ? '◯' : '✕';
              ansMark.dataset.part = 'answer-mark';
              ansMark.dataset.itemId = it.id;

              ansNum.appendChild(ansMark);
            }
            */

          // const aWrapper = ans.querySelector('.answer-wrapper') as HTMLElement;
          // 本文（解説）グループ
          const aGroup = root.createElement('div');
          aGroup.classList.add('sub-dividable-group', 'answer-title-parent');

          const aBlock = extractOrWrapParagraph(it.answerTextHtml || '', root);
          aBlock.classList.add('sub-dividable-block', 'answers-p');
          //              aBlock.innerHTML = it.answerTextHtml || '';
          aBlock.dataset.part = 'answer-text';
          aBlock.dataset.itemId = it.id;

          aGroup.appendChild(aBlock);
          aArea.appendChild(aGroup);

          // 選択肢グループ
          const aChoices = it.answerChoicesHtml as string[] | undefined;
          const filteredAChoices = (aChoices ?? []).filter(Boolean);

          if (filteredAChoices.length > 0) {
            const aChoiceGroup = root.createElement('div');
            aChoiceGroup.classList.add('sub-dividable-group', 'choice-group');
            for (let idx = 0; idx < filteredAChoices.length; idx++) {
              const html = filteredAChoices[idx];
              const blk = extractOrWrapParagraph(html, root);
              blk.classList.add('sub-dividable-block', 'answers-p');

              const _p = blk.getElementsByTagName('p')[0];
              _p.innerHTML = `${idx + 1}．${_p.innerHTML}`;

              blk.dataset.part = 'answer-choice';
              blk.dataset.itemId = it.id;
              blk.dataset.index = String(idx);

              await lightAdjustBlock(blk, { divide: false });
              aChoiceGroup.appendChild(blk);
            }
            aArea.appendChild(aChoiceGroup);
          }

          aArea.appendChild(ans);
        }
      }
    } // items
  } // catMap
};
