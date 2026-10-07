import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Task } from '../types'
import { JUDGE_SYSTEM, allDone, autoEndDue, cacheCold, cacheLabel, judgePrompt, parseTasks } from './judge'

const cacheAt = atom({ plugin: 'lean-and-mean', key: 'cacheAt' } as const, null)
const tasks = atom({ plugin: 'lean-and-mean', key: 'tasks' } as const, [] as Task[])
const nudged = atom({ plugin: 'lean-and-mean', key: 'nudged' } as const, false)
const lastPrompt = atom({ plugin: 'lean-and-mean', key: 'lastPrompt' } as const, '')
const endCommand = atom({ plugin: 'lean-and-mean', key: 'endCommand' } as const, 'lean-and-mean:endsession')
const tasksHidden = atom({ plugin: 'lean-and-mean', key: 'tasksHidden' } as const, false)
// true from a real prompt until an endsession runs, so an idle wrapped-up session isn't ended again every hour.
const armed = atom({ plugin: 'lean-and-mean', key: 'armed' } as const, false)
// Timer-written clock the band reads, so the cache countdown redraws while idle. Only written off the terminal, which has the status line.
const now = atom({ plugin: 'lean-and-mean', key: 'now' } as const, 0)

const isEnd = (name: string) => /(^|:)endsession$/.test(name)

const NUDGE =
  'lean-and-mean: every task on this session checklist is done. Before starting the new request, ' +
  'tell the user in one line that the checklist is complete and suggest running /endsession first; then proceed only if they want to continue.'

export const register: Register = (on, options) => {
  if (options.sessionBand === false) return
  // cacheAt only moves at turn end, so a 55m+ turn would look expired mid-turn.
  // lean: module variable, lost on reload mid-turn; move to an atom if that bites.
  let inTurn: string | null = null

  on('session.start', async ($, e, next) => {
    const tick = async () => {
      const t = await $.clock.now()
      if ((await $.session.surfaces()).some(s => s !== 'terminal')) await update($, now, () => t)
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
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, tasks, () => [])
      await update($, nudged, () => false)
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
    await update($, lastPrompt, () => e.text)
    await update($, armed, () => true)
    if (allDone(await read($, tasks)) && !(await read($, nudged))) {
      await update($, nudged, () => true)
      $.ui.toast('Checklist done: consider /endsession before new work')
      return next({ ...e, context: [...(e.context ?? []), NUDGE] })
    }
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
    const prompt = await read($, lastPrompt)
    if (e.reason !== 'answer' || prompt === '') return next(e)
    await update($, lastPrompt, () => '')

    const before = await read($, tasks)
    // lean: one Haiku call per main turn, awaited (≤8s); move to fire-and-forget from a timer if it drags.
    const r = await $.model.complete({
      model: 'haiku',
      effort: 'low',
      maxTokens: 600,
      timeoutMs: 8000,
      system: JUDGE_SYSTEM,
      prompt: judgePrompt(before, prompt, e.answer),
    })
    const after = r.isAnswered ? parseTasks(r.text) : null
    if (after) {
      await update($, tasks, () => after)
      if (allDone(after) && !allDone(before)) {
        await update($, nudged, () => false)
        $.ui.toast('All session tasks done: /endsession?')
      }
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const at = await read($, cacheAt)
    const list = await read($, tasks)
    if (at === null && list.length === 0) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const cache = e.surface === 'terminal' ? null : cacheLabel(at, await read($, now))
    const hidden = await read($, tasksHidden)
    const done = list.filter(t => t.done).length
    const finished = allDone(list)
    const command = await read($, endCommand)
    const end = async () => {
      // $.command.run skips this plugin's own command.run hook.
      await update($, armed, () => false)
      try {
        await $.command.run({ command })
      } catch {
        await $.prompt.fill({ text: `/${command}` })
      }
    }

    return (
      <Box flexDirection="column">
        <Box>
          {cache && (
            <Text key="cache" dimColor={!cache.warn} color={cache.warn ? 'yellow' : undefined}>
              {`${cache.text}  `}
            </Text>
          )}
          <Text key="tasks" dimColor={!finished} color={finished ? 'green' : undefined}>
            {list.length ? `tasks ${done}/${list.length}${finished ? ' done' : ''}  ` : ''}
          </Text>
          {list.length > 0 && (
            <Button
              key="toggle"
              label={hidden ? 'show tasks' : 'hide tasks'}
              variant="secondary"
              onPress={() => update($, tasksHidden, h => !h)}
            />
          )}
          <Button
            key="end"
            label={finished ? 'End session' : 'end session'}
            variant={finished ? 'primary' : 'secondary'}
            onPress={end}
          />
        </Box>
        {!hidden && list.map((t, i) => (
          <Text key={`t${i}`} dimColor={t.done} wrap="truncate-end">
            {t.done ? '  ✓ ' : '  ☐ '}
            {t.text}
          </Text>
        ))}
      </Box>
    )
  })
}
