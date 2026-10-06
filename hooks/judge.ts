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

export const AUTO_END_MS = 5 * 60 * 1000

/** True once the 1h prompt cache has 5 minutes or less left. */
export const autoEndDue = (cacheAt: number | null, now: number) =>
  cacheAt !== null && now >= cacheAt + CACHE_TTL_MS - AUTO_END_MS

/** Band label for the 1h cache: "exp. 42m", "exp. cold"; null before the first request. */
export function cacheLabel(cacheAt: number | null, now: number): { text: string; warn: boolean } | null {
  if (cacheAt === null) return null
  const left = Math.max(0, cacheAt + CACHE_TTL_MS - now)
  return { text: left === 0 ? 'exp. cold' : `exp. ${Math.ceil(left / 60_000)}m`, warn: left <= 10 * 60_000 }
}
