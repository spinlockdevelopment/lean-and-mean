export type Task = { text: string; done: boolean }

declare module 'claude-code' {
  interface PluginState {
    'lean-and-mean': {
      cacheAt: number | null
      ctx: number | null
      now: number
      tasks: Task[]
      nudged: boolean
      lastPrompt: string
      endCommand: string
    }
  }
}
