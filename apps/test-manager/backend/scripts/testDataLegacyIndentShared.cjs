/** biome-ignore-all lint/style/useNodejsImportProtocol: backend utility script */

const { HTML_FIELDS } = require('./testDataFormulaCompactShared.cjs');

const LEGACY_INDENT_CLASS_RE = /^ql-indent-([1-9])$/;

function normalizeLegacyIndentLevel(level) {
  return Math.ceil(level / 3);
}

function parseLegacyYear(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function pickLegacyIndentTarget(record) {
  if (record?.isOriginal === true) {
    return {
      isTarget: false,
      reason: 'original',
      normalizedYear: null,
    };
  }

  const nengo = typeof record?.nengo === 'string' ? record.nengo.trim() : '';

  if (nengo === '平成' || nengo === 'H') {
    return {
      isTarget: true,
      reason: 'heisei',
      normalizedYear: parseLegacyYear(record?.year),
    };
  }

  if (nengo === '令和' || nengo === 'R') {
    const normalizedYear = parseLegacyYear(record?.year);
    if (normalizedYear === null) {
      return {
        isTarget: false,
        reason: 'invalid-year',
        normalizedYear: null,
      };
    }

    if (normalizedYear <= 6) {
      return {
        isTarget: true,
        reason: 'reiwa-legacy',
        normalizedYear,
      };
    }

    return {
      isTarget: false,
      reason: 'reiwa-modern',
      normalizedYear,
    };
  }

  return {
    isTarget: false,
    reason: 'unsupported-era',
    normalizedYear: parseLegacyYear(record?.year),
  };
}

function normalizeLegacyIndentClassValue(rawClassValue) {
  if (typeof rawClassValue !== 'string' || !rawClassValue.includes('ql-indent-')) {
    return {
      classValue: rawClassValue,
      changed: false,
      normalizedIndentClassCount: 0,
    };
  }

  const tokens = rawClassValue
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return {
      classValue: rawClassValue,
      changed: false,
      normalizedIndentClassCount: 0,
    };
  }

  let normalizedIndentClassCount = 0;
  const nextTokens = [];
  const seen = new Set();

  for (const token of tokens) {
    const match = LEGACY_INDENT_CLASS_RE.exec(token);
    const nextToken = match
      ? `ql-indent-${normalizeLegacyIndentLevel(Number(match[1]))}`
      : token;

    if (match && nextToken !== token) {
      normalizedIndentClassCount += 1;
    }

    if (seen.has(nextToken)) {
      continue;
    }

    nextTokens.push(nextToken);
    seen.add(nextToken);
  }

  if (normalizedIndentClassCount === 0) {
    return {
      classValue: rawClassValue,
      changed: false,
      normalizedIndentClassCount: 0,
    };
  }

  return {
    classValue: nextTokens.join(' '),
    changed: true,
    normalizedIndentClassCount,
  };
}

function normalizeLegacyIndentHtml(html) {
  if (!html || typeof html !== 'string' || !html.includes('ql-indent-')) {
    return {
      html: typeof html === 'string' ? html : '',
      changed: false,
      normalizedIndentClassCount: 0,
      changedAttributeCount: 0,
    };
  }

  let normalizedIndentClassCount = 0;
  let changedAttributeCount = 0;

  const normalizedHtml = html.replace(
    /(\bclass\s*=\s*)(["'])([\s\S]*?)\2/gi,
    (match, prefix, quote, classValue) => {
      const result = normalizeLegacyIndentClassValue(classValue);
      if (!result.changed) {
        return match;
      }

      normalizedIndentClassCount += result.normalizedIndentClassCount;
      changedAttributeCount += 1;
      return `${prefix}${quote}${result.classValue}${quote}`;
    },
  );

  return {
    html: changedAttributeCount > 0 ? normalizedHtml : html,
    changed: changedAttributeCount > 0,
    normalizedIndentClassCount,
    changedAttributeCount,
  };
}

function buildLegacyIndentPatch(record) {
  const patch = {};
  const changedFields = [];
  const fieldDetails = [];
  let normalizedIndentClassCount = 0;
  let changedAttributeCount = 0;

  for (const field of HTML_FIELDS) {
    const currentValue = record?.[field];
    if (typeof currentValue !== 'string') {
      continue;
    }

    const result = normalizeLegacyIndentHtml(currentValue);
    if (!result.changed) {
      continue;
    }

    patch[field] = result.html;
    changedFields.push(field);
    normalizedIndentClassCount += result.normalizedIndentClassCount;
    changedAttributeCount += result.changedAttributeCount;
    fieldDetails.push({
      field,
      normalizedIndentClassCount: result.normalizedIndentClassCount,
      changedAttributeCount: result.changedAttributeCount,
      beforeLength: currentValue.length,
      afterLength: result.html.length,
    });
  }

  return {
    patch,
    changedFields,
    fieldDetails,
    normalizedIndentClassCount,
    changedAttributeCount,
    changed: changedFields.length > 0,
  };
}

module.exports = {
  buildLegacyIndentPatch,
  normalizeLegacyIndentClassValue,
  normalizeLegacyIndentHtml,
  normalizeLegacyIndentLevel,
  parseLegacyYear,
  pickLegacyIndentTarget,
};