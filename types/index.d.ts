export type Task = { text: string; done: boolean }

declare module 'claude-code' {
  interface PluginState {
    'lean-and-mean': {
      cacheAt: number | null
      tasks: Task[]
      nudged: boolean
      lastPrompt: string
      endCommand: string
      tasksHidden: boolean
      armed: boolean
      now: number
    }
  }
}
