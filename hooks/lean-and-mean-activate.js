#!/usr/bin/env node
// lean-and-mean — SessionStart hook.
// Runs on every project, with or without a CLAUDE.md:
//   1. defaults the flag to "full" if unset,
//   2. emits the operating-mode block (source of truth: SKILL.md),
//   3. emits the project's learned Rules,
//   4. emits ONE maintenance line — "no maintenance needed" when nothing is due.

const fs = require('fs');
const path = require('path');
const {
  getFlagPath, safeWriteFlag, readFlag, readInjectedBlock, readText,
} = require('./lean-and-mean-config');

const HARD_CAP = 250;
const FALLBACK =
  'Lean and mean, level full. Prose: drop articles/filler/hedging. Code: YAGNI ladder — ' +
  'reuse/stdlib/native/one-line before new code. Review sessions, turn mistakes into rules, ' +
  'never repeat them. Code, commits, PRs, security text: always full normal writing.';

let input = '';
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  let cwd = process.cwd();
  try { cwd = JSON.parse(input).cwd || cwd; } catch (e) {}

  const flagPath = getFlagPath();
  let mode = readFlag(flagPath);
  if (!mode) {
    mode = 'full';
    safeWriteFlag(flagPath, mode);
  }
  if (mode === 'off') process.exit(0);

  const parts = [`LEAN-AND-MEAN MODE ACTIVE — level: ${mode}`, readInjectedBlock() || FALLBACK];

  const claudeMd = readText(path.join(cwd, 'CLAUDE.md'));
  const summaryMd = readText(path.join(cwd, 'SUMMARY.md'));

  const rules = claudeMd && /^##\s+Rules\s*$/m.test(claudeMd)
    ? claudeMd.split(/^##\s+Rules\s*$/m)[1].split(/^##\s/m)[0].trim()
    : '';
  if (rules) parts.push(`PROJECT RULES (binding — do not re-litigate):\n${rules}`);

  parts.push(`MAINTENANCE: ${maintenance(claudeMd, summaryMd)}`);
  process.stdout.write(parts.join('\n\n'));
});

// Exactly one action line. "nothing due" is the common case and must stay quiet.
function maintenance(claudeMd, summaryMd) {
  if (claudeMd === null) return 'no CLAUDE.md here — run `/lean-and-mean md init` if this project is worth tracking.';

  const lines = claudeMd.split('\n').length;
  if (lines > HARD_CAP) return `CLAUDE.md is ${lines} lines, over the ${HARD_CAP} hard cap — run \`/lean-and-mean md split\`.`;

  const block = readInjectedBlock();
  if (block && drifted(block, claudeMd)) return 'CLAUDE.md Operating Mode block is missing or drifted — run `/lean-and-mean md review`.';

  if (summaryMd && /·\s*AGED/.test(summaryMd)) return 'SUMMARY.md has AGED entries — run `/lean-and-mean md review` to promote their lessons into Rules or drop them.';

  return 'CLAUDE.md current, nothing due. No action.';
}

// Tolerant match: ≥90% of the block's non-empty lines present, whitespace-normalized.
function drifted(block, claudeMd) {
  const norm = s => s.replace(/\s+/g, ' ').trim();
  const hay = norm(claudeMd);
  const needles = block.split('\n').map(norm).filter(Boolean);
  const hits = needles.filter(n => hay.includes(n)).length;
  return hits / needles.length < 0.9;
}
