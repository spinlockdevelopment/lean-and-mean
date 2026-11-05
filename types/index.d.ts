/** A `$.clock.now()` reading. */
export type Millis = number

/** One step of the host's task list, as the desktop plan tool sends it. */
export type Task = { content: string; status: 'pending' | 'in_progress' | 'completed' }

/** Desktop pane header: project folder, git branch, and the worktree folder when not the main tree. */
export type Place = { project: string; branch: string | null; worktree: string | null }

/** Desktop pane meters: context fill and rate-limit windows, each 0 to 100. */
export type Usage = { context: number | null; limits: { kind: string; percent: number; resetsAt?: string }[] }

/** Weekly limit percent at the first reading of a local day: the pale part of its bar. */
export type DayBase = { day: string; percent: number }

/** One AGENTS.md `## Next` line, cut to its first clause; priority is `P1`–`P3` or null for lead lines. */
export type NextItem = { priority: string | null; text: string }

declare module 'claude-code' {
  interface PluginState {
    'lean-and-mean': {
      cacheAt: Millis | null
      endCommand: string
      armed: boolean
      inTurn: string | null
      now: Millis
      tasks: Task[]
      place: Place | null
      usage: Usage
      upcoming: NextItem[]
      contextBase: number | null
      weekBase: DayBase | null
    }
  }
}
