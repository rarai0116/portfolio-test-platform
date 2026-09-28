// apps/client/src/app/renderer/api/quillUtils.ts

import katex from 'katex';
import type Quill from 'quill';
import type { EmitterSource } from 'quill';
import {
  KATEX_ACTIVE_CHAR_MACROS,
  normalizeHtmlFromQuillExport,
  sanitizeEditorRuntimeHtml,
  sanitizeForPreviewRender,
  sanitizeForQuillImport,
} from './htmlSanitizer';

const FORMULA_SELECTOR = '.ql-formula';
const TRANSIENT_IMAGE_CLASS_NAMES = ['active', 'selected'];
const TRANSIENT_IMAGE_ATTRIBUTE_NAMES = [
  'data-size',
  'data-editor-natural-aspect',
];

const escapeHtmlAttribute = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

const extractFormulaValue = (el: Element): string => {
  const dataValue = el.getAttribute('data-value');
  if (dataValue) return dataValue;

  const annotation = el.querySelector(
    'annotation[encoding="application/x-tex"]',
  );
  return annotation?.textContent?.trim() ?? '';
};

const renderFormulaMarkup = (value: string): string => {
  const rendered = katex.renderToString(value, {
    throwOnError: false,
    output: 'htmlAndMathml',
    strict: 'ignore',
    macros: KATEX_ACTIVE_CHAR_MACROS,
  });

  return `<span class="ql-formula" data-value="${escapeHtmlAttribute(value)}">${rendered}</span>`;
};

const compactFormulaElements = (root: ParentNode): void => {
  const formulaNodes = Array.from(
    root.querySelectorAll?.(FORMULA_SELECTOR) ?? [],
  );

  for (const node of formulaNodes) {
    const value = extractFormulaValue(node);
    if (!value) continue;

    const replacement = node.ownerDocument.createElement('span');
    replacement.className = 'ql-formula';
    replacement.setAttribute('data-value', value);
    node.replaceWith(replacement);
  }
};

const inflateFormulaElements = (root: ParentNode): void => {
  const formulaNodes = Array.from(
    root.querySelectorAll?.(FORMULA_SELECTOR) ?? [],
  );

  for (const node of formulaNodes) {
    const value = extractFormulaValue(node);
    if (!value) continue;

    const template = node.ownerDocument.createElement('template');
    template.innerHTML = renderFormulaMarkup(value);
    const renderedNode = template.content.firstElementChild;
    if (renderedNode) node.replaceWith(renderedNode);
  }
};

const stripTransientImageArtifacts = (html: string): string => {
  const template = document.createElement('template');
  template.innerHTML = html;

  let changed = false;
  const images = Array.from(template.content.querySelectorAll('img'));
  for (const image of images) {
    for (const attrName of TRANSIENT_IMAGE_ATTRIBUTE_NAMES) {
      if (image.hasAttribute(attrName)) {
        image.removeAttribute(attrName);
        changed = true;
      }
    }

    for (const className of TRANSIENT_IMAGE_CLASS_NAMES) {
      if (image.classList.contains(className)) {
        image.classList.remove(className);
        changed = true;
      }
    }

    if (image.getAttribute('class') === '') {
      image.removeAttribute('class');
      changed = true;
    }
  }

  return changed ? template.innerHTML : html;
};

export const compactFormulaHtmlForStorage = (html: string): string => {
  if (!html) return '';

  const template = document.createElement('template');
  template.innerHTML = html;
  compactFormulaElements(template.content);
  return template.innerHTML;
};

export const inflateFormulaHtmlForRender = (html: string): string => {
  if (!html) return '';

  const template = document.createElement('template');
  template.innerHTML = html;
  inflateFormulaElements(template.content);
  return template.innerHTML;
};

export const prepareHtmlForQuillPaste = (html: string): string => {
  return sanitizeForQuillImport(html).sanitizedHtml;
};

export const restoreHtmlFromQuill = (html: string): string => {
  if (!html) return '';

  const normalizedHtml = normalizeHtmlFromQuillExport(html);
  const cleanedHtml = stripTransientImageArtifacts(normalizedHtml);
  return sanitizeEditorRuntimeHtml(cleanedHtml, {
    boundary: 'editor-runtime',
  }).sanitizedHtml;
};

/**
 * Preview export 用:
 * - Quill 内で保持している NBSP をそのまま残す
 * - preview 側の HTML 描画で連続スペースが潰れないようにする
 */
export const exportHtmlForPreview = (html: string): string => {
  if (!html) return '';

  return sanitizeForPreviewRender(stripTransientImageArtifacts(html))
    .sanitizedHtml;
};

export const dangerouslyPasteHtmlPreservingSpaces = (
  quill: Quill,
  html: string,
  source: EmitterSource = 'api',
): void => {
  const normalizedHtml = prepareHtmlForQuillPaste(html);
  quill.clipboard.dangerouslyPasteHTML(normalizedHtml, source);
};
