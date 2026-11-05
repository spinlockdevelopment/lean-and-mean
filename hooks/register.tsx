import { atom, read, update } from 'claude-code'
import type { Engine, Register } from 'claude-code'

import type { DayBase, NextItem, Place, Task, Usage } from '../types'
import { BAR_CELLS, BUSY_CELLS, BUSY_COLOR, BUSY_HEX, CACHE_TTL_MS, autoEndDue, barCells, barSvg, busySvg, cacheCold, cacheLabel, dayKey, limitTitle, meterLabel, rebase, resetIn } from './cache'
import { nextItems } from './next'
import { applyPlan } from './plan'

const cacheAt = atom({ plugin: 'lean-and-mean', key: 'cacheAt' } as const, null)
const endCommand = atom({ plugin: 'lean-and-mean', key: 'endCommand' } as const, 'lean-and-mean:endsession')
// true from a real prompt until an endsession runs, so an idle wrapped-up session isn't ended again every hour.
const armed = atom({ plugin: 'lean-and-mean', key: 'armed' } as const, false)
// The main loop's running turn id, null when idle. cacheAt only moves at turn end, so while set
// the Cache Idle bar shows BUSY and auto-end waits: a 55m+ turn would otherwise look expired mid-turn.
const inTurn = atom({ plugin: 'lean-and-mean', key: 'inTurn' } as const, null as string | null)
// Timer-written clock the band reads, so the Cache Idle timer redraws while idle.
const now = atom({ plugin: 'lean-and-mean', key: 'now' } as const, 0)
// Desktop pane: the host's task list, mirrored from its plan tool.
const tasks = atom({ plugin: 'lean-and-mean', key: 'tasks' } as const, [] as Task[])
// Desktop pane header and meters.
const place = atom({ plugin: 'lean-and-mean', key: 'place' } as const, null as Place | null)
const usage = atom({ plugin: 'lean-and-mean', key: 'usage' } as const, { context: null, limits: [] } as Usage)
// Desktop pane: AGENTS.md `## Next`, re-read at turn end, so /endsession's rewrite shows with no model call.
const upcoming = atom({ plugin: 'lean-and-mean', key: 'upcoming' } as const, [] as NextItem[])
// Two-tone bars: context fill at the last real prompt, weekly limit at the day's first reading.
const contextBase = atom({ plugin: 'lean-and-mean', key: 'contextBase' } as const, null as number | null)
const weekBase = atom({ plugin: 'lean-and-mean', key: 'weekBase' } as const, null as DayBase | null)
const PLAN_TOOL = 'mcp__ccd_turn__update_plan'
const WRAP_TOOL = 'mcp__ccd_turn__wrap_up'

// $.state dies with the process, so a restart or resume showed no countdown. $.store keeps
// { sessionId: cacheAt } across processes, pruned to entries still inside the TTL.
const STORE_KEY = 'cacheAt'
async function saveCacheAt($: Engine, t: number) {
  const id = await $.session.id()
  const all = ((await $.store.get(STORE_KEY)) ?? {}) as Record<string, number>
  const kept = Object.fromEntries(Object.entries(all).filter(([, at]) => t - at < CACHE_TTL_MS))
  await $.store.set(STORE_KEY, { ...kept, [id]: t })
}
async function storedCacheAt($: Engine) {
  const all = ((await $.store.get(STORE_KEY)) ?? {}) as Record<string, number>
  return all[await $.session.id()] ?? null
}

const isEnd = (name: string) => /(^|:)endsession$/.test(name)
// Desktop only: the countdown and End session sit in this pane (the app's side rail) instead of above the prompt.
const PANE = { id: 'session', title: 'Session' }

async function openPane($: Engine) {
  const r = await $.ui.open(PANE).catch(() => undefined)
  // Unasked (start, attach) it can wait undrawn under the column floor; the next real prompt asks again, which places it.
  if (r && !r.isPlaced) $.ui.toast(`Session pane waits: ${r.reason}`)
}

const base = (p: string) => p.replace(/\/+$/, '').split('/').pop() || p

// Project is the main tree's folder; a worktree shows its own folder beside the branch.
// Next comes from AGENTS.md at the main tree's root.
async function refreshPane($: Engine) {
  const root = await $.session.root()
  const repo = await $.session.repo().catch(() => null)
  let next: Place = { project: base(repo?.root ?? root), branch: null, worktree: null }
  if (repo) {
    const r = await $.process.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD', '--show-toplevel'], { cwd: root, timeoutMs: 2000 }).catch(() => null)
    const [head, top] = r?.exitCode === 0 ? r.stdout.trim().split('\n') : []
    next = { ...next, branch: head === 'HEAD' ? 'detached' : head || null, worktree: top && top !== repo.root ? base(top) : null }
  }
  await update($, place, () => next)
  const md = await $.fs.read(`${repo?.root ?? root}/AGENTS.md`).catch(() => null)
  await update($, upcoming, () => (typeof md === 'string' ? nextItems(md) : []))
}

type UsageIn = { context: { percent?: number }; rateLimits: readonly { kind: string; percentUsed: number; resetsAt?: string }[] }

// Kept in $.store so the day's baseline survives restarts and is shared by the day's sessions.
const WEEK_KEY = 'weekBase'
async function setUsage($: Engine, u: UsageIn) {
  const next: Usage = { context: u.context.percent ?? null, limits: u.rateLimits.map(l => ({ kind: l.kind, percent: l.percentUsed, resetsAt: l.resetsAt })) }
  await update($, usage, () => next)
  const week = next.limits.find(l => l.kind === 'seven_day')
  const t = await read($, now)
  if (!week || !t) return
  const was = (await read($, weekBase)) ?? (((await $.store.get(WEEK_KEY).catch(() => undefined)) ?? null) as DayBase | null)
  const base = rebase(was, dayKey(t), week.percent)
  await update($, weekBase, () => base)
  if (base !== was) await $.store.set(WEEK_KEY, base).catch(() => undefined)
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

  on('session.start', async ($, e, next) => {
    const tick = async () => {
      const t = await $.clock.now()
      await update($, now, () => t)
      if ((await read($, inTurn)) !== null || !(await read($, armed)) || !autoEndDue(await read($, cacheAt), t)) return
      await update($, armed, () => false)
      $.ui.toast('Prompt cache expires in 5m: running /endsession')
      // Queued until the session is idle; not awaited so the timer isn't held for the whole wrap-up.
      $.command.run({ command: await read($, endCommand), args: 'auto' }).catch(() => $.ui.toast('Auto /endsession failed: run it by hand'))
    }
    // Start and reload both come between turns; a turn id left by a crash would pin BUSY.
    await update($, inTurn, () => null)
    if ((await read($, cacheAt)) === null) {
      const at = await storedCacheAt($).catch(() => null)
      if (at !== null) await update($, cacheAt, () => at)
    }
    await tick()
    $.clock.every(30_000, tick)
    const found = (await $.command.list()).find(c => isEnd(c.name))
    if (found) await update($, endCommand, () => found.name)
    if ((await $.session.surfaces()).includes('desktop')) {
      await openPane($)
      await refreshPane($).catch(() => undefined)
    }
    const u = await $.session.usage().catch(() => null)
    if (u) await setUsage($, u)
    return next(e)
  })

  on('session.attach', async ($, e, next) => {
    if (e.surface === 'desktop') {
      await openPane($)
      await refreshPane($).catch(() => undefined)
    }
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await setUsage($, e)
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, armed, () => false)
      await update($, cacheAt, () => null)
      await update($, tasks, () => [])
      const all = ((await $.store.get(STORE_KEY).catch(() => undefined)) ?? {}) as Record<string, number>
      const { [await $.session.id()]: _, ...rest } = all
      await $.store.set(STORE_KEY, rest).catch(() => undefined)
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
    if (e.turnId === undefined && (await read($, inTurn)) === null && at !== null && cacheCold(at, await $.clock.now())) {
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
    const { context } = await read($, usage)
    await update($, contextBase, () => context)
    // A prompt is an asked open, placed at any width; a pane closed by hand is not listed, so stays closed.
    if ((await $.ui.panes()).some(p => p.id === PANE.id && !p.isPlaced)) await openPane($)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    // Subagent turns run inside a main-loop turn; only the main loop counts.
    if (e.agentId === undefined) await update($, inTurn, () => e.turnId)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    if (e.turnId === (await read($, inTurn))) await update($, inTurn, () => null)
    // usage present = a real request ran, so the 1h cache was refreshed (interrupted turns too).
    // An answered turn did too: covers a host that sends no usage.
    if (e.usage || (e.reason === 'answer' && !e.isAborted)) {
      const t = await $.clock.now()
      await update($, cacheAt, () => t)
      await update($, now, () => t)
      await saveCacheAt($, t).catch(() => undefined)
    }
    // The branch and AGENTS.md can change in any turn; only the pane shows them.
    if ((await $.ui.panes()).some(p => p.id === PANE.id)) await refreshPane($).catch(() => undefined)
    return next(e)
  })

  on('tool.call', { tool: PLAN_TOOL }, async ($, e, next) => {
    const r = await next(e)
    if (!('deny' in r && r.deny) && !r.isError) await update($, tasks, t => applyPlan(t, e as never))
    return r
  })

  on('tool.call', { tool: WRAP_TOOL }, async ($, e, next) => {
    const r = await next(e)
    if (!('deny' in r && r.deny) && !r.isError) await update($, tasks, t => t.map(x => ({ ...x, status: 'completed' as const })))
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // Desktop draws these in the pane instead.
    if (e.props.hasSurvey || e.surface === 'desktop') return next(e)
    const at = await read($, cacheAt)
    const busy = (await read($, inTurn)) !== null
    if (at === null && !busy) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const cache = busy ? null : cacheLabel(at, await read($, now))
    return (
      <Box>
        {busy && (
          <Box key="cache">
            <Text color={BUSY_COLOR}>Cache Idle </Text>
            <Text key="bar" color="white" backgroundColor={BUSY_COLOR} weight="bold">{BUSY_CELLS}</Text>
            <Text>{'  '}</Text>
          </Box>
        )}
        {cache && (
          <Box key="cache">
            <Text color={cache.color}>Cache Idle </Text>
            <Text key="bar" color={cache.color}>{'█'.repeat(barCells(cache.fraction))}</Text>
            <Text dimColor>{'░'.repeat(BAR_CELLS - barCells(cache.fraction))}</Text>
            <Text key="left" color={cache.color} weight="bold">{` ${cache.minutes}  `}</Text>
          </Box>
        )}
        <Button key="end" label="end session" variant="secondary" onPress={() => endSession($)} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE.id }, async ($, e) => {
    const { Box, Text, Button, Svg } = $.ui.resolve(e)
    const busy = (await read($, inTurn)) !== null
    const cache = cacheLabel(await read($, cacheAt), await read($, now))
    const list = await read($, tasks)
    const later = await read($, upcoming)
    const where = await read($, place)
    const { context, limits } = await read($, usage)
    const ctxFrom = await read($, contextBase)
    const week = await read($, weekBase)
    const t = await read($, now)
    const mark = { completed: '✓', in_progress: '●', pending: '○' } as const
    // One labelled bar: Cache Idle, Context, each rate-limit window. `from` (0 to 100) splits the
    // bar into pale baseline and solid growth; `note` is a dim caption under it.
    type Bar = { fraction: number; hex: string; from?: number; svg?: string; note?: string | null }
    const meter = (key: string, title: string, value: string, color: string | undefined, bar?: Bar) => {
      const grew = bar?.from === undefined ? 0 : Math.round(bar.fraction * 100 - bar.from)
      return (
        <Box key={key} flexDirection="column" gap="xs">
          <Box flexDirection="row" justifyContent="space-between">
            <Text weight="semibold">{title}</Text>
            <Box key="values" flexDirection="row" gap="xs">
              {grew > 0 && <Text key="grew" dimColor tabular>{`+${grew}%`}</Text>}
              <Text key="value" color={color} dimColor={!bar} weight="semibold" tabular>{value}</Text>
            </Box>
          </Box>
          {bar && Svg && (
            <Svg
              source={bar.svg ?? barSvg(bar.fraction, bar.hex, bar.from === undefined ? undefined : bar.from / 100)}
              alt={`${title}: ${value}${grew > 0 ? `, +${grew}%` : ''}`}
            />
          )}
          {bar?.note && <Text key="note" size="caption" dimColor>{bar.note}</Text>}
        </Box>
      )
    }
    const ctx = context === null ? null : meterLabel(context)
    return (
      <Box flexDirection="column" gap={1}>
        {where && (
          <Box key="place" flexDirection="column">
            <Text size="heading" weight="semibold">{where.project}</Text>
            {where.branch && (
              <Text key="branch" dimColor mono>{`⎇ ${where.branch}${where.worktree ? `  ·  worktree ${where.worktree}` : ''}`}</Text>
            )}
          </Box>
        )}
        {ctx && meter('context', 'Context', ctx.text, ctx.color, { ...ctx, from: ctxFrom !== null && context !== null && ctxFrom <= context ? ctxFrom : undefined })}
        {limits.map(l => {
          const m = meterLabel(l.percent)
          const weekly = l.kind === 'seven_day'
          const bar = weekly ? { ...m, from: week?.day === dayKey(t) ? week.percent : undefined, note: resetIn(l.resetsAt, t) } : m
          return meter(`limit-${l.kind}`, limitTitle(l.kind), m.text, m.color, bar)
        })}
        {busy
          ? meter('cache', 'Cache Idle', 'busy', BUSY_COLOR, { fraction: 1, hex: BUSY_HEX, svg: busySvg() })
          : meter('cache', 'Cache Idle', cache ? cache.minutes : 'waiting for a reply', cache?.color, cache ?? undefined)}
        {list.length > 0 && (
          <Box key="tasks" flexDirection="column">
            <Text weight="semibold">Tasks</Text>
            {list.map((t, i) => (
              <Text key={`task-${i}`} dimColor={t.status === 'completed'} weight={t.status === 'in_progress' ? 'semibold' : 'regular'}>
                {`${mark[t.status]} ${t.content}`}
              </Text>
            ))}
          </Box>
        )}
        {later.length > 0 && (
          <Box key="next" flexDirection="column">
            <Text weight="semibold">Next sessions</Text>
            {later.map((n, i) => (
              <Text key={`next-${i}`}>
                {n.priority ? <Text dimColor mono>{`${n.priority} `}</Text> : '• '}
                {n.text}
              </Text>
            ))}
          </Box>
        )}
        <Button key="end" variant="primary" onPress={() => endSession($)}>
          ⏻ End Session
        </Button>
      </Box>
    )
  })
}
