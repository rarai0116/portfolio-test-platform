/** biome-ignore-all lint/style/useNodejsImportProtocol: backend utility script */

const { JSDOM } = require('jsdom');

const { HTML_FIELDS } = require('./testDataFormulaCompactShared.cjs');

const dom = new JSDOM('<!DOCTYPE html><body></body>');
const document = dom.window.document;

const INLINE_WRAPPER_TAGS = new Set(['strong', 'em', 'u', 's', 'span']);
const LEGACY_INLINE_STYLE_TAGS = new Set([
  'span',
  'strong',
  'em',
  'u',
  's',
  'sub',
  'sup',
]);
const LEGACY_NOISE_CLASSES = new Set(['active', 'ql-cursor']);
const ALLOWED_IMG_ATTRIBUTES = new Set([
  'alt',
  'title',
  'data-asset-key',
  'data-key',
  'width',
  'height',
  'style',
]);
const ALLOWED_IMG_STYLE_PROPERTIES = new Set([
  'width',
  'height',
  'max-width',
  'max-height',
  'display',
  'float',
  'margin',
]);

const BANNED_STYLE_VALUE_RE =
  /(url\s*\(|expression\s*\(|javascript:|vbscript:|data:)/i;

const IMG_ALIGN_STYLE_MAP = {
  left: {
    float: 'left',
    margin: '0px 1em 1em 0px',
    display: 'inline',
  },
  right: {
    float: 'right',
    margin: '0px 0px 1em 1em',
    display: 'inline',
  },
  center: {
    float: 'none',
    margin: '0 auto',
    display: 'block',
  },
};

function createEmptyOperationSummary() {
  return {
    wrapperStyleNormalizedCount: 0,
    convertedAlignCount: 0,
    removedAlignCount: 0,
    removedSrcCount: 0,
    removedAttributeCount: 0,
    removedClassCount: 0,
    removedInlineStyleAttributeCount: 0,
    removedStylePropertyCount: 0,
    removedStyleValueCount: 0,
  };
}

function accumulateSummary(target, source) {
  target.wrapperStyleNormalizedCount += source.wrapperStyleNormalizedCount;
  target.convertedAlignCount += source.convertedAlignCount;
  target.removedAlignCount += source.removedAlignCount;
  target.removedSrcCount += source.removedSrcCount;
  target.removedAttributeCount += source.removedAttributeCount;
  target.removedClassCount += source.removedClassCount;
  target.removedInlineStyleAttributeCount +=
    source.removedInlineStyleAttributeCount;
  target.removedStylePropertyCount += source.removedStylePropertyCount;
  target.removedStyleValueCount += source.removedStyleValueCount;
}

function hasSummaryChanges(summary) {
  return Object.values(summary).some((count) => count > 0);
}

function isAllowedCssLength(value) {
  return /^(auto|0|[0-9]+(?:\.[0-9]+)?(?:px|%|em|rem|vh|vw))$/i.test(value);
}

function isAllowedMaxSizeValue(value) {
  return /^(none|auto|0|[0-9]+(?:\.[0-9]+)?(?:px|%|em|rem|vh|vw))$/i.test(
    value,
  );
}

function isAllowedMarginValue(value) {
  return /^(auto|0|[0-9]+(?:\.[0-9]+)?(?:px|%|em|rem))(\s+(auto|0|[0-9]+(?:\.[0-9]+)?(?:px|%|em|rem))){0,3}$/i.test(
    value,
  );
}

function isAllowedStyleValue(property, value) {
  if (BANNED_STYLE_VALUE_RE.test(value)) return false;

  switch (property) {
    case 'width':
    case 'height': {
      return isAllowedCssLength(value);
    }
    case 'max-width':
    case 'max-height': {
      return isAllowedMaxSizeValue(value);
    }
    case 'display': {
      return /^(block|inline|inline-block|none)$/i.test(value);
    }
    case 'float': {
      return /^(left|right|none|inline-start|inline-end)$/i.test(value);
    }
    case 'margin': {
      return isAllowedMarginValue(value);
    }
    default: {
      return false;
    }
  }
}

function normalizeWrapperStylesAroundImages(root) {
  const wrappers = Array.from(
    root.querySelectorAll(
      'strong[style], em[style], u[style], s[style], span[style]',
    ),
  );

  let normalizedCount = 0;

  for (const wrapper of wrappers) {
    const tagName = wrapper.tagName.toLowerCase();
    if (!INLINE_WRAPPER_TAGS.has(tagName)) continue;

    const childNodes = Array.from(wrapper.childNodes).filter((node) => {
      if (node.nodeType === dom.window.Node.TEXT_NODE) {
        return (node.textContent ?? '').trim().length > 0;
      }
      return node.nodeType === dom.window.Node.ELEMENT_NODE;
    });

    if (
      childNodes.length !== 1 ||
      childNodes[0].nodeType !== dom.window.Node.ELEMENT_NODE ||
      childNodes[0].tagName.toLowerCase() !== 'img'
    ) {
      continue;
    }

    const img = childNodes[0];
    const wrapperStyle = wrapper.getAttribute('style')?.trim() ?? '';
    if (!wrapperStyle) continue;

    const mergedStyle = [img.getAttribute('style')?.trim(), wrapperStyle]
      .filter(Boolean)
      .join('; ');

    if (mergedStyle) {
      img.setAttribute('style', mergedStyle);
    }

    wrapper.removeAttribute('style');
    normalizedCount += 1;
  }

  return normalizedCount;
}

function normalizeVoidTagsToSelfClosing(html) {
  return html
    .replace(/<br(\s[^<>]*?)?\s*\/?>/gi, (_match, attrs = '') => {
      return `<br${attrs || ''} />`;
    })
    .replace(/<img(\s[^<>]*?)?\s*\/?>/gi, (_match, attrs = '') => {
      return `<img${attrs || ''} />`;
    });
}

function normalizeLegacyImgAlign(root, summary) {
  const images = Array.from(root.querySelectorAll('img[align]'));

  for (const img of images) {
    const rawAlign = img.getAttribute('align')?.trim().toLowerCase() ?? '';
    const mappedStyles = IMG_ALIGN_STYLE_MAP[rawAlign];

    if (mappedStyles) {
      const appendedStyle = Object.entries(mappedStyles)
        .map(([property, value]) => `${property}: ${value}`)
        .join('; ');
      const mergedStyle = [img.getAttribute('style')?.trim(), appendedStyle]
        .filter(Boolean)
        .join('; ');

      if (mergedStyle) {
        img.setAttribute('style', mergedStyle);
      }
      summary.convertedAlignCount += 1;
    } else {
      summary.removedAlignCount += 1;
    }

    img.removeAttribute('align');
  }
}

function stripLegacyNoiseClasses(root, summary) {
  const nodes = Array.from(root.querySelectorAll('[class]'));

  for (const node of nodes) {
    const classNames = (node.getAttribute('class') ?? '')
      .split(/\s+/)
      .map((className) => className.trim())
      .filter(Boolean);
    const kept = classNames.filter((className) => !LEGACY_NOISE_CLASSES.has(className));
    const removedCount = classNames.length - kept.length;

    if (removedCount === 0) continue;

    summary.removedClassCount += removedCount;
    if (kept.length > 0) {
      node.setAttribute('class', kept.join(' '));
    } else {
      node.removeAttribute('class');
    }
  }
}

function stripLegacyInlineStyles(root, summary) {
  const selector = [...LEGACY_INLINE_STYLE_TAGS]
    .map((tagName) => `${tagName}[style]`)
    .join(', ');
  const nodes = Array.from(root.querySelectorAll(selector));

  for (const node of nodes) {
    if (!node.hasAttribute('style')) continue;
    node.removeAttribute('style');
    summary.removedInlineStyleAttributeCount += 1;
  }
}

function sanitizeImgStyle(rawStyle, summary) {
  const declarations = rawStyle
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean);

  const safeDeclarations = new Map();

  for (const declaration of declarations) {
    const separatorIndex = declaration.indexOf(':');
    if (separatorIndex === -1) {
      summary.removedStyleValueCount += 1;
      continue;
    }

    const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
    const value = declaration.slice(separatorIndex + 1).trim();

    if (!ALLOWED_IMG_STYLE_PROPERTIES.has(property)) {
      summary.removedStylePropertyCount += 1;
      continue;
    }

    if (!isAllowedStyleValue(property, value)) {
      summary.removedStyleValueCount += 1;
      continue;
    }

    safeDeclarations.set(property, value);
  }

  return [...safeDeclarations.entries()]
    .map(([property, value]) => `${property}: ${value}`)
    .join('; ');
}

function sanitizeImgElements(root, summary) {
  const images = Array.from(root.querySelectorAll('img'));

  for (const img of images) {
    const attributes = Array.from(img.attributes);

    for (const attribute of attributes) {
      const attrName = attribute.name.toLowerCase();
      const rawValue = attribute.value ?? '';
      const trimmedValue = rawValue.trim();

      if (attrName === 'class') {
        continue;
      }

      if (attrName === 'align') {
        img.removeAttribute(attribute.name);
        summary.removedAlignCount += 1;
        continue;
      }

      if (attrName === 'src') {
        img.removeAttribute(attribute.name);
        summary.removedSrcCount += 1;
        continue;
      }

      if (attrName === 'style') {
        const safeStyle = sanitizeImgStyle(rawValue, summary);
        if (safeStyle) {
          img.setAttribute('style', safeStyle);
        } else {
          img.removeAttribute(attribute.name);
        }
        continue;
      }

      if (attrName === 'width' || attrName === 'height') {
        if (trimmedValue === '') {
          img.setAttribute(attrName, '');
          continue;
        }

        if (/^\d{1,4}$/.test(trimmedValue)) {
          img.setAttribute(attrName, trimmedValue);
          continue;
        }

        img.removeAttribute(attribute.name);
        summary.removedAttributeCount += 1;
        continue;
      }

      if (ALLOWED_IMG_ATTRIBUTES.has(attrName)) {
        img.setAttribute(attrName, rawValue);
        continue;
      }

      img.removeAttribute(attribute.name);
      summary.removedAttributeCount += 1;
    }
  }
}

function sanitizeHtmlFieldForStorage(html) {
  if (!html || typeof html !== 'string') {
    return {
      html: '',
      changed: false,
      operationSummary: createEmptyOperationSummary(),
    };
  }

  if (!/<(img|span|strong|em|u|s|sub|sup)\b/i.test(html)) {
    return {
      html,
      changed: false,
      operationSummary: createEmptyOperationSummary(),
    };
  }

  document.body.innerHTML = html;
  const operationSummary = createEmptyOperationSummary();

  operationSummary.wrapperStyleNormalizedCount =
    normalizeWrapperStylesAroundImages(document.body);
  normalizeLegacyImgAlign(document.body, operationSummary);
  stripLegacyNoiseClasses(document.body, operationSummary);
  stripLegacyInlineStyles(document.body, operationSummary);
  sanitizeImgElements(document.body, operationSummary);

  const sanitizedHtml = normalizeVoidTagsToSelfClosing(document.body.innerHTML);
  document.body.innerHTML = '';

  const changed = hasSummaryChanges(operationSummary);

  return {
    html: changed ? sanitizedHtml : html,
    changed,
    operationSummary,
  };
}

function buildHtmlSanitizePatch(record) {
  const patch = {};
  const changedFields = [];
  const fieldDetails = [];
  const operationSummary = createEmptyOperationSummary();

  for (const field of HTML_FIELDS) {
    const currentValue = record?.[field];
    if (typeof currentValue !== 'string') {
      continue;
    }

    const result = sanitizeHtmlFieldForStorage(currentValue);
    if (!result.changed) {
      continue;
    }

    patch[field] = result.html;
    changedFields.push(field);
    accumulateSummary(operationSummary, result.operationSummary);
    fieldDetails.push({
      field,
      operationSummary: result.operationSummary,
      beforeLength: currentValue.length,
      afterLength: result.html.length,
    });
  }

  return {
    patch,
    changedFields,
    fieldDetails,
    operationSummary,
    changed: changedFields.length > 0,
    hasOperations: hasSummaryChanges(operationSummary),
  };
}

module.exports = {
  HTML_FIELDS,
  buildHtmlSanitizePatch,
  createEmptyOperationSummary,
  sanitizeHtmlFieldForStorage,
};