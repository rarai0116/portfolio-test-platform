/** biome-ignore-all lint/style/useNodejsImportProtocol: backend utility script */

const { JSDOM } = require('jsdom');

const HTML_FIELDS = [
  'text',
  'ch1',
  'ch2',
  'ch3',
  'ch4',
  'ch5',
  'answerText',
  'answerText1',
  'answerText2',
  'answerText3',
  'answerText4',
  'answerText5',
];

const FORMULA_SELECTOR = '.ql-formula';
const KATEX_SELECTOR = '.katex';
const dom = new JSDOM('<!DOCTYPE html><body></body>');
const document = dom.window.document;

function createCompactFormulaElement(value) {
  const replacement = document.createElement('span');
  replacement.className = 'ql-formula';
  replacement.setAttribute('data-value', value);
  return replacement;
}

function extractFormulaValue(element) {
  const dataValue = element.getAttribute('data-value');
  if (typeof dataValue === 'string' && dataValue.trim()) {
    return dataValue.trim();
  }

  const annotation = element.querySelector(
    'annotation[encoding="application/x-tex"]',
  );
  return annotation?.textContent?.trim() ?? '';
}

function recoverBrokenKatexNodes(root) {
  const katexNodes = Array.from(root.querySelectorAll(KATEX_SELECTOR));

  let recoveredBrokenKatexCount = 0;
  let unresolvedBrokenKatexCount = 0;

  for (const node of katexNodes) {
    if (node.closest(FORMULA_SELECTOR)) {
      continue;
    }

    const value = extractFormulaValue(node);
    if (!value) {
      unresolvedBrokenKatexCount += 1;
      continue;
    }

    node.replaceWith(createCompactFormulaElement(value));
    recoveredBrokenKatexCount += 1;
  }

  return {
    recoveredBrokenKatexCount,
    unresolvedBrokenKatexCount,
  };
}

function compactFormulaHtmlForStorage(html) {
  if (!html || typeof html !== 'string') {
    return {
      html: '',
      changed: false,
      compactedFormulaCount: 0,
      unresolvedFormulaCount: 0,
      recoveredBrokenKatexCount: 0,
      unresolvedBrokenKatexCount: 0,
    };
  }

  if (!html.includes('ql-formula') && !html.includes('katex')) {
    return {
      html,
      changed: false,
      compactedFormulaCount: 0,
      unresolvedFormulaCount: 0,
      recoveredBrokenKatexCount: 0,
      unresolvedBrokenKatexCount: 0,
    };
  }

  document.body.innerHTML = html;
  const brokenKatexResult = recoverBrokenKatexNodes(document);
  const formulaNodes = Array.from(document.querySelectorAll(FORMULA_SELECTOR));

  let compactedFormulaCount = 0;
  let unresolvedFormulaCount = 0;

  for (const node of formulaNodes) {
    const value = extractFormulaValue(node);
    if (!value) {
      unresolvedFormulaCount += 1;
      continue;
    }

    const replacement = createCompactFormulaElement(value);

    if (node.outerHTML === replacement.outerHTML) {
      continue;
    }

    node.replaceWith(replacement);
    compactedFormulaCount += 1;
  }

  const compactedHtml = document.body.innerHTML;
  document.body.innerHTML = '';

  return {
    html: compactedHtml,
    changed:
      compactedHtml !== html || brokenKatexResult.recoveredBrokenKatexCount > 0,
    compactedFormulaCount,
    unresolvedFormulaCount,
    recoveredBrokenKatexCount: brokenKatexResult.recoveredBrokenKatexCount,
    unresolvedBrokenKatexCount: brokenKatexResult.unresolvedBrokenKatexCount,
  };
}

function buildFormulaCompactionPatch(record) {
  const patch = {};
  const changedFields = [];
  const unresolvedFields = [];
  const recoveredBrokenKatexFields = [];
  const unresolvedBrokenKatexFields = [];
  let compactedFormulaCount = 0;
  let unresolvedFormulaCount = 0;
  let recoveredBrokenKatexCount = 0;
  let unresolvedBrokenKatexCount = 0;

  for (const field of HTML_FIELDS) {
    const currentValue = record?.[field];
    if (typeof currentValue !== 'string') {
      continue;
    }

    const result = compactFormulaHtmlForStorage(currentValue);
    compactedFormulaCount += result.compactedFormulaCount;
    unresolvedFormulaCount += result.unresolvedFormulaCount;
    recoveredBrokenKatexCount += result.recoveredBrokenKatexCount;
    unresolvedBrokenKatexCount += result.unresolvedBrokenKatexCount;

    if (result.unresolvedFormulaCount > 0) {
      unresolvedFields.push(field);
    }

    if (result.recoveredBrokenKatexCount > 0) {
      recoveredBrokenKatexFields.push(field);
    }

    if (result.unresolvedBrokenKatexCount > 0) {
      unresolvedBrokenKatexFields.push(field);
    }

    if (!result.changed) {
      continue;
    }

    patch[field] = result.html;
    changedFields.push(field);
  }

  return {
    patch,
    changedFields,
    unresolvedFields,
    recoveredBrokenKatexFields,
    unresolvedBrokenKatexFields,
    compactedFormulaCount,
    unresolvedFormulaCount,
    recoveredBrokenKatexCount,
    unresolvedBrokenKatexCount,
    changed: changedFields.length > 0,
  };
}

module.exports = {
  HTML_FIELDS,
  buildFormulaCompactionPatch,
  compactFormulaHtmlForStorage,
};