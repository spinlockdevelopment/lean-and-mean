import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 80, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const PANE = {
  component: 'Pane',
  requestId: 'session',
  props: { title: 'Session', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

// Engine stand-ins beneath the plugin; `surfaces` is what the session draws on.
// `placed` false: unasked opens wait undrawn, as under the column floor; asked ones place.
function world(on: On, surfaces: string[] = ['terminal'], placed = true) {
  const calls: string[] = []
  const panes: string[] = []
  const unplaced: string[] = []
  on('ui.open', async (_$, e) => {
    if (!panes.includes(e.id)) panes.push(e.id)
    if (!placed && !unplaced.includes(e.id)) {
      unplaced.push(e.id)
      return { value: { isPlaced: false, reason: 'under 144 columns' } }
    }
    unplaced.splice(unplaced.indexOf(e.id), 1)
    return { value: { isPlaced: true } }
  })
  on('ui.close', async (_$, e) => {
    panes.splice(panes.indexOf(e.id), 1)
    return { value: undefined }
  })
  on('ui.panes', async () => ({ value: panes.map(id => ({ id, title: id, isShown: true, isFocused: false, isPlaced: !unplaced.includes(id) })) }))
  on('model.complete', async (_$, e) => {
    calls.push(e.prompt)
    return { value: { isAnswered: false } } as never
  })
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('session.surfaces', async () => ({ value: surfaces }))
  on('command.list', async () => ({ value: [{ name: 'lean-and-mean:endsession' }] }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('session.attach', async (_$, e) => ({ clientId: e.clientId }))
  on('prompt.submit', async (_$, e) => ({ text: e.text, context: e.context }))
  on('turn.complete', async (_$, e) => ({ text: e.answer }))
  on('ui.toast', async () => ({ value: undefined }))
  on('session.id', async () => ({ value: 's1' }))
  on('session.root', async () => ({ value: '/w/feature' }))
  on('session.repo', async () => ({ value: { root: '/src/proj', remote: null, internal: false, cwd: '' } }))
  on('process.run', async () => ({ value: { exitCode: 0, stdout: 'feat/x\n/w/feature\n', stderr: '' } }) as never)
  on('session.measure', async (_$, e) => ({ changed: e.changed }))
  on('fs.read', async (_$, e) => {
    if (e.path !== '/src/proj/AGENTS.md') throw new Error('ENOENT')
    return { value: '## Rules\n- x\n\n## Next\nShip 5.16.0 (pane); then rest.\n- P2 — decide on `debt`: keep or drop\n\n## Notes\n- y\n' }
  })
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 200_000, percent: 42 }, rateLimits: [{ kind: 'five_hour', percentUsed: 80 }, { kind: 'seven_day', percentUsed: 12.5 }] } }))
  const store = new Map<string, unknown>()
  on('store.get', async (_$, e) => ({ value: store.get(e.key) }))
  on('store.set', async (_$, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.render', async ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="engine" />
  })
  return Object.assign(calls, { panes, unplaced, store })
}

async function turn($: Engine, prompt: string, answer: string) {
  await $.prompt.submit({ text: prompt, wait: false, origin: { kind: 'composer' } })
  await $.turn.complete({ answer, durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' })
}

async function warm($: Engine, surface: 'terminal' | 'desktop') {
  await $.session.start({ cwd: '/p', surface, isInteractive: true } as never)
  await $.prompt.submit({ text: 'do a thing', wait: false, origin: { kind: 'composer' } })
  await $.turn.complete({
    answer: 'Done.', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer',
    usage: { input_tokens: 1, output_tokens: 1 },
  } as never)
}

test('terminal: band has Cache Idle timer and end session, no pane, no model call', async ($, on) => {
  const w = world(on, ['terminal'])
  mock.clock(on)
  await warm($, 'terminal')
  expect(w.length).toBe(0)
  expect(w.panes).toEqual([])
  const band = await $.ui.mount({ plugin: 'lean-and-mean', surface: 'terminal', ...BAND })
  expect(await band.find({ type: 'Text', text: '░'.repeat(12) })).toBeDefined()
  expect(await band.find({ type: 'Text', text: / 0m/ })).toBeDefined()
  expect(await band.find({ key: 'end' })).toBeDefined()
  await band.unmount()
})

test('desktop: pane opens at start and holds Cache Idle timer and End session; band is empty', async ($, on) => {
  const w = world(on, ['desktop'])
  mock.clock(on)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  expect(w.panes).toEqual(['session'])
  await warm($, 'desktop')
  const band = await $.ui.mount({ plugin: 'lean-and-mean', surface: 'desktop', ...BAND })
  expect(await band.find({ key: 'end' })).toBeUndefined()
  await band.unmount()
  const pane = await $.ui.mount({ plugin: 'lean-and-mean', surface: 'desktop', ...PANE })
  expect(await pane.find({ type: 'Text', text: '0m' })).toBeDefined()
  expect((await pane.findAll({ type: 'Svg' })).at(-1)?.props.source).toContain('width="0" height="8" rx="4" fill="#22c55e"')
  expect(await pane.find({ key: 'tasks' })).toBeUndefined()
  expect(await pane.find({ key: 'end' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: 'Next sessions' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /Ship 5\.16\.0$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /decide on debt: keep or drop/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /save Rules and Next/ })).toBeUndefined()
  await pane.unmount()
})

test('desktop: a pane left undrawn at start is placed by the next prompt', async ($, on) => {
  const w = world(on, ['desktop'], false)
  mock.clock(on)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  expect(w.unplaced).toEqual(['session'])
  await $.prompt.submit({ text: 'do a thing', wait: false, origin: { kind: 'composer' } })
  expect(w.unplaced).toEqual([])
  expect(w.panes).toEqual(['session'])
})

test('desktop attaching later opens the pane', async ($, on) => {
  const w = world(on, ['terminal'])
  await $.session.attach({ surface: 'desktop', clientId: 'desktop:default' } as never)
  expect(w.panes).toEqual(['session'])
})

test('sessionBand false: no band, no pane', { options: { sessionBand: false } }, async ($, on) => {
  const w = world(on, ['desktop'])
  mock.clock(on)
  await warm($, 'desktop')
  expect(w.panes).toEqual([])
  const ui = await $.ui.mount({ plugin: 'lean-and-mean', surface: 'terminal', ...BAND })
  expect(await ui.find({ key: 'end' })).toBeUndefined()
  await ui.unmount()
})

test('endsession runs once when the cache has 5 minutes left', async ($, on) => {
  world(on)
  const clock = mock.clock(on)
  const runs: string[] = []
  on('command.run', async (_$, e) => {
    runs.push(`${e.command} ${e.args}`)
    return { text: '' }
  })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true } as never)
  await $.prompt.submit({ text: 'do a thing', wait: false, origin: { kind: 'composer' } })
  await $.turn.complete({
    answer: 'Done.', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer',
    usage: { input_tokens: 1, output_tokens: 1 },
  } as never)
  await clock.advance(54 * 60_000)
  expect(runs).toEqual([])
  await clock.advance(60_000)
  expect(runs).toEqual(['lean-and-mean:endsession auto'])
  await clock.advance(60 * 60_000)
  expect(runs.length).toBe(1)
  // A turn still running at 55m doesn't trigger it.
  await $.prompt.submit({ text: 'long task', wait: false, origin: { kind: 'composer' } })
  await $.turn.start({ text: 'long task', turnId: 'long' })
  await clock.advance(120 * 60_000)
  expect(runs.length).toBe(1)
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`Cache Idle counts up while idle, changes color (${surface})`, async ($, on) => {
    world(on, [surface])
    const clock = mock.clock(on)
    await warm($, surface)
    const ui = await $.ui.mount({ plugin: 'lean-and-mean', surface, ...(surface === 'desktop' ? PANE : BAND) })
    const color = async () => (await ui.find({ type: 'Text', text: /\d+m/ }))?.props.color
    expect(await ui.find({ type: 'Text', text: /\b0m/ })).toBeDefined()
    expect(await color()).toBe('green')
    await clock.advance(40 * 60_000)
    expect(await ui.find({ type: 'Text', text: /40m/ })).toBeDefined()
    expect(await color()).toBe('yellow')
    await clock.advance(7 * 60_000)
    expect(await color()).toBe('#ff8700')
    await clock.advance(4 * 60_000)
    expect(await ui.find({ type: 'Text', text: /51m/ })).toBeDefined()
    expect(await color()).toBe('red')
    await ui.unmount()
  })
}

// A session idle past the 1h cache (auto-ended, or not when endFirst is false), `answer` picked in the cold-cache question; returns what the stand-ins saw.
async function cold($: Engine, on: On, answer: string, endFirst: boolean) {
  world(on)
  const clock = mock.clock(on)
  const seen = { asked: [] as string[], filled: [] as string[] }
  on('command.run', async () => ({ text: '' }))
  on('prompt.fill', async (_$, e) => {
    seen.filled.push(e.text)
    return { isFilled: true }
  })
  on('tool.call', { tool: 'AskUserQuestion' }, async (_$, e) => {
    const q = (e as any).questions[0].question
    seen.asked.push(q)
    return { result: { questions: (e as any).questions, answers: { [q]: answer } } } as never
  })
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true } as never)
  await $.prompt.submit({ text: 'do a thing', wait: false, origin: { kind: 'composer' } })
  await $.turn.complete({
    answer: 'Done.', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer',
    usage: { input_tokens: 1, output_tokens: 1 },
  } as never)
  // endFirst: the 55m auto-end runs. Otherwise a turn running past 55m blocks it and ends with no request.
  if (!endFirst) {
    await $.prompt.submit({ text: 'long task', wait: false, origin: { kind: 'composer' } })
    await $.turn.start({ text: 'long task', turnId: 'long' })
  }
  await clock.advance(61 * 60_000)
  if (!endFirst) await $.turn.complete({ answer: 'Stopped.', durationMs: 1, isAborted: true, turnId: 'long', reason: 'answer' } as never)
  const r = await $.prompt.submit({ text: 'next thing', wait: false, origin: { kind: 'composer' } })
  return { ...seen, r }
}

test('cold cache after auto endsession: Rehydrate sends the prompt', async ($, on) => {
  const { asked, r } = await cold($, on, 'Rehydrate', true)
  expect(asked.length).toBe(1)
  expect(asked[0]).toMatch(/already wrapped up/)
  expect(r.text).toBe('next thing')
})

test('cold cache after auto endsession: Clear first drops it and fills /clear', async ($, on) => {
  const { filled, r } = await cold($, on, 'Clear first', true)
  expect(r.drop).toMatch(/Next in AGENTS\.md/)
  expect(filled).toEqual(['/clear'])
})

test('cold cache without endsession: Clear first fills /endsession', async ($, on) => {
  const { asked, filled, r } = await cold($, on, 'Clear first', false)
  expect(asked[0]).toMatch(/has not run/)
  expect(r.drop).toMatch(/save Rules and Next/)
  expect(filled).toEqual(['/lean-and-mean:endsession'])
})

test('warm cache asks nothing', async ($, on) => {
  world(on)
  const asked: string[] = []
  on('tool.call', async (_$, e) => {
    asked.push(e.tool)
    return { deny: 'no' }
  })
  const clock = mock.clock(on)
  await $.prompt.submit({ text: 'one', wait: false, origin: { kind: 'composer' } })
  await $.turn.complete({
    answer: 'Done.', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer',
    usage: { input_tokens: 1, output_tokens: 1 },
  } as never)
  await clock.advance(30 * 60_000)
  await $.prompt.submit({ text: 'two', wait: false, origin: { kind: 'composer' } })
  expect(asked).toEqual([])
})

test('desktop pane mirrors the host task list; wrap_up checks it off', async ($, on) => {
  world(on, ['desktop'])
  mock.clock(on)
  on('tool.call', async (_$, e) => ({ result: {}, isError: false }) as never)
  await warm($, 'desktop')
  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', items: [
    { content: 'Write it', status: 'in_progress' }, { content: 'Test it', status: 'pending' },
  ] } as never)
  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', advance: true } as never)
  const pane = await $.ui.mount({ plugin: 'lean-and-mean', surface: 'desktop', ...PANE })
  expect(await pane.find({ type: 'Text', text: '✓ Write it' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: '● Test it' })).toBeDefined()
  await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'done' } as never)
  expect(await pane.find({ type: 'Text', text: '✓ Test it' })).toBeDefined()
  await pane.unmount()
})

test('Cache Idle timer survives a restart through $.store', async ($, on) => {
  const w = world(on, ['desktop'])
  const clock = mock.clock(on)
  // A new process: no $.state yet, the store holds the last request 20m ago.
  w.store.set('cacheAt', { s1: 0 })
  await clock.advance(20 * 60_000)
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  const pane = await $.ui.mount({ plugin: 'lean-and-mean', surface: 'desktop', ...PANE })
  expect(await pane.find({ type: 'Text', text: '20m' })).toBeDefined()
  await pane.unmount()
})

test('desktop pane: project, branch and worktree, then Context and limit meters', async ($, on) => {
  world(on, ['desktop'])
  mock.clock(on)
  await warm($, 'desktop')
  const pane = await $.ui.mount({ plugin: 'lean-and-mean', surface: 'desktop', ...PANE })
  expect(await pane.find({ type: 'Text', text: 'proj' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: '⎇ feat/x  ·  worktree feature' })).toBeDefined()
  expect((await pane.find({ type: 'Text', text: '42%' }))?.props.color).toBe('green')
  expect((await pane.find({ type: 'Text', text: '80%' }))?.props.color).toBe('#ff8700')
  expect(await pane.find({ type: 'Text', text: 'Weekly limit' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: '13%' })).toBeDefined()
  // A measure after a turn moves the meters.
  await $.session.measure({ context: { window: 200_000, percent: 95 }, rateLimits: [], changed: ['context'] } as never)
  expect((await pane.find({ type: 'Text', text: '95%' }))?.props.color).toBe('red')
  expect(await pane.find({ type: 'Text', text: '5h limit' })).toBeUndefined()
  expect((await pane.find({ key: 'end' }))?.props.variant).toBe('primary')
  await pane.unmount()
})

test('desktop pane: Context and Weekly bars split into baseline and growth, weekly reset caption', async ($, on) => {
  const w = world(on, ['desktop'])
  const start = new Date(2026, 10, 4, 9, 0).getTime()
  const clock = mock.clock(on, { now: start })
  const resetsAt = new Date(start + (2 * 1440 + 4 * 60) * 60_000).toISOString()
  const week = (p: number) => [{ kind: 'seven_day', percentUsed: p, resetsAt }]
  await warm($, 'desktop')
  // Day baseline taken at the first reading: 12.5%, stored for later sessions.
  expect(w.store.get('weekBase')).toEqual({ day: '2026-11-4', percent: 12.5 })
  await $.session.measure({ context: { window: 200_000, percent: 50 }, rateLimits: week(20), changed: ['context', 'rateLimits'] } as never)
  await $.prompt.submit({ text: 'next', wait: false, origin: { kind: 'composer' } })
  await $.session.measure({ context: { window: 200_000, percent: 58 }, rateLimits: week(20), changed: ['context'] } as never)
  let pane = await $.ui.mount({ plugin: 'lean-and-mean', surface: 'desktop', ...PANE })
  const svgs = await pane.findAll({ type: 'Svg' })
  expect(svgs.find(x => String(x.props.alt).startsWith('Context'))?.props.alt).toBe('Context: 58%, +8%')
  expect(svgs.find(x => String(x.props.alt).startsWith('Weekly'))?.props.alt).toBe('Weekly limit: 20%, +8%')
  expect(await pane.find({ type: 'Text', text: '+8%' })).toBeDefined()
  expect((await pane.find({ type: 'Text', text: 'resets in 2d 4h' }))?.props.size).toBe('caption')
  await pane.unmount()
  // Next day: the baseline restarts, so nothing is "added today" yet.
  await clock.advance(24 * 60 * 60_000)
  await $.session.measure({ context: { window: 200_000, percent: 58 }, rateLimits: week(21), changed: ['rateLimits'] } as never)
  pane = await $.ui.mount({ plugin: 'lean-and-mean', surface: 'desktop', ...PANE })
  expect((await pane.findAll({ type: 'Svg' })).find(x => String(x.props.alt).startsWith('Weekly'))?.props.alt).toBe('Weekly limit: 21%')
  expect(await pane.find({ type: 'Text', text: 'resets in 1d 4h' })).toBeDefined()
  await pane.unmount()
})

test('a running main-loop turn shows BUSY in the bar, pane and band; subagent turns do not', async ($, on) => {
  world(on, ['desktop'])
  const clock = mock.clock(on)
  await warm($, 'desktop')
  await clock.advance(10 * 60_000)
  await $.turn.start({ text: '', turnId: 'sub', agentId: 'a1' })
  let pane = await $.ui.mount({ plugin: 'lean-and-mean', surface: 'desktop', ...PANE })
  expect(await pane.find({ type: 'Text', text: '10m' })).toBeDefined()
  await pane.unmount()
  await $.turn.start({ text: 'work', turnId: 'main' })
  await clock.advance(5 * 60_000)
  pane = await $.ui.mount({ plugin: 'lean-and-mean', surface: 'desktop', ...PANE })
  expect(await pane.find({ type: 'Text', text: 'busy' })).toBeDefined()
  expect((await pane.findAll({ type: 'Svg' })).at(-1)?.props.source).toContain('>BUSY</text>')
  await pane.unmount()
  const band = await $.ui.mount({ plugin: 'lean-and-mean', surface: 'terminal', ...BAND })
  expect(await band.find({ type: 'Text', text: '    BUSY    ' })).toBeDefined()
  await band.unmount()
  await $.turn.complete({ answer: 'Done.', durationMs: 1, isAborted: false, turnId: 'main', reason: 'answer' })
  pane = await $.ui.mount({ plugin: 'lean-and-mean', surface: 'desktop', ...PANE })
  expect(await pane.find({ type: 'Text', text: '0m' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: 'busy' })).toBeUndefined()
  await pane.unmount()
})
