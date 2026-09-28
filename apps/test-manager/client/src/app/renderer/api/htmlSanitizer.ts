import { parseAssetUrl } from '@shared/types/assets';
import type {
  TelemetrySanitizerRejection,
  TelemetrySanitizerReportPayload,
} from '@shared/types/telemetry';
import katex from 'katex';
import { isKnownDummyImageUrl } from './dummyImage';

export type SanitizerProfile =
  | 'persisted'
  | 'editor-runtime'
  | 'quill-import'
  | 'preview-render';

export type SanitizerBoundary =
  | 'load'
  | 'save'
  | 'editor-runtime'
  | 'quill-paste'
  | 'preview';

export type SanitizerRuleCode =
  | 'blocked-tag'
  | 'blocked-attribute'
  | 'blocked-class'
  | 'blocked-style-property'
  | 'blocked-style-value'
  | 'stripped-src'
  | 'formula-recovery-failed';

export type SanitizerContext = {
  boundary: SanitizerBoundary;
  itemId?: string;
  fieldName?: string;
  route?: string;
};

export type SanitizerRejectionReport = {
  profile: SanitizerProfile;
  boundary: SanitizerBoundary;
  ruleCode: SanitizerRuleCode;
  tagName?: string;
  attributeName?: string;
  className?: string;
  styleProperty?: string;
  reasonText: string;
  itemId?: string;
  fieldName?: string;
  route?: string;
  sampleText?: string;
  sampleHash: string;
  occurredAt: string;
  rejectionCount: number;
};

export type SanitizedHtmlResult = {
  sanitizedHtml: string;
  rejectionReport: SanitizerRejectionReport[];
  normalizationSummary: {
    wrapperStyleNormalizedCount: number;
    formulaCanonicalizedCount: number;
  };
};

const NBSP = '\u00A0';
const FORMULA_SELECTOR = '.ql-formula';
const EMPTY_P_BR_RE = /^\s*<p>\s*<br\s*\/?>\s*<\/p>\s*$/i;
const TRAILING_SPACE_BEFORE_CLOSING_P_RE = /(\s+)(<\/p>)$/i;

export const KATEX_ACTIVE_CHAR_MACROS = {
  '①': '\\text{(1)}',
  '②': '\\text{(2)}',
  '③': '\\text{(3)}',
  '④': '\\text{(4)}',
  '⑤': '\\text{(5)}',
  '⑥': '\\text{(6)}',
  '⑦': '\\text{(7)}',
  '⑧': '\\text{(8)}',
  '⑨': '\\text{(9)}',
  '⑩': '\\text{(10)}',
  '⑪': '\\text{(11)}',
  '⑫': '\\text{(12)}',
  '⑬': '\\text{(13)}',
  '⑭': '\\text{(14)}',
  '⑮': '\\text{(15)}',
  '⑯': '\\text{(16)}',
  '⑰': '\\text{(17)}',
  '⑱': '\\text{(18)}',
  '⑲': '\\text{(19)}',
  '⑳': '\\text{(20)}',

  // 2. エディタ由来の文字化け・自動変換対策
  '’': "'",
  '“': '"',
  '”': '"',
  '′': '\\prime',
  '″': '\\prime\\prime',
  '‴': '\\prime\\prime\\prime',

  // 3. 数式記号として使われがちなUnicode
  '×': '\\times',
  '÷': '\\div',
  '≠': '\\neq',
  '≤': '\\leq',
  '≥': '\\geq',
  '∴': '\\therefore',
  '∵': '\\because',
  '∞': '\\infty',
  '°': '^\\circ',
  '％': '\\%',

  // 4．その他の文字化け対策
  '㎟': '\\mathrm{mm}^{2}',
  '㎣': '\\mathrm{mm}^{3}',
  '㎠': '\\mathrm{cm}^{2}',
  '㎤': '\\mathrm{cm}^{3}',
  '㎡': '\\mathrm{m}^{2}',
  '㎥': '\\mathrm{m}^{3}',
  '㎢': '\\mathrm{km}^{2}',
  '㎦': '\\mathrm{km}^{3}',
  '㎜': '\\mathrm{mm}',
  '㎝': '\\mathrm{cm}',
  '㎞': '\\mathrm{km}',
  '㎎': '\\mathrm{mg}',
  '㎏': '\\mathrm{kg}',
  '㎖': '\\mathrm{mL}',
  '㍑': '\\mathrm{L}',
  '㏄': '\\mathrm{cm}^{3}',
} as const;

const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'em',
  'u',
  's',
  'sub',
  'sup',
  'span',
  'img',
  'ol',
  'ul',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]);

const DROP_SUBTREE_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'frame',
  'object',
  'embed',
  'svg',
  'math',
  'link',
  'meta',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'video',
  'audio',
  'canvas',
  'template',
]);

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
const EDITOR_RUNTIME_IMG_DATA_SIZE_RE = /^\d{1,5},\d{1,5}$/;
const INLINE_WRAPPER_TAGS = new Set(['strong', 'em', 'u', 's', 'span']);
const LEGACY_INLINE_STYLE_NOTICE_TAGS = new Set([
  'span',
  'strong',
  'em',
  'u',
  's',
  'sub',
  'sup',
]);

const BANNED_STYLE_VALUE_RE =
  /(url\s*\(|expression\s*\(|javascript:|vbscript:|data:)/i;
const ALLOWED_EMBEDDED_IMG_SRC_RE =
  /^data:image\/(png|jpeg|jpg|gif|webp);base64,[a-z0-9+/=\s]+$/i;

/** Quillへ新たに取り込める画像URL。内部ダミーは完全一致だけを許可する。 */
export const isAllowedQuillImageSource = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed || value !== trimmed) return false;
  return parseAssetUrl(trimmed) !== null || isKnownDummyImageUrl(trimmed);
};

const createNormalizationSummary = () => ({
  wrapperStyleNormalizedCount: 0,
  formulaCanonicalizedCount: 0,
});

const hasNormalizationChanges = (summary: {
  wrapperStyleNormalizedCount: number;
  formulaCanonicalizedCount: number;
}): boolean => {
  return (
    summary.wrapperStyleNormalizedCount > 0 ||
    summary.formulaCanonicalizedCount > 0
  );
};

const normalizeVoidTagsToSelfClosing = (html: string): string => {
  return html
    .replace(/<br(\s[^<>]*?)?\s*\/?>/gi, (_match, attrs: string = '') => {
      return `<br${attrs || ''} />`;
    })
    .replace(/<img(\s[^<>]*?)?\s*\/?>/gi, (_match, attrs: string = '') => {
      return `<img${attrs || ''} />`;
    });
};

const getCurrentRoute = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;

  const hash = window.location.hash || '#/';
  return hash.startsWith('#') ? hash : `#${hash}`;
};

const hashText = (value: string): string => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
};

const trimSampleText = (value: string | undefined): string | undefined => {
  if (!value) return undefined;

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;

  return normalized.length > 120 ? normalized.slice(0, 120) : normalized;
};

const extractFormulaValue = (el: Element): string => {
  const dataValue = el.getAttribute('data-value');
  if (dataValue) return dataValue;

  const annotation = el.querySelector(
    'annotation[encoding="application/x-tex"]',
  );
  return annotation?.textContent?.trim() ?? '';
};

const normalizeTextForQuillImport = (text: string): string => {
  return text
    .replace(/\u3000+/g, (spaces) => '  '.repeat(spaces.length))
    .replace(/ {2,}/g, (spaces) => `${NBSP.repeat(spaces.length - 1)} `);
};

const normalizeTextFromQuillExport = (text: string): string => {
  return text.replace(/\u00A0/g, ' ');
};

const walkTextNodes = (
  root: ParentNode,
  mapper: (text: string) => string,
): void => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();

  while (current) {
    const parent = current.parentElement;
    if (!parent?.closest(FORMULA_SELECTOR)) {
      current.textContent = mapper(current.textContent ?? '');
    }
    current = walker.nextNode();
  }
};

const renderFormulaMarkup = (value: string): string => {
  const escapedValue = value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<span class="ql-formula" data-value="${escapedValue}"></span>`;
};

const inflateFormulaElements = (root: ParentNode): void => {
  const formulaNodes = Array.from(
    root.querySelectorAll?.(FORMULA_SELECTOR) ?? [],
  );

  for (const node of formulaNodes) {
    const value = extractFormulaValue(node);
    if (!value) continue;

    const rendered = katex.renderToString(value, {
      throwOnError: false,
      output: 'htmlAndMathml',
      strict: 'ignore',
      macros: KATEX_ACTIVE_CHAR_MACROS,
    });

    const template = document.createElement('template');
    template.innerHTML = renderFormulaMarkup(value);
    const renderedNode = template.content.firstElementChild;
    if (!renderedNode) continue;

    renderedNode.innerHTML = rendered;
    node.replaceWith(renderedNode);
  }
};

const recoverLegacyFormulaElements = (
  root: ParentNode,
  reports: SanitizerRejectionReport[],
  profile: SanitizerProfile,
  context: SanitizerContext,
): number => {
  const formulaNodes = Array.from(
    root.querySelectorAll?.(FORMULA_SELECTOR) ?? [],
  );

  let formulaCanonicalizedCount = 0;

  for (const node of formulaNodes) {
    const value = extractFormulaValue(node);
    if (!value) {
      reports.push(
        createReport({
          profile,
          context,
          ruleCode: 'formula-recovery-failed',
          tagName: node.tagName.toLowerCase(),
          reasonText: '数式の data-value を復元できませんでした',
          sampleText: node.outerHTML,
        }),
      );
      node.remove();
      continue;
    }

    const alreadyCanonical =
      node.tagName.toLowerCase() === 'span' &&
      node.getAttribute('class') === 'ql-formula' &&
      node.getAttribute('data-value') === value &&
      node.attributes.length === 2 &&
      node.childNodes.length === 0;
    if (alreadyCanonical) {
      continue;
    }

    const replacement = node.ownerDocument.createElement('span');
    replacement.className = 'ql-formula';
    replacement.setAttribute('data-value', value);
    node.replaceWith(replacement);
    formulaCanonicalizedCount += 1;
  }

  return formulaCanonicalizedCount;
};

const isAllowedClassName = (
  className: string,
  tagName: string,
  profile: SanitizerProfile,
): boolean => {
  if (
    profile === 'preview-render' &&
    tagName === 'p' &&
    className === 'top-level'
  ) {
    return true;
  }

  // 選択肢番号マーク(choice-index-mark)はレンダリング時にpatchRenderPreview/fullRenderPreviewが
  // 付与する内部用クラスのため、preview-renderプロファイル下のspanでのみ許可する
  if (
    profile === 'preview-render' &&
    tagName === 'span' &&
    className === 'choice-index-mark'
  ) {
    return true;
  }

  return (
    className === 'ql-formula' ||
    /^ql-align-(center|right|justify)$/.test(className) ||
    /^ql-indent-[1-8]$/.test(className)
  );
};

const isAllowedCssLength = (value: string): boolean => {
  return /^(auto|0|[0-9]+(?:\.[0-9]+)?(?:px|%|em|rem|vh|vw))$/i.test(value);
};

const isAllowedMaxSizeValue = (value: string): boolean => {
  return /^(none|auto|0|[0-9]+(?:\.[0-9]+)?(?:px|%|em|rem|vh|vw))$/i.test(
    value,
  );
};

const isAllowedMarginValue = (value: string): boolean => {
  return /^(auto|0|[0-9]+(?:\.[0-9]+)?(?:px|%|em|rem))(\s+(auto|0|[0-9]+(?:\.[0-9]+)?(?:px|%|em|rem))){0,3}$/i.test(
    value,
  );
};

const isAllowedStyleValue = (property: string, value: string): boolean => {
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
};

const isAllowedImgSrc = (profile: SanitizerProfile, value: string): boolean => {
  if (
    profile !== 'quill-import' &&
    profile !== 'editor-runtime' &&
    profile !== 'preview-render'
  )
    return false;

  const trimmed = value.trim();

  // Quill取込では正規のasset URLと内部ダミーだけを許可し、
  // 他アプリ由来のHTTP・data・blob画像を取り込まない（設計10.3）。
  if (profile === 'quill-import') {
    return isAllowedQuillImageSource(value);
  }

  // 実行・プレビュー用プロファイルでは厳格な demo-asset URL を許可する。
  // 未知query・重複query・逆順queryは parseAssetUrl が拒否する。
  if (parseAssetUrl(trimmed) !== null) {
    return true;
  }

  // DUMMY_IMG 等の静的 data URL 許可は維持する。
  return ALLOWED_EMBEDDED_IMG_SRC_RE.test(trimmed);
};

const createReport = (params: {
  profile: SanitizerProfile;
  context: SanitizerContext;
  ruleCode: SanitizerRuleCode;
  reasonText: string;
  tagName?: string;
  attributeName?: string;
  className?: string;
  styleProperty?: string;
  sampleText?: string;
}): SanitizerRejectionReport => {
  const route = params.context.route ?? getCurrentRoute();
  const sampleText = trimSampleText(params.sampleText);
  const sampleHash = hashText(
    [
      params.profile,
      params.context.boundary,
      params.ruleCode,
      params.tagName,
      params.attributeName,
      params.className,
      params.styleProperty,
      sampleText,
    ]
      .filter(Boolean)
      .join('|'),
  );

  return {
    profile: params.profile,
    boundary: params.context.boundary,
    ruleCode: params.ruleCode,
    tagName: params.tagName,
    attributeName: params.attributeName,
    className: params.className,
    styleProperty: params.styleProperty,
    reasonText: params.reasonText,
    itemId: params.context.itemId,
    fieldName: params.context.fieldName,
    route,
    sampleText,
    sampleHash,
    occurredAt: new Date().toISOString(),
    rejectionCount: 1,
  };
};

const aggregateReports = (
  reports: SanitizerRejectionReport[],
): SanitizerRejectionReport[] => {
  const grouped = new Map<string, SanitizerRejectionReport>();

  for (const report of reports) {
    const key = [
      report.profile,
      report.boundary,
      report.ruleCode,
      report.tagName,
      report.attributeName,
      report.className,
      report.styleProperty,
      report.sampleHash,
      report.fieldName,
      report.itemId,
    ].join('|');

    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, report);
      continue;
    }

    current.rejectionCount += report.rejectionCount;
  }

  return [...grouped.values()];
};

const toTelemetryPayload = (
  reports: SanitizerRejectionReport[],
): TelemetrySanitizerReportPayload => {
  const rejections: TelemetrySanitizerRejection[] = reports.map((report) => ({
    profile: report.profile,
    boundary: report.boundary,
    ruleCode: report.ruleCode,
    tagName: report.tagName,
    attributeName: report.attributeName,
    className: report.className,
    styleProperty: report.styleProperty,
    reasonText: report.reasonText,
    fieldName: report.fieldName,
    route: report.route,
    sampleText: report.sampleText,
    sampleHash: report.sampleHash,
    itemIdHash: report.itemId ? hashText(report.itemId) : undefined,
    occurredAt: report.occurredAt,
    rejectionCount: report.rejectionCount,
  }));

  return { rejections };
};

const isLegacyStyleNoiseReport = (
  report: SanitizerRejectionReport,
): boolean => {
  if (
    report.ruleCode === 'blocked-attribute' &&
    report.attributeName === 'style' &&
    report.tagName &&
    LEGACY_INLINE_STYLE_NOTICE_TAGS.has(report.tagName)
  ) {
    return true;
  }

  if (
    report.ruleCode === 'blocked-style-property' &&
    report.tagName === 'img' &&
    report.styleProperty &&
    ['zoom', 'white-space', 'color', 'background-color'].includes(
      report.styleProperty,
    )
  ) {
    return true;
  }

  return false;
};

const isLegacyEditorClassNoiseReport = (
  report: SanitizerRejectionReport,
): boolean => {
  return (
    report.ruleCode === 'blocked-class' &&
    (report.className === 'active' || report.className === 'ql-cursor')
  );
};

const isLegacyDimensionNoiseReport = (
  report: SanitizerRejectionReport,
): boolean => {
  return (
    report.ruleCode === 'blocked-attribute' &&
    report.tagName === 'img' &&
    (report.attributeName === 'width' || report.attributeName === 'height') &&
    /^(width|height)=null$/i.test(report.sampleText ?? '')
  );
};

const isNotificationReport = (report: SanitizerRejectionReport): boolean => {
  return (
    report.ruleCode === 'stripped-src' ||
    isLegacyStyleNoiseReport(report) ||
    isLegacyEditorClassNoiseReport(report) ||
    isLegacyDimensionNoiseReport(report)
  );
};

const formatConsoleReportLine = (
  report: SanitizerRejectionReport,
  level: '通知' | '警告',
): string => {
  const itemId = report.itemId ?? 'unknown';
  const fieldName = report.fieldName ?? 'unknown';
  const route = report.route ?? 'unknown';
  const tagName = report.tagName ?? 'unknown';
  const attributeName = report.attributeName ?? '-';
  const styleProperty = report.styleProperty ?? '-';
  const sampleText = report.sampleText ?? '-';

  return [
    `[html-sanitizer][${level}]`,
    `testId=${itemId}`,
    `field=${fieldName}`,
    `route=${route}`,
    `profile=${report.profile}`,
    `boundary=${report.boundary}`,
    `rule=${report.ruleCode}`,
    `tag=${tagName}`,
    `attribute=${attributeName}`,
    `styleProperty=${styleProperty}`,
    `count=${report.rejectionCount}`,
    `reason=${report.reasonText}`,
    `sample=${sampleText}`,
  ].join(' | ');
};

const reportRejections = (reports: SanitizerRejectionReport[]): void => {
  if (reports.length === 0) return;

  const notifications = reports.filter(isNotificationReport);
  const warnings = reports.filter((report) => !isNotificationReport(report));

  if (notifications.length > 0) {
    for (const report of notifications) {
      console.warn(formatConsoleReportLine(report, '通知'));
    }
  }

  if (warnings.length > 0) {
    for (const report of warnings) {
      console.error(formatConsoleReportLine(report, '警告'));
    }
    void window.telemetry?.reportSanitizerRejection?.(
      toTelemetryPayload(warnings),
    );
  }
};

const sanitizeClassAttribute = (
  el: Element,
  target: HTMLElement,
  reports: SanitizerRejectionReport[],
  profile: SanitizerProfile,
  context: SanitizerContext,
): void => {
  const rawClassName = el.getAttribute('class');
  if (!rawClassName) return;

  const tagName = el.tagName.toLowerCase();

  const classNames = rawClassName
    .split(/\s+/)
    .map((className) => className.trim())
    .filter(Boolean);

  const kept = classNames.filter((className) =>
    isAllowedClassName(className, tagName, profile),
  );
  const removed = classNames.filter(
    (className) => !isAllowedClassName(className, tagName, profile),
  );

  for (const className of removed) {
    reports.push(
      createReport({
        profile,
        context,
        ruleCode: 'blocked-class',
        tagName,
        className,
        reasonText: '許可されていない class を除去しました',
        sampleText: rawClassName,
      }),
    );
  }

  if (kept.length > 0) {
    target.setAttribute('class', kept.join(' '));
  }
};

const sanitizeStyleAttribute = (
  rawStyle: string,
  el: Element,
  reports: SanitizerRejectionReport[],
  profile: SanitizerProfile,
  context: SanitizerContext,
): string | undefined => {
  const declarations = rawStyle
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean);

  const safeDeclarations: string[] = [];

  for (const declaration of declarations) {
    const separatorIndex = declaration.indexOf(':');
    if (separatorIndex === -1) {
      reports.push(
        createReport({
          profile,
          context,
          ruleCode: 'blocked-style-value',
          tagName: el.tagName.toLowerCase(),
          reasonText: 'style 値の構文が不正なため除去しました',
          sampleText: declaration,
        }),
      );
      continue;
    }

    const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
    const value = declaration.slice(separatorIndex + 1).trim();

    if (!ALLOWED_IMG_STYLE_PROPERTIES.has(property)) {
      reports.push(
        createReport({
          profile,
          context,
          ruleCode: 'blocked-style-property',
          tagName: el.tagName.toLowerCase(),
          styleProperty: property,
          reasonText: '許可されていない style property を除去しました',
          sampleText: declaration,
        }),
      );
      continue;
    }

    if (!isAllowedStyleValue(property, value)) {
      reports.push(
        createReport({
          profile,
          context,
          ruleCode: 'blocked-style-value',
          tagName: el.tagName.toLowerCase(),
          styleProperty: property,
          reasonText: '危険または未許可の style 値を除去しました',
          sampleText: declaration,
        }),
      );
      continue;
    }

    safeDeclarations.push(`${property}: ${value}`);
  }

  return safeDeclarations.length > 0 ? safeDeclarations.join('; ') : undefined;
};

const normalizeWrapperStylesAroundImages = (root: ParentNode): number => {
  const wrappers = Array.from(
    root.querySelectorAll?.(
      'strong[style], em[style], u[style], s[style], span[style]',
    ) ?? [],
  );

  let normalizedCount = 0;

  for (const wrapper of wrappers) {
    const tagName = wrapper.tagName.toLowerCase();
    if (!INLINE_WRAPPER_TAGS.has(tagName)) continue;

    const childNodes = Array.from(wrapper.childNodes).filter((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        return (node.textContent ?? '').trim().length > 0;
      }
      return node.nodeType === Node.ELEMENT_NODE;
    });

    if (
      childNodes.length !== 1 ||
      childNodes[0].nodeType !== Node.ELEMENT_NODE ||
      (childNodes[0] as Element).tagName.toLowerCase() !== 'img'
    ) {
      continue;
    }

    const img = childNodes[0] as HTMLElement;
    const wrapperStyle = wrapper.getAttribute('style')?.trim() ?? '';
    if (!wrapperStyle) continue;

    const mergedStyle = [img.getAttribute('style')?.trim(), wrapperStyle]
      .filter((value) => value && value.length > 0)
      .join('; ');

    if (mergedStyle) {
      img.setAttribute('style', mergedStyle);
    }

    wrapper.removeAttribute('style');
    normalizedCount += 1;
  }

  return normalizedCount;
};

const sanitizeAttribute = (
  el: Element,
  target: HTMLElement,
  attrName: string,
  attrValue: string,
  reports: SanitizerRejectionReport[],
  profile: SanitizerProfile,
  context: SanitizerContext,
): void => {
  const tagName = el.tagName.toLowerCase();
  const normalizedName = attrName.toLowerCase();

  if (normalizedName === 'class') {
    sanitizeClassAttribute(el, target, reports, profile, context);
    return;
  }

  if (normalizedName.startsWith('on')) {
    reports.push(
      createReport({
        profile,
        context,
        ruleCode: 'blocked-attribute',
        tagName,
        attributeName: normalizedName,
        reasonText: 'イベント属性を除去しました',
        sampleText: `${normalizedName}=${attrValue}`,
      }),
    );
    return;
  }

  if (normalizedName === 'src') {
    if (tagName === 'img' && isAllowedImgSrc(profile, attrValue)) {
      target.setAttribute('src', attrValue.trim());
      return;
    }

    reports.push(
      createReport({
        profile,
        context,
        ruleCode: 'stripped-src',
        tagName,
        attributeName: normalizedName,
        reasonText: 'img src は保存しないため除去しました',
        sampleText: attrValue,
      }),
    );
    return;
  }

  if (normalizedName.startsWith('aria-')) {
    reports.push(
      createReport({
        profile,
        context,
        ruleCode: 'blocked-attribute',
        tagName,
        attributeName: normalizedName,
        reasonText: '許可されていない aria 属性を除去しました',
        sampleText: `${normalizedName}=${attrValue}`,
      }),
    );
    return;
  }

  if (tagName === 'span' && target.classList.contains('ql-formula')) {
    if (normalizedName === 'data-value' && attrValue.trim()) {
      target.setAttribute('data-value', attrValue.trim());
      return;
    }
  }

  if (tagName === 'img' && ALLOWED_IMG_ATTRIBUTES.has(normalizedName)) {
    if (normalizedName === 'style') {
      const safeStyle = sanitizeStyleAttribute(
        attrValue,
        el,
        reports,
        profile,
        context,
      );
      if (safeStyle) target.setAttribute('style', safeStyle);
      return;
    }

    if (
      (normalizedName === 'width' || normalizedName === 'height') &&
      attrValue.trim() !== '' &&
      !/^\d{1,4}$/.test(attrValue.trim())
    ) {
      reports.push(
        createReport({
          profile,
          context,
          ruleCode: 'blocked-attribute',
          tagName,
          attributeName: normalizedName,
          reasonText: 'width / height 属性は数値のみ許可します',
          sampleText: `${normalizedName}=${attrValue}`,
        }),
      );
      return;
    }

    if (normalizedName === 'width' || normalizedName === 'height') {
      target.setAttribute(normalizedName, attrValue.trim());
      return;
    }

    if (attrValue.trim()) {
      target.setAttribute(normalizedName, attrValue.trim());
    }
    return;
  }

  if (
    tagName === 'img' &&
    profile === 'editor-runtime' &&
    normalizedName === 'data-size'
  ) {
    const trimmed = attrValue.trim();
    if (EDITOR_RUNTIME_IMG_DATA_SIZE_RE.test(trimmed)) {
      target.setAttribute(normalizedName, trimmed);
      return;
    }

    reports.push(
      createReport({
        profile,
        context,
        ruleCode: 'blocked-attribute',
        tagName,
        attributeName: normalizedName,
        reasonText: 'data-size 属性は数値ペアのみ許可します',
        sampleText: `${normalizedName}=${attrValue}`,
      }),
    );
    return;
  }

  reports.push(
    createReport({
      profile,
      context,
      ruleCode: 'blocked-attribute',
      tagName,
      attributeName: normalizedName,
      reasonText: '許可されていない属性を除去しました',
      sampleText: `${normalizedName}=${attrValue}`,
    }),
  );
};

const sanitizeChildren = (
  source: ParentNode,
  target: ParentNode,
  reports: SanitizerRejectionReport[],
  profile: SanitizerProfile,
  context: SanitizerContext,
): void => {
  for (const child of Array.from(source.childNodes)) {
    sanitizeNode(child, target, reports, profile, context);
  }
};

const sanitizeElementNode = (
  el: Element,
  targetParent: ParentNode,
  reports: SanitizerRejectionReport[],
  profile: SanitizerProfile,
  context: SanitizerContext,
): void => {
  const tagName = el.tagName.toLowerCase();

  if (!ALLOWED_TAGS.has(tagName)) {
    reports.push(
      createReport({
        profile,
        context,
        ruleCode: 'blocked-tag',
        tagName,
        reasonText: '許可されていないタグを除去しました',
        sampleText: el.outerHTML,
      }),
    );

    if (!DROP_SUBTREE_TAGS.has(tagName)) {
      sanitizeChildren(el, targetParent, reports, profile, context);
    }
    return;
  }

  const target = document.createElement(tagName);

  if (tagName === 'span' && el.classList.contains('ql-formula')) {
    target.setAttribute('class', 'ql-formula');
    const value = extractFormulaValue(el);
    if (!value) {
      reports.push(
        createReport({
          profile,
          context,
          ruleCode: 'formula-recovery-failed',
          tagName,
          reasonText: '数式の data-value を復元できませんでした',
          sampleText: el.outerHTML,
        }),
      );
      return;
    }
    target.setAttribute('data-value', value);
  }

  for (const attribute of Array.from(el.attributes)) {
    sanitizeAttribute(
      el,
      target,
      attribute.name,
      attribute.value,
      reports,
      profile,
      context,
    );
  }

  if (tagName !== 'img' && tagName !== 'br') {
    sanitizeChildren(el, target, reports, profile, context);
  }

  targetParent.appendChild(target);
};

const sanitizeNode = (
  node: ChildNode,
  targetParent: ParentNode,
  reports: SanitizerRejectionReport[],
  profile: SanitizerProfile,
  context: SanitizerContext,
): void => {
  if (node.nodeType === Node.TEXT_NODE) {
    targetParent.appendChild(document.createTextNode(node.textContent ?? ''));
    return;
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    sanitizeElementNode(
      node as Element,
      targetParent,
      reports,
      profile,
      context,
    );
  }
};

const sanitizeCanonicalHtml = (
  html: string,
  profile: SanitizerProfile,
  context: SanitizerContext,
): SanitizedHtmlResult => {
  if (!html || typeof html !== 'string') {
    return {
      sanitizedHtml: '',
      rejectionReport: [],
      normalizationSummary: createNormalizationSummary(),
    };
  }

  const template = document.createElement('template');
  template.innerHTML = html;

  const reports: SanitizerRejectionReport[] = [];
  const normalizationSummary = createNormalizationSummary();
  normalizationSummary.wrapperStyleNormalizedCount =
    normalizeWrapperStylesAroundImages(template.content);
  normalizationSummary.formulaCanonicalizedCount = recoverLegacyFormulaElements(
    template.content,
    reports,
    profile,
    context,
  );

  const output = document.createElement('template');
  sanitizeChildren(template.content, output.content, reports, profile, context);

  let sanitizedHtml = normalizeVoidTagsToSelfClosing(output.innerHTML);
  if (EMPTY_P_BR_RE.test(sanitizedHtml)) {
    sanitizedHtml = '';
  } else {
    sanitizedHtml = sanitizedHtml.replace(
      TRAILING_SPACE_BEFORE_CLOSING_P_RE,
      '$2',
    );
  }

  const rejectionReport = aggregateReports(reports);
  reportRejections(rejectionReport);

  if (
    rejectionReport.length === 0 &&
    !hasNormalizationChanges(normalizationSummary)
  ) {
    return {
      sanitizedHtml: html,
      rejectionReport,
      normalizationSummary,
    };
  }

  return { sanitizedHtml, rejectionReport, normalizationSummary };
};

export const sanitizePersistedHtml = (
  html: string,
  context: SanitizerContext,
): SanitizedHtmlResult => {
  return sanitizeCanonicalHtml(html, 'persisted', context);
};

export const sanitizeEditorRuntimeHtml = (
  html: string,
  context: Omit<SanitizerContext, 'boundary'> & {
    boundary?: Extract<SanitizerBoundary, 'editor-runtime'>;
  } = {},
): SanitizedHtmlResult => {
  return sanitizeCanonicalHtml(html, 'editor-runtime', {
    ...context,
    boundary: 'editor-runtime',
  });
};

export const sanitizeForQuillImport = (
  html: string,
  context: Omit<SanitizerContext, 'boundary'> & {
    boundary?: Extract<SanitizerBoundary, 'quill-paste'>;
  } = {},
): SanitizedHtmlResult => {
  const base = sanitizeCanonicalHtml(html, 'quill-import', {
    ...context,
    boundary: 'quill-paste',
  });
  if (!base.sanitizedHtml) return base;

  const template = document.createElement('template');
  template.innerHTML = base.sanitizedHtml;
  walkTextNodes(template.content, normalizeTextForQuillImport);
  inflateFormulaElements(template.content);

  return { ...base, sanitizedHtml: template.innerHTML };
};

export const sanitizeForPreviewRender = (
  html: string,
  context: Omit<SanitizerContext, 'boundary'> & {
    boundary?: Extract<SanitizerBoundary, 'preview'>;
  } = {},
): SanitizedHtmlResult => {
  const base = sanitizeCanonicalHtml(html, 'preview-render', {
    ...context,
    boundary: 'preview',
  });
  if (!base.sanitizedHtml) return base;

  const template = document.createElement('template');
  template.innerHTML = base.sanitizedHtml;
  inflateFormulaElements(template.content);

  return { ...base, sanitizedHtml: template.innerHTML };
};

export const normalizeHtmlFromQuillExport = (html: string): string => {
  if (!html) return '';

  const template = document.createElement('template');
  template.innerHTML = html;
  walkTextNodes(template.content, normalizeTextFromQuillExport);
  return template.innerHTML;
};
