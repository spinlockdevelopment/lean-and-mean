#!/usr/bin/env node
// lean-and-mean — UserPromptSubmit hook.
// Detects /lean-and-mean <level> and stop/normal-mode phrases to update the
// flag file, then (if active) injects a short per-turn reinforcement —
// SessionStart's full ruleset alone fades from attention over a long session.

const { getFlagPath, safeWriteFlag, readFlag, deleteFlag, VALID_MODES } = require('./lean-and-mean-config');

const flagPath = getFlagPath();

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const prompt = (data.prompt || '').trim().toLowerCase();

    // Deactivate: "stop lean-and-mean", "normal mode"
    if (/\b(stop|disable|deactivate|turn off)\b.*\blean-and-mean\b/.test(prompt) ||
        /\blean-and-mean\b.*\b(stop|disable|deactivate|turn off)\b/.test(prompt) ||
        /\bnormal mode\b/.test(prompt)) {
      deleteFlag(flagPath);
      return;
    }

    // /lean-and-mean [lite|full|ultra] — bare form re-activates at current/default level.
    // Plugin installs address the skill as /lean-and-mean:lean-and-mean.
    const cmdMatch = /^\/lean-and-mean(?::lean-and-mean)?(?:\s+(\S+))?/.exec(prompt);
    if (cmdMatch) {
      const arg = cmdMatch[1];
      if (arg && VALID_MODES.includes(arg) && arg !== 'off') {
        safeWriteFlag(flagPath, arg);
      } else if (!arg) {
        safeWriteFlag(flagPath, readFlag(flagPath) || 'full');
      }
      // unrecognized second token (e.g. "review", "debt") → leave flag untouched,
      // those are one-shot subcommands the skill handles itself
    }

    // Natural-language activation
    if (/\b(activate|enable|turn on|start)\b.*\blean.?and.?mean\b/.test(prompt) ||
        /\blean.?and.?mean\b.*\b(mode|activate|enable|turn on|start)\b/.test(prompt)) {
      if (!readFlag(flagPath)) safeWriteFlag(flagPath, 'full');
    }

    const mode = readFlag(flagPath);
    if (mode && mode !== 'off') {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext:
            `LEAN-AND-MEAN MODE ACTIVE (${mode}). Prose: drop articles/filler/hedging. ` +
            'Code: YAGNI ladder — reuse/stdlib/native/one-line before new code. ' +
            'Code/commits/PRs/security text: always full normal writing.'
        }
      }));
    }
  } catch (e) {
    // silent fail
  }
});
