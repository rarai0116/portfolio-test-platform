#!/usr/bin/env node

const payload = {
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext:
      'This repository uses a human-led workflow. Do not decide stage transitions, stage skipping, or completion. Canonical document priority is: user-designated source, docs/current, docs/.ai-works, archive documents. docs/.ai-works is readable but not the source of truth. Archive documents should only be used when the user explicitly asks. Ask before package installation. Report every document move with source, destination, and reason. Keep changes limited to AGENTS.md, .codex, .agents, and other explicitly requested files.',
  },
};

process.stdout.write(JSON.stringify(payload));