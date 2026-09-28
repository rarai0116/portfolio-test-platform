/**Deprecated
 * 旧レイアウト調整ロジック（ページ分割前の高さ計測やフロート画像の判定など）を実装するファイル。
 * 参考用に残しているが、そのうち消す予定
 */
import type { LayoutState, PageMapEntry } from './types';
import {
  _divideSentences,
  BASE_HEIGHT,
  CalculateNodeHeighter,
  extractOrWrapParagraph,
  FLOAT_IMAGE_OFFSET,
  GetNodeHeighter,
  lightAdjustBlock,
  searchFloatImage,
} from './utils';

const pageMapByItemId = new Map<string, PageMapEntry>();

export const _adjustTestArea = async (state: LayoutState, doc?: Document) => {
  const root = doc ?? document;

  const titleContainer = root.getElementById(
    'title-container',
  ) as HTMLElement | null;
  const questionContainer = root.getElementById(
    'question-container',
  ) as HTMLElement | null;
  const answerContainer = root.getElementById(
    'answer-container',
  ) as HTMLElement | null;

  if (!titleContainer || !questionContainer || !answerContainer) {
    return;
  }

  titleContainer.innerHTML = '';
  questionContainer.innerHTML = '';
  answerContainer.innerHTML = '';

  //
  pageMapByItemId.clear();

  // subject → smallCategory(smallCategoryTag) でグループ化
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

  // 表紙（必要時）
  if (state.options.hasCover) {
    for (const [subject, catMap] of bySubject.entries()) {
      const titleTemplate = root.getElementById(
        'tmp-title',
      ) as HTMLElement | null;
      if (!titleTemplate) continue;

      const titleSec = titleTemplate.cloneNode(true) as HTMLElement;
      titleSec.id = `title-${subject}`;
      titleSec.classList.remove('tmp');

      const subjectEl = titleSec.querySelector(
        '.subject',
      ) as HTMLElement | null;
      const qNumEl = titleSec.querySelector('.q-num') as HTMLElement | null;
      const titleEl = titleSec.querySelector('.title') as HTMLElement | null;

      if (subjectEl) subjectEl.innerText = subject;
      if (qNumEl) {
        const count = state.options.questionCount ?? '';
        qNumEl.innerText = `${count}問`;
      }
      if (titleEl) titleEl.innerText = state.options.meta?.title || '';

      const table = root.createElement('table');
      let tr = root.createElement('tr');
      let r = 0;

      for (const [smallCategory, items] of catMap.entries()) {
        const td = root.createElement('td');
        const div = root.createElement('div');
        div.classList.add('category-wrapper');
        div.id = `category-${subject}-${String(r + 1)}`;

        const txt =
          smallCategory === 'なし'
            ? String(items[0]?.bigCategoryTag || '')
            : smallCategory;
        div.innerHTML = `${r + 1}．${txt}`;

        td.appendChild(div);
        tr.appendChild(td);
        r++;

        if (r % 2 === 0) {
          table.appendChild(tr);
          tr = root.createElement('tr');
        }
      }
      if (r % 2 === 1) {
        table.appendChild(tr);
      }

      const firstPage = titleSec.querySelector(
        '.print-firstpage',
      ) as HTMLElement | null;
      const coverNote = titleSec.querySelector(
        '.cover-note',
      ) as HTMLElement | null;
      if (firstPage && coverNote) {
        firstPage.insertBefore(table, coverNote);
      }

      titleContainer.appendChild(titleSec);
    }
  }

  // 各 subject ごとに一時エリアを構築
  for (const [subject, catMap] of bySubject.entries()) {
    const qArea = root.createElement('div');
    qArea.id = `question-area-${subject}`;
    qArea.style.padding = '10mm 15mm 0 15mm';
    qArea.style.position = 'relative';

    const aArea = root.createElement('div');
    aArea.id = `answer-area-${subject}`;
    aArea.style.padding = '10mm 15mm 0 15mm';
    aArea.style.position = 'relative';

    questionContainer.appendChild(qArea);
    answerContainer.appendChild(aArea);

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

      const subA = subQ.cloneNode(true) as HTMLElement;

      if (state.options.mode !== 'onlyAnswer') {
        qArea.appendChild(subQ);
      }
      if (state.options.mode !== 'onlyQuestion') {
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
            const qWrapper = test.querySelector(
              '.question-wrapper',
            ) as HTMLElement;

            const num = test.querySelector(
              '.question-num',
            ) as HTMLElement | null;
            if (num) {
              num.innerHTML = `No．${it.id}`;
              num.dataset.part = 'meta-number';
              num.dataset.itemId = it.id;

              /*
              const boxesSpan = root.createElement('span');
              boxesSpan.classList.add('question-boxes');
              boxesSpan.innerHTML = '□□□□□';

              const yearSpan = root.createElement('span');
              yearSpan.classList.add('test-year-num');
              yearSpan.dataset.part = 'meta-year';
              yearSpan.dataset.itemId = it.id;
              

              const nengo = it.nengo === '令和' ? 'R' : 'H';
              const yearStr = String(it.year ?? '');
              const paddedYear =
                yearStr.length === 1 ? `0${yearStr}` : yearStr || '';
              const testNo = it.testNo ?? '';

              yearSpan.innerHTML = `${nengo}${paddedYear}―${testNo}`;

              num.appendChild(boxesSpan);
              num.appendChild(yearSpan);
              */
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

            if (
              filteredChoices.length > 0 &&
              state.options.questionEditorType !== 'noChoice'
            ) {
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
              qWrapper.appendChild(qChoiceGroup);
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

            const ansNum = ans.querySelector('.num-p') as HTMLElement;
            const ansNo = ansNum.querySelector('.no') as HTMLElement;
            ansNo.innerHTML = `No．${it.id}`;
            const ansMeta = ansNum.querySelector('.answer-meta') as HTMLElement;
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

            const aWrapper = ans.querySelector(
              '.answer-wrapper',
            ) as HTMLElement;
            // 本文（解説）グループ
            const aGroup = root.createElement('div');
            aGroup.classList.add('sub-dividable-group', 'answer-title-parent');

            const aBlock = extractOrWrapParagraph(
              it.answerTextHtml || '',
              root,
            );
            aBlock.classList.add('sub-dividable-block', 'answers-p');
            // aBlock.innerHTML = it.answerTextHtml || '';
            aBlock.dataset.part = 'answer-text';
            aBlock.dataset.itemId = it.id;
            await lightAdjustBlock(aBlock, { divide: false });

            aGroup.appendChild(aBlock);
            const questionA = ans.querySelector('.answer');
            if (questionA?.parentNode) {
              questionA.parentNode.replaceChild(aGroup, questionA);
            }
            // 選択肢グループ
            const aChoices = it.answerChoicesHtml as string[] | undefined;
            const filteredAChoices = (aChoices ?? []).filter(Boolean);

            if (
              filteredAChoices.length > 0 &&
              state.options.answerEditorType !== 'noChoice'
            ) {
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
              aWrapper.appendChild(aChoiceGroup);
            }

            aArea.appendChild(ans);
          }
        }
      } // items
    } // catMap

    // ===== ここからページ分割ロジック (viewer.html の layoutQuestion / layoutAnswer を TS 化) =====

    // Question: セクション高さ合算で分割（途中改ページなし）
    const layoutQuestion = async (): Promise<{ endPage: number }> => {
      if (state.options.mode === 'onlyAnswer') {
        return { endPage: 1 };
      }

      let count = 0;
      let endPage = 1;
      let currentPage = 1;
      let section: HTMLElement | null = null;
      let sectionHeight = 0;
      const areaNodes = qArea.children;

      const createSection = () => {
        const sec = root.createElement('section');
        sec.classList.add('print-page');
        return sec;
      };

      const flushSection = () => {
        if (section && sectionHeight > 0) {
          questionContainer.appendChild(section);
          endPage++;
          currentPage = endPage; // 次に作るセクションのページ番号
        }
        section = null;
        sectionHeight = 0;
      };

      while (areaNodes.length > count) {
        const node = areaNodes[count] as HTMLElement;
        // console.log('Processing question node:', node);
        await CalculateNodeHeighter(node);
        const nodeHeight = GetNodeHeighter(node);

        // セクション未作成 or 高さオーバーなら新しいセクションを開始
        if (!section || sectionHeight + nodeHeight > BASE_HEIGHT) {
          flushSection();
          section = createSection();
          sectionHeight = 0;
        }

        if (node.classList.contains('test-section-div')) {
          const itemId = node.dataset.itemId;
          if (itemId) {
            const entry = pageMapByItemId.get(itemId);
            if (entry && entry.questionPage === undefined) {
              entry.questionPage = currentPage;
            }
          }
        }

        section.appendChild(node.cloneNode(true));
        sectionHeight += nodeHeight;
        count++;
      }

      // 最後のセクションを確定
      flushSection();

      return { endPage };
    };

    // Answer: pdfwindow2 の AnswerNodeUpdate 準拠（_divideSentences＋フロート画像）
    const layoutAnswer = async (): Promise<{ endPage: number }> => {
      if (state.options.mode === 'onlyQuestion') {
        return { endPage: 1 };
      }

      let count = 0;
      let endPage = 1;
      let currentPage = 1;
      const areaNodes = aArea.children;
      //aArea.querySelectorAll<HTMLElement>('.test-section-div');

      let wrapper: HTMLElement | null = null;
      let group: HTMLElement | null = null;
      let block: HTMLElement | null = null;

      let sectionHeight = 0;
      let stash: HTMLElement[] = [];
      // biome-ignore lint/correctness/noUnusedVariables: 後で多分使う
      let stashHeight = 0;

      let isFloatImageMode = false;
      let floatStashNode: HTMLElement | null = null;
      let floatImageHeightBasis = 0;
      let floatNodeHeight = 0;

      let floatParentBlock: HTMLElement | null = null;
      let floatParentGroup: HTMLElement | null = null;
      let floatCurrentBlockNode: HTMLElement | null = null;
      let isFloatChangeBlock = false;
      let isAnswerTitle = false;

      const addNode = (node: HTMLElement, isFront = false) => {
        if (!section || !wrapper || !group || !block) return;

        const cloned = node.cloneNode(true) as HTMLElement;

        if (node.classList.contains('test-section-div')) {
          isFront ? section.prepend(cloned) : section.appendChild(cloned);
        }
        if (node.classList.contains('sub-dividable-group')) {
          isFront ? wrapper.prepend(cloned) : wrapper.appendChild(cloned);
        }
        if (node.classList.contains('sub-dividable-block')) {
          isFront ? group.prepend(cloned) : group.appendChild(cloned);
        }
        if (node.classList.contains('sub-dividable-sentence')) {
          isFront ? block.prepend(cloned) : block.appendChild(cloned);
        }

        sectionHeight += GetNodeHeighter(node);
      };

      const addStashNode = async (
        node: HTMLElement,
        height?: number,
        isUnshift = false,
      ): Promise<number> => {
        if (height === undefined) {
          await CalculateNodeHeighter(node);
          height = GetNodeHeighter(node);
        }
        node.classList.add('stashed');
        if (isUnshift) {
          stash.unshift(node);
        } else {
          stash.push(node);
        }
        stashHeight += height;
        return height;
      };

      const addJudgeNodies = async (nodies?: HTMLElement[]) => {
        if (!section || !block) return;

        if (!nodies) {
          nodies = [...stash];
        } else if (stash.length > 0) {
          nodies = [...stash, ...nodies];
        }

        if (nodies.length === 0) return;

        const firstNode = nodies[0];

        //ノードの一行目が<br>または<p> </p>の場合削除
        const deleteFirstBreakLine = (node: HTMLElement) => {
          let html = node.innerHTML;
          const reg = /^<br>/i;
          const reg2 = /^<p ?[^>]*>\s*<\/p>/i;
          while (reg.test(html) || reg2.test(html)) {
            html = html.replace(reg, '');
            html = html.replace(reg2, '');
          }
          node.innerHTML = html;
        };

        const nodiesHeight =
          nodies.length > 1
            ? nodies.reduce((b, c) => b + Number(GetNodeHeighter(c)), 0)
            : GetNodeHeighter(firstNode);

        if (nodiesHeight + sectionHeight > BASE_HEIGHT) {
          section.setAttribute('heighter', String(sectionHeight));
          // 改ページ
          initializeSection();
          deleteFirstBreakLine(nodies[0]);
          if (block.classList.contains('answers-p')) {
            if (!nodies[0].innerText.match(/^[0-9][．]/i)) {
              if (!nodies[0].innerHTML.match(/^<img/i) && sectionHeight > 0) {
                nodies[0].setAttribute('style', 'padding-left: 1.5em;');
                nodies[0].classList.add('set-padding');
              } else {
                nodies[0].classList.add('no-padding');
              }
            }
          }
        }

        nodies.forEach((node) => {
          addNode(node, node.classList.contains('is-stash'));
        });
        stash = [];
        stashHeight = 0;
      };

      const EndFloatImageMode = async (heighter: number) => {
        if (!floatStashNode || !block || !floatParentBlock || !floatParentGroup)
          return;
        floatStashNode.setAttribute('heighter', String(heighter));

        const stashBlock = block;
        const stashGroup = group;

        block = floatParentBlock;
        group = floatParentGroup;

        if (stash.length > 0) {
          await addJudgeNodies();
        }

        if (block === floatParentBlock) {
          block = stashBlock;
          group = stashGroup;
        } else if (group && stashBlock) {
          const newBlock = stashBlock.cloneNode(false) as HTMLElement;
          group.appendChild(newBlock);
          block = newBlock;
        }

        isFloatImageMode = false;
      };

      const floatImageJudgement = async (target: HTMLElement) => {
        const floatImage = searchFloatImage(target);

        // 未ロード画像（naturalWidth===0/offsetHeight===0）は除外してフロート判定を行う
        const imgs = Array.isArray(floatImage) ? floatImage : [];
        const loadedImages = imgs.filter((el) => {
          const img = el as HTMLImageElement;
          // IMGタグで、ロード済み（naturalWidth/Height > 0）かつ実高さがあるもののみ対象
          return (
            img.tagName === 'IMG' &&
            img.naturalWidth > 0 &&
            img.naturalHeight > 0 &&
            img.offsetHeight > 0
          );
        }) as HTMLImageElement[];
        const hasLoadedFloat = loadedImages.length > 0;
        // console.log('Loaded float images:', loadedImages, isFloatImageMode);

        if (isFloatImageMode) {
          if (hasLoadedFloat) {
            // 新しいフロート画像を検知（ロード済み画像のみ基準にする）
            if (floatNodeHeight > 0) {
              if (floatNodeHeight > floatImageHeightBasis) {
                await EndFloatImageMode(floatNodeHeight);
              } else {
                await EndFloatImageMode(
                  floatImageHeightBasis + FLOAT_IMAGE_OFFSET,
                );
              }
            } else {
              const newH = loadedImages[0].offsetHeight * 0.16;
              if (floatImageHeightBasis < newH) {
                floatImageHeightBasis = newH;
              }
              target.setAttribute('heighter', '0');
              target.classList.add('float-and-float');
              floatStashNode?.appendChild(target.cloneNode(true));
            }
          } else {
            // ロード済み画像が無い間は通常文扱い（スタッシュのみ継続・解除判定は既存基準）
            if (floatNodeHeight > floatImageHeightBasis + FLOAT_IMAGE_OFFSET) {
              await EndFloatImageMode(floatNodeHeight);
            } else {
              target.setAttribute('heighter', '0');
              target.classList.add('float-inner-node');
              if (floatCurrentBlockNode !== block) {
                isFloatChangeBlock = true;
                floatCurrentBlockNode = block;
                floatCurrentBlockNode?.classList.add('float-inner-answers-p');
                if (floatCurrentBlockNode)
                  floatStashNode?.appendChild(floatCurrentBlockNode);
              }
              if (isFloatChangeBlock) {
                floatCurrentBlockNode?.appendChild(target.cloneNode(true));
              } else {
                floatStashNode?.appendChild(target.cloneNode(true));
              }
              floatNodeHeight += target.offsetHeight;
            }
          }
        }

        if (!isFloatImageMode && hasLoadedFloat) {
          // フロートモード開始（ロード済み画像のみ基準にする）
          isFloatImageMode = true;
          floatImageHeightBasis =
            loadedImages.length > 1
              ? Math.max(...loadedImages.map((img) => img.offsetHeight)) * 0.16
              : loadedImages[0].offsetHeight * 0.16;

          await CalculateNodeHeighter(target);
          floatNodeHeight = GetNodeHeighter(target);
          floatStashNode = target.cloneNode(true) as HTMLElement;
          await addStashNode(floatStashNode);
          floatCurrentBlockNode = block;
          isFloatChangeBlock = false;
          floatParentBlock = block;
          floatParentGroup = group;
        }
      };

      const initializeSection = () => {
        let isFirst = true;
        if (section !== null) {
          // 空ブロック除去＆追加
          const blocks = section.getElementsByClassName(
            'sub-dividable-block',
          ) as HTMLCollectionOf<HTMLElement>;
          let addSwitch = false;
          // console.log('Initializing section with blocks:', blocks);
          Array.from(blocks).forEach((b) => {
            // console.log('Block content:', b.innerHTML);
            if (
              !b.innerHTML.match('<img') &&
              (b.textContent?.trim().length ?? 0) === 0 &&
              b.innerHTML.length !== 0
            ) {
              // console.log('Empty block without images detected');
              // b.style.display = 'none';
              // b.classList.add('empty-hide-block');
            } else {
              addSwitch = true;
              b.style.display = '';
              b.classList.remove('empty-hide-block');
            }
          });
          if (addSwitch) {
            answerContainer.appendChild(section);
            endPage++;
            currentPage = endPage;
          }
          wrapper = root.createElement('div');
          wrapper.classList.add('answer-wrapper');
          isFirst = false;
        }

        section = root.createElement('section');
        section.classList.add('print-page');
        if (!isFirst && wrapper) {
          section?.appendChild(wrapper);
        }
        if (group !== null && wrapper) {
          group = group.cloneNode(false) as HTMLElement;
          wrapper.appendChild(group);
        }
        if (block !== null && group) {
          block = block.cloneNode(false) as HTMLElement;
          group.appendChild(block);
        }
        sectionHeight = 0;
      };

      const bodyProcess = async (node: HTMLElement, itemId?: string) => {
        // console.log('Processing answer node in body process:', node);

        if (itemId) {
          const entry = pageMapByItemId.get(itemId);
          if (entry && entry.answerPage === undefined) {
            entry.answerPage = currentPage;
          }
        }

        wrapper = root.createElement('div');
        wrapper.classList.add('answer-wrapper');
        section?.appendChild(wrapper);

        const groups = Array.from(
          node.getElementsByClassName(
            'sub-dividable-group',
          ) as HTMLCollectionOf<HTMLElement>,
        );
        // console.log('Groups:', groups);

        for (const g of groups) {
          // // console.log('Processing group:', g, groups[2].innerHTML);
          const blocks = Array.from(
            g.getElementsByClassName(
              'sub-dividable-block',
            ) as HTMLCollectionOf<HTMLElement>,
          );
          if (blocks.length === 0) return;

          group = g.cloneNode(false) as HTMLElement;
          wrapper.appendChild(group);
          isAnswerTitle = g.classList.contains('answer-title-parent');

          // console.log('Processing group:', g, blocks);
          for (const b of blocks) {
            // console.log('Processing block:', b);
            await _divideSentences(b);
            if (
              (b.textContent?.trim().length ?? 0) === 0 &&
              !b.innerHTML.match('<img')
            ) {
              continue;
            }

            block = b.cloneNode(false) as HTMLElement;
            group.appendChild(block);

            let sentences = Array.from(
              b.getElementsByClassName(
                'sub-dividable-sentence',
              ) as HTMLCollectionOf<HTMLElement>,
            );

            if (sentences.length === 0) {
              const ps = Array.from(b.querySelectorAll('p')) as HTMLElement[];
              if (ps.length > 0) {
                // 画像のみの <p> も含め、センテンスとして処理対象にする
                ps.forEach((p) => {
                  // クラス付与のみ（後工程はこのクラス前提で動く）
                  p.classList.add('sub-dividable-sentence');
                });
                sentences = ps;
              } else {
                // 更なるフォールバック: ブロック全体を1センテンス扱い
                b.classList.add('sub-dividable-sentence');
                sentences = [b];
              }
            }

            // console.log('Sentences to process:', sentences);
            for (const sentence of sentences) {
              // console.log('Processing sentence:', sentence);
              await floatImageJudgement(sentence);
              await CalculateNodeHeighter(sentence, isAnswerTitle ? 8 : 0);
              if (!isFloatImageMode) {
                await addJudgeNodies([sentence]);
              }
            }

            if (isFloatImageMode && stash.length > 0) {
              if (floatNodeHeight > floatImageHeightBasis) {
                await EndFloatImageMode(floatNodeHeight);
              } else {
                await EndFloatImageMode(
                  floatImageHeightBasis + FLOAT_IMAGE_OFFSET,
                );
              }
            }
          }
        }

        // ラッパーの最後にセクションが8割を超えたら改ページ
        if (sectionHeight > BASE_HEIGHT * 0.8) {
          initializeSection();
        }
      };

      // 初期化と走査
      const initializeFirst = () => {
        const _section = root.createElement('section');
        _section.classList.add('print-page');
        sectionHeight = 0;
        currentPage = 1;
        return _section;
      };

      let section = initializeFirst();

      // console.log(areaNodes, areaNodes.length > 2 && areaNodes[1]);
      while (areaNodes.length > count) {
        // console.log(count);
        const node = areaNodes[count] as HTMLElement;
        // console.log('Processing answer node:', node, node.innerHTML);
        if (node.classList.contains('subcategory-name')) {
          // サブカテゴリの場合の処理
          await CalculateNodeHeighter(node);
          if (sectionHeight > 0) {
            initializeSection();
          }
          if (!section) {
            section = initializeFirst();
          }
          // subcategory-name は test-section-div として扱わないので、
          // 直接セクションに追加
          //          const currentSection = section as HTMLElement;
          // console.log('Appending subcategory-name to section:', section, node);
          section.appendChild(node.cloneNode(true));
          sectionHeight += GetNodeHeighter(node);
        } else {
          // それ以外の処理
          const itemId = node.dataset.itemId;
          await bodyProcess(node, itemId);
        }
        count++;
      }

      if (section) {
        answerContainer.appendChild(section);
        endPage++;
      }

      // aArea.style.display = 'none';

      return { endPage };
    };

    // 1フレームだけ待つ
    const nextFrame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await nextFrame();

    const qResult = await layoutQuestion();
    const _aResult = await layoutAnswer();
    console.log(
      `Subject: ${subject} QPages: ${
        qResult.endPage
      } APages: ${_aResult.endPage}`,
    );

    // 目次のページ番号をざっくり（viewer.html と同じロジック）
    if (state.options.hasCover && state.options.mode === 'both') {
      const answerPageZero = (qResult?.endPage ?? 1) - 1;
      const title = root.getElementById(
        `title-${subject}`,
      ) as HTMLElement | null;
      const tableDivs =
        (title?.getElementsByClassName(
          'category-wrapper',
        ) as HTMLCollectionOf<HTMLElement>) || [];
      let i = 0;
      Array.from(tableDivs).forEach((div) => {
        const pageWrapper = root.createElement('div');
        pageWrapper.classList.add('page-wrapper');
        pageWrapper.innerHTML += `<div class="page-div"> P.${i + 1}</div>`;
        pageWrapper.innerHTML += `<div class="page-div"> (P.${
          i + 1 + answerPageZero
        })</div>`;
        div.appendChild(pageWrapper);
        i++;
      });
    }

    // 一時エリアを除去
    qArea.remove();
    aArea.remove();
  }
  const pageMap = Array.from(pageMapByItemId.values());
  return { pageMap };
};
