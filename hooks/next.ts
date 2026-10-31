import type { NextItem } from '../types'

const MAX = 64

/** One line of Next, cut to its first clause: parentheses and backticks dropped,
 *  then the first `; ` or sentence end, then `: ` or a word boundary when still long. */
export function brief(s: string, max = MAX): string {
  let t = s.replace(/\s*\([^)]*\)/g, '').replace(/`/g, '').trim()
  t = t.split(/; |(?<=[.!?])\s/)[0].replace(/[.;:]$/, '')
  if (t.length <= max) return t
  const colon = t.indexOf(': ')
  if (colon >= 16 && colon <= max) return t.slice(0, colon)
  return t.slice(0, t.lastIndexOf(' ', max - 1)) + '…'
}

/** The `## Next` section of AGENTS.md as brief items: each lead line, then each
 *  `- P<n> — ` bullet with its priority. Wrapped lines (indented, or starting
 *  lowercase) join the item above. */
export function nextItems(md: string): NextItem[] {
  const lines = md.split('\n')
  const start = lines.findIndex(l => l.trim() === '## Next')
  if (start < 0) return []
  const raw: string[] = []
  for (const l of lines.slice(start + 1)) {
    if (l.startsWith('## ')) break
    if (!l.trim()) continue
    if (raw.length && (/^\s/.test(l) || /^[a-z]/.test(l))) raw[raw.length - 1] += ` ${l.trim()}`
    else raw.push(l.trim())
  }
  return raw.map(r => {
    const m = r.match(/^[-*]\s+(?:(P\d)\s*[—–-]\s*)?(.*)$/)
    return m ? { priority: m[1] ?? null, text: brief(m[2]) } : { priority: null, text: brief(r) }
  })
}
