import { expect, test } from 'claude-code/testing'
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
