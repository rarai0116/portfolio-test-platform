import type { LayoutState } from './types';

// 表紙追加処理
export const addCover = (
  bySubject: Map<string, Map<string, LayoutState['items']>>,
  root: Document,
  titleContainer: HTMLElement,
  state: LayoutState,
) => {
  for (const [subject, catMap] of bySubject.entries()) {
    const titleTemplate = root.getElementById(
      'tmp-title',
    ) as HTMLElement | null;
    if (!titleTemplate) continue;

    const titleSec = titleTemplate.cloneNode(true) as HTMLElement;
    titleSec.id = `title-${subject}`;
    titleSec.classList.remove('tmp');

    const subjectEl = titleSec.querySelector('.subject') as HTMLElement | null;
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
};

export const addPageNo = (
  root: Document,
  subject: string,
  qResult?: { endPage: number },
) => {
  const answerPageZero = (qResult?.endPage ?? 1) - 1;
  const title = root.getElementById(`title-${subject}`) as HTMLElement | null;
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
};
