import type { Task } from '../types'

/** The desktop host's plan tool (`mcp__ccd_turn__update_plan`) arguments. */
export type PlanArgs = {
  items?: { content: string; status: Task['status'] }[]
  advance?: boolean
  done?: number[]
  start?: number
}

/** Mirrors one update_plan call: `items` replaces the list; `advance` completes the
 *  in_progress step and starts the next pending one; `done`/`start` are 1-based. */
export function applyPlan(tasks: Task[], a: PlanArgs): Task[] {
  let next = a.items ? a.items.map(i => ({ content: i.content, status: i.status })) : tasks.map(t => ({ ...t }))
  if (a.advance) {
    const cur = next.findIndex(t => t.status === 'in_progress')
    if (cur >= 0) next[cur].status = 'completed'
    const pending = next.findIndex((t, i) => i > cur && t.status === 'pending')
    if (pending >= 0) next[pending].status = 'in_progress'
  }
  for (const n of a.done ?? []) if (next[n - 1]) next[n - 1].status = 'completed'
  if (a.start !== undefined && next[a.start - 1]) {
    next = next.map(t => (t.status === 'in_progress' ? { ...t, status: 'pending' } : t))
    next[a.start - 1].status = 'in_progress'
  }
  return next
}
