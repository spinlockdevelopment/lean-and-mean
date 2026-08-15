#!/usr/bin/env node
// lean-and-mean — SessionEnd hook.
// Mechanically ages SUMMARY.md. No model involved, no output into context.
//   * past-TTL P3 entries are deleted (routine, recoverable from git),
//   * past-TTL P1/P2 entries get " · AGED" so the next `md review` promotes
//     their lesson into CLAUDE.md Rules or drops them — a rule is never lost here,
//   * over the 10-entry cap, lowest priority then oldest is dropped.
// Writes only when something changed.
//
// Self-check: `node lean-and-mean-age-summary.js --selftest`

const fs = require('fs');
const path = require('path');
const { getFlagPath, readFlag, readText, today } = require('./lean-and-mean-config');

const TTL_DAYS = { P1: 180, P2: 90, P3: 30 };
const MAX_ENTRIES = 10;
const HEADER = /^##\s+(\d{4}-\d{2}-\d{2})\s*·\s*(P[123])\s*·\s*(.+?)\s*$/;

function daysBetween(fromISO, toISO) {
  const a = Date.parse(`${fromISO}T00:00:00Z`);
  const b = Date.parse(`${toISO}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor((b - a) / 86400000);
}

// Returns the rewritten file, or null when nothing needs changing.
function ageSummary(text, now) {
  const lines = text.split('\n');
  const head = [];
  const entries = [];
  let cur = null;

  for (const line of lines) {
    const m = HEADER.exec(line);
    if (m) {
      cur = { date: m[1], prio: m[2], title: m[3], body: [] };
      entries.push(cur);
    } else if (cur) {
      cur.body.push(line);
    } else {
      head.push(line);
    }
  }
  if (!entries.length) return null;

  const kept = [];
  for (const e of entries) {
    const age = daysBetween(e.date, now);
    if (age > (TTL_DAYS[e.prio] || TTL_DAYS.P3)) {
      if (e.prio === 'P3') continue;                       // routine, past TTL → gone
      if (!/·\s*AGED$/.test(e.title)) e.title = `${e.title} · AGED`;
    }
    kept.push(e);
  }

  // Over cap: drop lowest priority first, then oldest.
  kept.sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : 0));
  while (kept.length > MAX_ENTRIES) {
    let worst = 0;
    for (let i = 1; i < kept.length; i++) {
      const w = kept[worst];
      const c = kept[i];
      if (c.prio > w.prio || (c.prio === w.prio && c.date < w.date)) worst = i;
    }
    kept.splice(worst, 1);
  }

  const out = head.join('\n').replace(/_Updated:\s*\d{4}-\d{2}-\d{2}_/, `_Updated: ${now}_`).replace(/\s*$/, '\n\n')
    + kept.map(e => `## ${e.date} · ${e.prio} · ${e.title}\n${e.body.join('\n').replace(/\s*$/, '')}\n`).join('\n');

  return out === text ? null : out;
}

if (process.argv.includes('--selftest')) {
  const assert = require('assert');
  const now = '2026-08-04';
  const mk = (d, p, t) => `## ${d} · ${p} · ${t}\n- x\n`;
  const head = '# Summary\n\n_Updated: 2020-01-01_\n\n';

  // P3 past 30d is deleted; fresh P1 untouched.
  let out = ageSummary(head + mk('2026-01-01', 'P3', 'old routine') + '\n' + mk('2026-08-01', 'P1', 'fresh'), now);
  assert(!out.includes('old routine'), 'expired P3 should be deleted');
  assert(out.includes('2026-08-01 · P1 · fresh'), 'fresh P1 should survive untouched');
  assert(out.includes('_Updated: 2026-08-04_'), 'Updated stamp should refresh');

  // P1 past 180d is flagged, not deleted, and flagging is idempotent.
  out = ageSummary(head + mk('2025-01-01', 'P1', 'ancient decision'), now);
  assert(out.includes('P1 · ancient decision · AGED'), 'expired P1 should be flagged AGED');
  assert.strictEqual(ageSummary(out, now), null, 'second pass must be a no-op');

  // Over cap: P3 goes before an older P1.
  const many = head + [mk('2026-08-03', 'P3', 'newest routine')]
    .concat(Array.from({ length: 10 }, (_, i) => mk(`2026-07-${String(i + 10)}`, 'P1', `keep${i}`))).join('\n');
  out = ageSummary(many, now);
  assert(!out.includes('newest routine'), 'cap should drop lowest priority first');
  assert.strictEqual((out.match(/^## /gm) || []).length, MAX_ENTRIES, 'cap should hold at 10');

  console.log('ok');
  process.exit(0);
}

let input = '';
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  let cwd = process.cwd();
  try { cwd = JSON.parse(input).cwd || cwd; } catch (e) {}

  const mode = readFlag(getFlagPath());
  if (!mode || mode === 'off') process.exit(0);

  const file = path.join(cwd, 'SUMMARY.md');
  const text = readText(file, 1024 * 1024);
  if (!text) process.exit(0);

  try {
    const out = ageSummary(text, today());
    if (out) fs.writeFileSync(file, out);
  } catch (e) {
    // best-effort — never break session teardown
  }
});
