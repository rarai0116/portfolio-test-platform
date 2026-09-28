#!/usr/bin/env node

const fs = require('node:fs');

const inputText = fs.readFileSync(0, 'utf8');
const input = inputText ? JSON.parse(inputText) : {};

const toolName = String(input.tool_name || '');
const toolInput = input.tool_input || {};
const commandText = String(toolInput.command || '').replace(/\\/g, '/').toLowerCase();

const touchedCodexConfig =
  toolName === 'apply_patch' &&
  (commandText.includes('/.codex/') || commandText.includes('/.agents/') || commandText.includes('/agents.md'));

if (touchedCodexConfig) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext:
          'Project Codex guidance changed. Validate hooks.json, custom agents, skills, and rules before finishing.',
      },
    }),
  );
}