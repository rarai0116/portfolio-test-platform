#!/usr/bin/env node

const fs = require('node:fs');

const inputText = fs.readFileSync(0, 'utf8');
const input = inputText ? JSON.parse(inputText) : {};

const normalize = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\\/g, '/');
};

const normalizeLower = (value) => normalize(String(value)).toLowerCase();

const collectStrings = (value, bucket = []) => {
  if (typeof value === 'string') {
    bucket.push(value);
    return bucket;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, bucket);
    }
    return bucket;
  }

  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectStrings(item, bucket);
    }
  }

  return bucket;
};

const containsArchivePath = (value) => {
  const archiveSegment = '/' + 'docs' + '/' + 'archive';
  return normalizeLower(value).includes(archiveSegment);
};

const containsSecretEnvPath = (value) => {
  const normalized = normalizeLower(value);
  const marker = '.' + 'env';
  return normalized.includes('/' + marker) || normalized.endsWith('/' + marker) || normalized.includes('/' + marker + '.');
};

const makeDeny = (reason) => ({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: reason,
  },
});

const toolName = String(input.tool_name || '');
const toolInput = input.tool_input || {};
const toolStrings = collectStrings(toolInput);
const command = String(toolInput.command || '').toLowerCase();

const destructivePatterns = [
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+checkout\s+--\b/,
  /\bgit\s+clean\s+-fd\b/,
  /\brm\s+-rf\b/,
  /\bremove-item\b.*\b-recurse\b.*\b-force\b/,
];

if (toolName === 'Bash' && destructivePatterns.some((pattern) => pattern.test(command))) {
  process.stdout.write(JSON.stringify(makeDeny('Destructive command blocked by repository policy.')));
  process.exit(0);
}

if (toolStrings.some(containsArchivePath)) {
  process.stdout.write(JSON.stringify(makeDeny('Editing archive documents is blocked by repository policy.')));
  process.exit(0);
}

if (toolStrings.some(containsSecretEnvPath) || containsSecretEnvPath(command)) {
  process.stdout.write(JSON.stringify(makeDeny('Secret environment files are protected by repository policy.')));
  process.exit(0);
}