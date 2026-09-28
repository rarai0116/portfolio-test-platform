#!/usr/bin/env node

const fs = require('node:fs');

const inputText = fs.readFileSync(0, 'utf8');
const input = inputText ? JSON.parse(inputText) : {};

const toolInput = input.tool_input || {};
const command = String(toolInput.command || '').toLowerCase();
const toolName = String(input.tool_name || '');

const makeDecision = (behavior, message) => ({
  hookSpecificOutput: {
    hookEventName: 'PermissionRequest',
    decision: {
      behavior,
      message,
    },
  },
});

const destructivePatterns = [
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+checkout\s+--\b/,
  /\bgit\s+clean\s+-fd\b/,
  /\brm\s+-rf\b/,
  /\bremove-item\b.*\b-recurse\b.*\b-force\b/,
];

if (toolName === 'Bash' && destructivePatterns.some((pattern) => pattern.test(command))) {
  process.stdout.write(
    JSON.stringify(makeDecision('deny', 'Destructive command blocked by repository policy.')),
  );
}