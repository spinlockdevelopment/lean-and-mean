import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Task } from '../types'
import { JUDGE_SYSTEM, allDone, cacheLabel, judgePrompt, parseTasks } from './judge'

const cacheAt = atom({ plugin: 'lean-and-mean', key: 'cacheAt' } as const, null)
const now = atom({ plugin: 'lean-and-mean', key: 'now' } as const, 0)
const tasks = atom({ plugin: 'lean-and-mean', key: 'tasks' } as const, [] as Task[])
const nudged = atom({ plugin: 'lean-and-mean', key: 'nudged' } as const, false)
const lastPrompt = atom({ plugin: 'lean-and-mean', key: 'lastPrompt' } as const, '')
const endCommand = atom({ plugin: 'lean-and-mean', key: 'endCommand' } as const, 'lean-and-mean:endsession')

const NUDGE =
  'lean-and-mean: every task on this session checklist is done. Before starting the new request, ' +
  'tell the user in one line that the checklist is complete and suggest running /endsession first; then proceed only if they want to continue.'

export const register: Register = (on, options) => {
  if (options.sessionBand === false) return

  on('session.start', async ($, e, next) => {
    const tick = async () => {
      const t = await $.clock.now()
      await update($, now, () => t)
    }
    await tick()
    $.clock.every(30_000, tick)
    const found = (await $.command.list()).find(c => /(^|:)endsession$/.test(c.name))
    if (found) await update($, endCommand, () => found.name)
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, tasks, () => [])
      await update($, nudged, () => false)
    }
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind === 'plugin' || e.text.trimStart().startsWith('/')) return next(e)
    await update($, lastPrompt, () => e.text)
    if (allDone(await read($, tasks)) && !(await read($, nudged))) {
      await update($, nudged, () => true)
      $.ui.toast('Checklist done: consider /endsession before new work')
      return next({ ...e, context: [...(e.context ?? []), NUDGE] })
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
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
    const cache = cacheLabel(at, await read($, now))
    const done = list.filter(t => t.done).length
    const finished = allDone(list)
    const command = await read($, endCommand)
    const end = async () => {
      try {
        await $.command.run({ command })
      } catch {
        await $.prompt.fill({ text: `/${command}` })
      }
    }

    return (
      <Box flexDirection="column">
        <Box>
          <Text key="cache" color={cache.isLow ? 'yellow' : undefined} dimColor={!cache.isLow}>
            {cache.bar ? `${cache.bar} ` : ''}
            {cache.text}
          </Text>
          <Text key="tasks" dimColor={!finished} color={finished ? 'green' : undefined}>
            {list.length ? `  ·  tasks ${done}/${list.length}${finished ? ' done' : ''}  ` : '  '}
          </Text>
          <Button
            key="end"
            label={finished || cache.isLow ? 'End session' : 'end session'}
            variant={finished || cache.isLow ? 'primary' : 'secondary'}
            onPress={end}
          />
        </Box>
        {list.map((t, i) => (
          <Text key={`t${i}`} dimColor={t.done} wrap="truncate-end">
            {t.done ? '  ✓ ' : '  ☐ '}
            {t.text}
          </Text>
        ))}
      </Box>
    )
  })
}
