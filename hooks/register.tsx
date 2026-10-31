import { atom, read, update } from 'claude-code'
import type { Engine, Register } from 'claude-code'

import { autoEndDue, cacheCold, cacheLabel } from './cache'

const cacheAt = atom({ plugin: 'lean-and-mean', key: 'cacheAt' } as const, null)
const endCommand = atom({ plugin: 'lean-and-mean', key: 'endCommand' } as const, 'lean-and-mean:endsession')
// true from a real prompt until an endsession runs, so an idle wrapped-up session isn't ended again every hour.
const armed = atom({ plugin: 'lean-and-mean', key: 'armed' } as const, false)
// Timer-written clock the band reads, so the cache countdown redraws while idle.
const now = atom({ plugin: 'lean-and-mean', key: 'now' } as const, 0)

const isEnd = (name: string) => /(^|:)endsession$/.test(name)
// Desktop only: the countdown and End session sit in this pane (the app's side rail) instead of above the prompt.
const PANE = { id: 'session', title: 'Session' }

async function openPane($: Engine) {
  const r = await $.ui.open(PANE).catch(() => undefined)
  // Unasked (start, attach) it can wait undrawn under the column floor; the next real prompt asks again, which places it.
  if (r && !r.isPlaced) $.ui.toast(`Session pane waits: ${r.reason}`)
}

// The End session button, band and pane alike.
async function endSession($: Engine) {
  const command = await read($, endCommand)
  // $.command.run skips this plugin's own command.run hook.
  await update($, armed, () => false)
  try {
    await $.command.run({ command })
  } catch {
    await $.prompt.fill({ text: `/${command}` })
  }
}

export const register: Register = (on, options) => {
  if (options.sessionBand === false) return
  // cacheAt only moves at turn end, so a 55m+ turn would look expired mid-turn.
  // lean: module variable, lost on reload mid-turn; move to an atom if that bites.
  let inTurn: string | null = null

  on('session.start', async ($, e, next) => {
    const tick = async () => {
      const t = await $.clock.now()
      await update($, now, () => t)
      if (inTurn !== null || !(await read($, armed)) || !autoEndDue(await read($, cacheAt), t)) return
      await update($, armed, () => false)
      $.ui.toast('Prompt cache expires in 5m: running /endsession')
      // Queued until the session is idle; not awaited so the timer isn't held for the whole wrap-up.
      $.command.run({ command: await read($, endCommand), args: 'auto' }).catch(() => $.ui.toast('Auto /endsession failed: run it by hand'))
    }
    await tick()
    $.clock.every(30_000, tick)
    const found = (await $.command.list()).find(c => isEnd(c.name))
    if (found) await update($, endCommand, () => found.name)
    if ((await $.session.surfaces()).includes('desktop')) await openPane($)
    return next(e)
  })

  on('session.attach', async ($, e, next) => {
    if (e.surface === 'desktop') await openPane($)
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, armed, () => false)
      await update($, cacheAt, () => null)
    }
    return next(e)
  })

  on('command.run', async ($, e, next) => {
    if (isEnd(e.command)) await update($, armed, () => false)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind === 'plugin' || e.text.trimStart().startsWith('/')) return next(e)
    const at = await read($, cacheAt)
    if (e.turnId === undefined && inTurn === null && at !== null && cacheCold(at, await $.clock.now())) {
      // armed false = an endsession (auto, button or typed) ran after the last real prompt.
      const ended = !(await read($, armed))
      const command = await read($, endCommand)
      let answer: string
      try {
        answer = await $.ui.ask(
          ended
            ? 'Prompt cache is cold; /endsession already wrapped up. Resend the full context to rehydrate it?'
            : 'Prompt cache is cold and /endsession has not run. Resend the full context to rehydrate it?',
          { header: 'Cold cache', options: ['Rehydrate', 'Clear first'] },
        )
      } catch {
        // Dismissed, or nobody to ask (-p): send; a cache miss beats a lost prompt.
        return next(e)
      }
      if (answer !== 'Clear first') return next(e)
      // lean: the typed prompt is not kept; stash it and refill after /clear if retyping bites.
      // Guarded: a rejected fill would skip this hook and send the prompt the user held back.
      await $.prompt.fill({ text: ended ? '/clear' : `/${command}` }).catch(() => undefined)
      return {
        drop: ended
          ? 'Not sent. /endsession saved Next in AGENTS.md. Run /clear, then resend your prompt.'
          : `Not sent. Run /${command} to save Rules and Next (one cold resend), then /clear and resend your prompt.`,
      }
    }
    await update($, armed, () => true)
    // A prompt is an asked open, placed at any width; a pane closed by hand is not listed, so stays closed.
    if ((await $.ui.panes()).some(p => p.id === PANE.id && !p.isPlaced)) await openPane($)
    return next(e)
  })

  on('turn.start', async (_$, e, next) => {
    inTurn = e.turnId
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    if (e.turnId === inTurn) inTurn = null
    // usage present = a real request ran, so the 1h cache was refreshed (interrupted turns too).
    if (e.usage) {
      const t = await $.clock.now()
      await update($, cacheAt, () => t)
      await update($, now, () => t)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // Desktop draws these in the pane instead.
    if (e.props.hasSurvey || e.surface === 'desktop') return next(e)
    const at = await read($, cacheAt)
    if (at === null) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const cache = cacheLabel(at, await read($, now))
    return (
      <Box>
        {cache && (
          <Text key="cache" color={cache.color}>
            {`${cache.text}  `}
          </Text>
        )}
        <Button key="end" label="end session" variant="secondary" onPress={() => endSession($)} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE.id }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const cache = cacheLabel(await read($, cacheAt), await read($, now))
    return (
      <Box flexDirection="column">
        <Text key="cache" color={cache?.color} dimColor={!cache}>
          {cache ? `Prompt cache ${cache.text}` : 'Prompt cache: no request yet'}
        </Text>
        <Button key="end" label="End session" variant="secondary" onPress={() => endSession($)} />
      </Box>
    )
  })
}
