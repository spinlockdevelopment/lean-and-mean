/** A `$.clock.now()` reading. */
export type Millis = number

declare module 'claude-code' {
  interface PluginState {
    'lean-and-mean': {
      cacheAt: Millis | null
      endCommand: string
      armed: boolean
      now: Millis
    }
  }
}
