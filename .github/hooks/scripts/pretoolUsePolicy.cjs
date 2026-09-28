#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const input = JSON.parse(fs.readFileSync(0, 'utf8'));

const normalize = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\\/g, '/');
};

const normalizePathLike = (value) => normalize(String(value)).toLowerCase();

const containsArchivePath = (value) => normalizePathLike(value).includes('/docs/archive');

const containsSecretEnvPath = (value) => {
  const normalized = normalizePathLike(value);
  return /(^|\/|\\)\.env(\.|$)/.test(normalized);
};

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

const toolName = input.tool_name;
const toolInput = input.tool_input ?? {};
const toolStrings = collectStrings(toolInput);

const makeDecision = (permissionDecision, permissionDecisionReason, additionalContext) => ({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision,
    permissionDecisionReason,
    additionalContext,
  },
});

const terminalCommand =
  toolName === 'run_in_terminal'
    ? String(toolInput.command ?? '')
    : toolName === 'create_and_run_task'
      ? [toolInput.task?.command, ...(toolInput.task?.args ?? [])].filter(Boolean).join(' ')
      : '';

const normalizedCommand = terminalCommand.toLowerCase();

const destructiveCommandPatterns = [
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+checkout\s+--\b/,
  /\bgit\s+clean\s+-fd\b/,
  /\brm\s+-rf\b/,
];

if (destructiveCommandPatterns.some((pattern) => pattern.test(normalizedCommand))) {
  process.stdout.write(
    JSON.stringify(
      makeDecision(
        'deny',
        'Destructive command blocked by repository workflow policy.',
        'Use non-destructive alternatives and ask the user before any destructive cleanup.',
      ),
    ),
  );
  process.exit(0);
}

const installCommandPatterns = [
  /\bpnpm\s+install\b/,
  /\bpnpm\s+add\b/,
  /\bnpm\s+install\b/,
  /\bnpm\s+i\b/,
  /\byarn\s+add\b/,
  /\bbun\s+add\b/,
  /\bpip\s+install\b/,
  /\bpoetry\s+add\b/,
  /\bbrew\s+install\b/,
  /\bapt(-get)?\s+install\b/,
];

if (installCommandPatterns.some((pattern) => pattern.test(normalizedCommand))) {
  process.stdout.write(
    JSON.stringify(
      makeDecision(
        'ask',
        'Package installation requires user confirmation in this repository workflow.',
        'Confirm the package name and reason with the user before installing dependencies.',
      ),
    ),
  );
  process.exit(0);
}

const secretTargetedTools = new Set([
  'read_file',
  'list_dir',
  'grep_search',
  'file_search',
  'apply_patch',
  'create_file',
  'create_directory',
  'run_in_terminal',
]);

if (secretTargetedTools.has(toolName) && toolStrings.some(containsSecretEnvPath)) {
  process.stdout.write(
    JSON.stringify(
      makeDecision(
        'deny',
        'Secret environment files are protected by repository policy.',
        'Do not read, edit, create, move, or summarize .env files. Ask the user only for variable names and reasons when environment changes are needed.',
      ),
    ),
  );
  process.exit(0);
}

const archiveSensitiveTools = new Set([
  'read_file',
  'list_dir',
  'grep_search',
  'file_search',
  'semantic_search',
  'apply_patch',
  'create_file',
]);

if (archiveSensitiveTools.has(toolName) && toolStrings.some(containsArchivePath)) {
  const writeTools = new Set(['apply_patch', 'create_file']);
  const permissionDecision = writeTools.has(toolName) ? 'deny' : 'ask';
  const reason = writeTools.has(toolName)
    ? 'Editing docs/archive is blocked by repository workflow policy.'
    : 'Access to docs/archive requires explicit user direction.';
  const additionalContext = writeTools.has(toolName)
    ? 'Historical archive documents should not be rewritten by the AI without explicit user direction.'
    : 'docs/archive contains historical material. Use it only when the user explicitly asks for it.';

  process.stdout.write(JSON.stringify(makeDecision(permissionDecision, reason, additionalContext)));
  process.exit(0);
}

process.stdout.write(JSON.stringify(makeDecision('allow', 'Allowed by workflow policy.')));