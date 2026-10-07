import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 80, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

// Engine stand-ins beneath the plugin; `reply` is what the stubbed Haiku judge answers.
function world(on: On, reply: string) {
  const calls: string[] = []
  on('model.complete', async (_$, e) => {
    calls.push(e.prompt)
    return { value: { isAnswered: true, text: reply, usage: { input_tokens: 1, output_tokens: 1 } } }
  })
  on('prompt.submit', async (_$, e) => ({ text: e.text, context: e.context }))
  on('turn.complete', async (_$, e) => ({ text: e.answer }))
  on('ui.toast', async () => ({ value: undefined }))
  on('ui.render', async ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="engine" />
  })
  return calls
}

async function turn($: Engine, prompt: string, answer: string) {
  await $.prompt.submit({ text: prompt, wait: false, origin: { kind: 'composer' } })
  await $.turn.complete({ answer, durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`judge reply becomes the checklist (${surface})`, async ($, on) => {
    const calls = world(on, '{"tasks":[{"text":"Add tests","done":true},{"text":"Bump version","done":false}]}')
    await turn($, 'add tests and bump the version', 'Tests added.')
    expect(calls.length).toBe(1)
    const ui = await $.ui.mount({ plugin: 'lean-and-mean', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: /Bump version/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /tasks 1\/2/ })).toBeDefined()
    expect(await ui.find({ key: 'end' })).toBeDefined()
    await ui.unmount()
  })

  test(`hide tasks toggles the checklist (${surface})`, async ($, on) => {
    world(on, '{"tasks":[{"text":"Bump version","done":false}]}')
    await turn($, 'bump the version', 'Working on it.')
    const ui = await $.ui.mount({ plugin: 'lean-and-mean', surface, ...BAND })
    await ui.press({ key: 'toggle' })
    expect(await ui.find({ type: 'Text', text: /Bump version/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /tasks 0\/1/ })).toBeDefined()
    await ui.press({ key: 'toggle' })
    expect(await ui.find({ type: 'Text', text: /Bump version/ })).toBeDefined()
    await ui.unmount()
  })

  test(`malformed judge reply keeps the band empty (${surface})`, async ($, on) => {
    world(on, 'sorry, no JSON')
    await turn($, 'do a thing', 'Done.')
    const ui = await $.ui.mount({ plugin: 'lean-and-mean', surface, ...BAND })
    expect(await ui.find({ key: 'end' })).toBeUndefined()
    await ui.unmount()
  })

  test(`sessionBand false: no judge call, no band (${surface})`, { options: { sessionBand: false } }, async ($, on) => {
    const calls = world(on, '{"tasks":[{"text":"x","done":false}]}')
    await turn($, 'do a thing', 'Done.')
    expect(calls.length).toBe(0)
    const ui = await $.ui.mount({ plugin: 'lean-and-mean', surface, ...BAND })
    expect(await ui.find({ key: 'end' })).toBeUndefined()
    await ui.unmount()
  })
}

test('endsession runs once when the cache has 5 minutes left', async ($, on) => {
  world(on, '{"tasks":[]}')
  const clock = mock.clock(on)
  const runs: string[] = []
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('command.list', async () => ({ value: [{ name: 'lean-and-mean:endsession' }] }))
  on('session.surfaces', async () => ({ value: ['terminal'] }))
  on('command.run', async (_$, e) => {
    runs.push(`${e.command} ${e.args}`)
    return { text: '' }
  })
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
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

test('cache countdown shows off the terminal only and ticks while idle', async ($, on) => {
  world(on, '{"tasks":[]}')
  const clock = mock.clock(on)
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('command.list', async () => ({ value: [] }))
  on('session.surfaces', async () => ({ value: ['desktop'] }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true } as never)
  await $.prompt.submit({ text: 'do a thing', wait: false, origin: { kind: 'composer' } })
  await $.turn.complete({
    answer: 'Done.', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer',
    usage: { input_tokens: 1, output_tokens: 1 },
  } as never)
  const term = await $.ui.mount({ plugin: 'lean-and-mean', surface: 'terminal', ...BAND })
  expect(await term.find({ key: 'cache' })).toBeUndefined()
  await term.unmount()
  const ui = await $.ui.mount({ plugin: 'lean-and-mean', surface: 'desktop', ...BAND })
  expect(await ui.find({ type: 'Text', text: /exp\. 60m/ })).toBeDefined()
  await clock.advance(20 * 60_000)
  expect(await ui.find({ type: 'Text', text: /exp\. 40m/ })).toBeDefined()
  await clock.advance(31 * 60_000)
  expect(await ui.find({ type: 'Text', text: /exp\. 9m/ })).toBeDefined()
  await ui.unmount()
})

// A session idle past the 1h cache (auto-ended, or not when endFirst is false), `answer` picked in the cold-cache question; returns what the stand-ins saw.
async function cold($: Engine, on: On, answer: string, endFirst: boolean) {
  world(on, '{"tasks":[]}')
  const clock = mock.clock(on)
  const seen = { asked: [] as string[], filled: [] as string[] }
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('command.list', async () => ({ value: [{ name: 'lean-and-mean:endsession' }] }))
  on('session.surfaces', async () => ({ value: ['terminal'] }))
  on('command.run', async () => ({ text: '' }))
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
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
  world(on, '{"tasks":[]}')
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
