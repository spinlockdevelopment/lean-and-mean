#!/usr/bin/env node
// lean-and-mean — shared flag-file helpers (symlink-safe write/read).
// Adapted from the caveman plugin's caveman-config.js pattern.

const fs = require('fs');
const path = require('path');
const os = require('os');

const VALID_MODES = ['off', 'lite', 'full', 'ultra'];
const MAX_FLAG_BYTES = 16; // longest legit value "ultra" (5) + slack

function getClaudeDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function getFlagPath() {
  return path.join(getClaudeDir(), '.lean-and-mean-active');
}

// Symlink-safe atomic write: refuses to follow a symlinked flag path or a
// symlinked parent dir owned by another user. Protects against a local
// attacker replacing the predictable flag path to clobber another file.
function safeWriteFlag(flagPath, content) {
  try {
    const flagDir = path.dirname(flagPath);
    fs.mkdirSync(flagDir, { recursive: true });

    let realFlagDir;
    const lstat = fs.lstatSync(flagDir);
    if (lstat.isSymbolicLink()) {
      realFlagDir = fs.realpathSync(flagDir);
      const realStat = fs.statSync(realFlagDir);
      if (!realStat.isDirectory()) return;
      if (typeof process.getuid === 'function') {
        if (realStat.uid !== process.getuid()) return;
      } else {
        const home = path.resolve(os.homedir()).toLowerCase();
        const real = path.resolve(realFlagDir).toLowerCase();
        if (real !== home && !real.startsWith(home + path.sep)) return;
      }
    } else {
      realFlagDir = flagDir;
    }

    const realFlagPath = path.join(realFlagDir, path.basename(flagPath));
    try {
      if (fs.lstatSync(realFlagPath).isSymbolicLink()) return;
    } catch (e) {
      if (e.code !== 'ENOENT') return;
    }

    const tempPath = path.join(realFlagDir, `.lean-and-mean-active.${process.pid}.${Date.now()}`);
    const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | O_NOFOLLOW;
    const fd = fs.openSync(tempPath, flags, 0o600);
    try {
      fs.writeSync(fd, String(content));
      try { fs.fchmodSync(fd, 0o600); } catch (e) {}
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tempPath, realFlagPath);
  } catch (e) {
    // best-effort — silent fail
  }
}

// Symlink-safe, size-capped, whitelist-validated read. Returns null on any
// anomaly (missing, symlink, oversized, unknown value) rather than trusting
// arbitrary file content.
function readFlag(flagPath) {
  try {
    const st = fs.lstatSync(flagPath);
    if (st.isSymbolicLink() || !st.isFile() || st.size > MAX_FLAG_BYTES) return null;

    const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    const fd = fs.openSync(flagPath, fs.constants.O_RDONLY | O_NOFOLLOW);
    let out;
    try {
      const buf = Buffer.alloc(MAX_FLAG_BYTES);
      const n = fs.readSync(fd, buf, 0, MAX_FLAG_BYTES, 0);
      out = buf.slice(0, n).toString('utf8');
    } finally {
      fs.closeSync(fd);
    }

    const mode = out.trim().toLowerCase();
    return VALID_MODES.includes(mode) ? mode : null;
  } catch (e) {
    return null;
  }
}

function deleteFlag(flagPath) {
  try { fs.unlinkSync(flagPath); } catch (e) {}
}

// The operating-mode block that belongs verbatim in every CLAUDE.md.
// SKILL.md is the single source of truth: pull the fenced block that follows
// the "## Injected block" heading. Returns null if the skill is unreadable.
// Resolution order: plugin root (installed as a Claude Code plugin), this
// file's own repo checkout, then a manual ~/.claude/skills install.
function readInjectedBlock() {
  const roots = [process.env.CLAUDE_PLUGIN_ROOT, path.join(__dirname, '..'), getClaudeDir()];
  for (const root of roots) {
    if (!root) continue;
    try {
      const raw = fs.readFileSync(path.join(root, 'skills', 'lean-and-mean', 'SKILL.md'), 'utf8');
      const m = /##\s+Injected block[\s\S]*?```markdown\n([\s\S]*?)\n```/.exec(raw);
      if (m) return m[1].trim();
    } catch (e) {
      // try the next root
    }
  }
  return null;
}

// Per-session scratch state (used by the Stop hook to nudge at most once).
function getStatePath(sessionId) {
  const safe = String(sessionId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'unknown';
  return path.join(getClaudeDir(), '.lean-and-mean-state', `${safe}.json`);
}

function readText(file, maxBytes) {
  try {
    const st = fs.lstatSync(file);
    if (st.isSymbolicLink() || !st.isFile()) return null;
    if (maxBytes && st.size > maxBytes) {
      // Read the tail only — transcripts grow without bound.
      const fd = fs.openSync(file, 'r');
      try {
        const buf = Buffer.alloc(maxBytes);
        fs.readSync(fd, buf, 0, maxBytes, st.size - maxBytes);
        return buf.toString('utf8');
      } finally {
        fs.closeSync(fd);
      }
    }
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    return null;
  }
}

function today() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

module.exports = {
  VALID_MODES, getClaudeDir, getFlagPath, safeWriteFlag, readFlag, deleteFlag,
  readInjectedBlock, getStatePath, readText, today,
};
