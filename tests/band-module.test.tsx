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
