/** A `$.clock.now()` reading. */
export type Millis = number

/** One step of the host's task list, as the desktop plan tool sends it. */
export type Task = { content: string; status: 'pending' | 'in_progress' | 'completed' }

declare module 'claude-code' {
  interface PluginState {
    'lean-and-mean': {
      cacheAt: Millis | null
      endCommand: string
      armed: boolean
      now: Millis
      tasks: Task[]
    }
  }
}
