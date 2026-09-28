#!/usr/bin/env node

const payload = {
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext:
      'This repository uses a human-led workflow. The AI must not decide stage transitions, stage skipping, or completion. Canonical document priority is: user-designated source, docs/current, docs/.ai-works, docs/archive. docs/.ai-works is readable but not the source of truth. docs/archive should only be used when the user explicitly requests it. Ask before package installation. Report every document move with source, destination, and reason.',
  },
};

process.stdout.write(JSON.stringify(payload));