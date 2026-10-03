import type { Task } from '../types'

export const JUDGE_SYSTEM =
  'You keep a coding session task checklist. Reply with JSON only: {"tasks":[{"text":string,"done":boolean}]}. ' +
  'Add each distinct task the user asked for; keep existing tasks and their order; ' +
  'mark done only when the assistant reply shows it finished (not planned, not partially done). ' +
  'Task text under 60 characters. Questions, chit-chat and /commands are not tasks.'

export function judgePrompt(tasks: Task[], prompt: string, answer: string): string {
  return [
    `Checklist: ${JSON.stringify({ tasks })}`,
    `User said:\n${prompt.slice(0, 4000)}`,
    `Assistant replied:\n${answer.slice(-6000)}`,
  ].join('\n\n')
}

// Untrusted model output: anything malformed returns null so the caller keeps the old list.
export function parseTasks(text: string): Task[] | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const raw: unknown = JSON.parse(text.slice(start, end + 1))
    const list = (raw as { tasks?: unknown }).tasks
    if (!Array.isArray(list)) return null
    const tasks = list
      .filter(
        (t): t is Task =>
          typeof t === 'object' && t !== null &&
          typeof (t as Task).text === 'string' && (t as Task).text.trim() !== '' &&
          typeof (t as Task).done === 'boolean',
      )
      .map(t => ({ text: t.text.trim().slice(0, 80), done: t.done }))
      .slice(0, 20)
    return tasks.length === list.length ? tasks : null
  } catch {
    return null
  }
}

export const allDone = (tasks: Task[]) => tasks.length > 0 && tasks.every(t => t.done)

export const CACHE_TTL_MS = 60 * 60 * 1000

const BAR_CELLS = 10

export function cacheLabel(
  cacheAt: number | null,
  now: number,
): { text: string; bar: string; isLow: boolean } {
  if (cacheAt === null) return { text: 'cache —', bar: '', isLow: false }
  const left = Math.max(0, cacheAt + CACHE_TTL_MS - now)
  const full = Math.ceil((left / CACHE_TTL_MS) * BAR_CELLS)
  const bar = '█'.repeat(full) + '░'.repeat(BAR_CELLS - full)
  if (left === 0) return { text: 'cache cold', bar, isLow: true }
  const minutes = Math.ceil(left / 60_000)
  return { text: `cache ${minutes}m`, bar, isLow: minutes <= 10 }
}

/** Band's first segment: `ctx 15% exp. [████░░] 22m` once a response reported context, else the cache label alone. */
export function bandLabel(
  ctx: number | null,
  cacheAt: number | null,
  now: number,
): { text: string; isLow: boolean } {
  const c = cacheLabel(cacheAt, now)
  if (ctx === null) return { text: `${c.bar ? `${c.bar} ` : ''}${c.text}`, isLow: c.isLow }
  const exp = cacheAt === null ? '' : ` exp. [${c.bar}] ${c.text.replace(/^cache /, '')}`
  return { text: `ctx ${Math.round(ctx)}%${exp}`, isLow: c.isLow }
}
