import katexTextFontUrl from '@renderer/assets/fonts/demoKaTeXText-Regular.woff2?url';
import katexOverrideCss from '@styles/katexOverride.css?inline';
import katexCss from 'katex/dist/katex.min.css?inline';

export type DisplayMode = 'print' | 'patch';

const STYLE_ID = 'preview-mode-style';

export const ensureDisplayModeStyle = (doc: Document, mode: DisplayMode) => {
  const prev = doc.head.querySelector(`style#${STYLE_ID}`);
  if (prev) prev.remove();

  if (mode === 'patch') {
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.setAttribute('data-preview-mode-style', '1');
    style.textContent = `
      html { background-color: transparent !important; }
      body { background: transparent !important; }
      .print-page, .print-firstpage {
        box-shadow: none !important;
        background: transparent !important;
      }
      .test-section-div { overflow: visible !important; }
      [data-create-pdf-preview-toolbar] { display: none !important; }
      [data-create-pdf-preview-host] { padding-top: 0 !important; }
      body { padding: 0 !important; }
      .print-page, .print-firstpage { margin: 0 !important; }
      /* patch モードは改ページしない（案C）。固定ページ高さを解除して
         内容に追従させ、はみ出しが次ページに重なるのを防ぐ（Bug 11）。 */
      .print-page, .print-firstpage { height: auto !important; min-height: 0 !important; }
      /* 紙のページ番号 "- n -" は patch モードでは意味を持たないため非表示 */
      .print-page::after { content: none !important; }
    `;
    /*
    body {padding: 0 !important;}
        margin: 0 !important;
    page-break-after: auto !important;
        width: auto !important;
        min-height: auto !important;

    */
    doc.head.appendChild(style);
  }
};

export const ensureKatexFontStyle = (doc: Document) => {
  if (doc.head.querySelector('style[data-katex-font-style="1"]')) return;
  const style = doc.createElement('style');
  style.setAttribute('data-katex-font-style', '1');
  style.textContent = `
    @font-face {
      font-family: 'demoKaTeXText';
      src: url('${katexTextFontUrl}') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
  `;
  doc.head.appendChild(style);
};

export const ensureKatexStyle = (doc: Document) => {
  if (doc.head.querySelector('style[data-katex-style="1"]')) return;
  const style = doc.createElement('style');
  style.setAttribute('data-katex-style', '1');
  style.textContent = katexCss;
  doc.head.appendChild(style);
};

export const ensureKatexOverrideStyle = (doc: Document) => {
  if (doc.head.querySelector('style[data-katex-override-style="1"]')) return;
  const style = doc.createElement('style');
  style.setAttribute('data-katex-override-style', '1');
  style.textContent = katexOverrideCss;
  doc.head.appendChild(style);
};
