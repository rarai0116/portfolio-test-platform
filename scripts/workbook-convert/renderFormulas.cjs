'use strict';
/*
 * TestManager が保存した HTML の数式を、WorkbookApp が表示できる形へ描画する。
 *
 * なぜ必要か:
 *   TestManager（Quill）は数式を data-value に LaTeX を持つ「中身が空の span」として保存する。
 *     <span class="ql-formula" data-value="\\sigma_{\\max}=\\dfrac{N}{BH-bh}"></span>
 *   一方 WorkbookApp の webview は KaTeX の CSS しか持たず、JS レンダラを含まない
 *   （questionWebview.html に katex.render / katex.min.js が無いことを実測で確認）。
 *   つまりクライアント側で LaTeX は描画されない。ここで描画済み HTML を埋め込まないと、
 *   数式は「無表示」になる。実データの WorkbookApp 側も描画済み HTML を内包していた。
 */

// 依存はこのディレクトリの package.json が持つ。install していないと
// MODULE_NOT_FOUND になるだけで理由が分からないので、案内へ差し替える。
let katex;
try {
  katex = require('katex');
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
  throw new Error(
    'katex が見つかりません。先に依存を導入してください:\n'
    + '  corepack pnpm -C workbook-convert install',
  );
}

// Quill の formula は属性の順序が揺れうるので、class と data-value の前後関係を固定しない。
// 中身が空（<span ...></span>）のものだけを対象にし、既に描画済みのものは触らない。
const FORMULA_RE = /<span([^>]*\bclass="[^"]*\bql-formula\b[^"]*"[^>]*)><\/span>/g;
const DATA_VALUE_RE = /\bdata-value="([^"]*)"/;

function decodeEntities(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * HTML 内の ql-formula を KaTeX で描画する。
 * 描画できなかった式は errors へ積み、HTML は元のまま残す（黙って壊さない）。
 */
function renderFormulas(html, { location = '' } = {}) {
  if (typeof html !== 'string' || !html.includes('ql-formula')) {
    return { html, rendered: 0, errors: [] };
  }
  const errors = [];
  let rendered = 0;
  const out = html.replace(FORMULA_RE, (whole, attributes) => {
    const match = attributes.match(DATA_VALUE_RE);
    if (!match) {
      errors.push(`${location}: ql-formula に data-value が無い`);
      return whole;
    }
    const latex = decodeEntities(match[1]);
    if (latex.trim() === '') {
      errors.push(`${location}: ql-formula の data-value が空`);
      return whole;
    }
    let body;
    try {
      // throwOnError: false だと壊れた式が赤字のまま出力に混ざり、見た目で気付きにくい。
      // ここでは例外にして errors へ積み、呼び出し側が skip か中断かを決められるようにする。
      body = katex.renderToString(latex, { throwOnError: true, displayMode: false });
    } catch (error) {
      errors.push(`${location}: KaTeX の描画に失敗: ${latex} (${error.message.split('\n')[0]})`);
      return whole;
    }
    rendered += 1;
    // 実データと同じ入れ子にする: ql-formula の中に contenteditable=false の span を挟む。
    return `<span${attributes}><span contenteditable="false">${body}</span></span>`;
  });
  return { html: out, rendered, errors };
}

/** ドキュメントの HTML フィールドをまとめて処理する。 */
function renderFormulasInFields(doc, fields, { location = '' } = {}) {
  const out = { ...doc };
  let rendered = 0;
  const errors = [];
  for (const field of fields) {
    if (typeof out[field] !== 'string') continue;
    const result = renderFormulas(out[field], { location: `${location}.${field}` });
    out[field] = result.html;
    rendered += result.rendered;
    errors.push(...result.errors);
  }
  return { doc: out, rendered, errors };
}

module.exports = { renderFormulas, renderFormulasInFields };
