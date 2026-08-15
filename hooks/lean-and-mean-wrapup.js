#!/usr/bin/env node
// lean-and-mean — Stop hook.
// Fires at most ONCE per session, and only when the session actually changed
// code without touching the context files. Asks for the wrap-up pass: Next,
// Rules (mistakes → rules), SUMMARY.md entry.
// Silent in every other case — a Stop hook runs at the end of every turn, so
// anything noisier than this is unusable.

const fs = require('fs');
const path = require('path');
const { getFlagPath, readFlag, getStatePath, readText } = require('./lean-and-mean-config');

const EDIT_THRESHOLD = 5;          // lean: fixed threshold, tune if it fires too early
const TRANSCRIPT_TAIL = 8 * 1024 * 1024;
const EDIT_TOOL = /"name"\s*:\s*"(Edit|Write|MultiEdit|NotebookEdit)"/g;
const CONTEXT_FILE = /"file_path"\s*:\s*"[^"]*(CLAUDE|SUMMARY)\.md"/i;

let input = '';
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  let data = {};
  try { data = JSON.parse(input); } catch (e) { process.exit(0); }

  if (data.stop_hook_active) process.exit(0);              // never loop on ourselves
  const mode = readFlag(getFlagPath());
  if (!mode || mode === 'off') process.exit(0);

  const statePath = getStatePath(data.session_id);
  if (fs.existsSync(statePath)) process.exit(0);           // already nudged this session

  const transcript = data.transcript_path ? readText(data.transcript_path, TRANSCRIPT_TAIL) : null;
  if (!transcript) process.exit(0);

  const edits = (transcript.match(EDIT_TOOL) || []).length;
  if (edits < EDIT_THRESHOLD) process.exit(0);
  if (CONTEXT_FILE.test(transcript)) process.exit(0);      // context files already maintained

  try {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify({ nudged: true, edits }), { mode: 0o600 });
  } catch (e) {
    process.exit(0);                                       // can't record it → don't risk a loop
  }

  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason:
      'Wrap-up pass (lean-and-mean, once per session — this session changed files but not CLAUDE.md):\n' +
      '1. Rules — review this session for corrections, reverted approaches, wrong assumptions. ' +
      'Turn each into one binding line under `## Rules` in CLAUDE.md so it never repeats. ' +
      'Nothing to learn? Say so and add nothing.\n' +
      '2. Next — does `## Next` still name the real next action? Rewrite if this session invalidated it. ' +
      'Update `## Todo` for anything finished or newly required.\n' +
      '3. Sanity — Commands still run, Architecture & Layout paths still exist, file under 250 lines.\n' +
      '4. SUMMARY.md — prepend `## <today> · P1|P2|P3 · <focus>` with 1–2 fragment bullets. ' +
      'P1 decisions/rules (180d), P2 useful context (90d), P3 routine (30d).\n' +
      'Do it now, keep it terse, then finish. This will not ask again this session.',
  }));
});
