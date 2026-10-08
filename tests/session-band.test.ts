import { describe, expect, test } from 'claude-code/testing'

import { allDone, autoEndDue, cacheLabel, parseTasks } from '../hooks/judge'

describe('parseTasks', () => {
  test('reads fenced JSON', async () => {
    const t = parseTasks('```json\n{"tasks":[{"text":"Add band","done":true}]}\n```')
    expect(t).toEqual([{ text: 'Add band', done: true }])
    expect(allDone(t ?? [])).toBe(true)
  })
  test('rejects garbage and bad shapes', async () => {
    expect(parseTasks('no json')).toBe(null)
    expect(parseTasks('{"tasks":[{"text":"x"}]}')).toBe(null)
    expect(parseTasks('{"tasks":"x"}')).toBe(null)
  })
  test('empty list is not done', async () => {
    expect(allDone([])).toBe(false)
  })
})

test('autoEndDue at 5 minutes left', async () => {
  expect(autoEndDue(null, 99 * 60_000)).toBe(false)
  expect(autoEndDue(0, 54 * 60_000)).toBe(false)
  expect(autoEndDue(0, 55 * 60_000)).toBe(true)
})

test('cacheLabel colors by time left', async () => {
  const at = (m: number) => cacheLabel(0, (60 - m) * 60_000)?.color
  expect(cacheLabel(null, 0)).toBe(null)
  expect([at(31), at(30), at(16), at(15), at(11), at(10), at(5)]).toEqual(
    ['green', 'yellow', 'yellow', '#ff8700', '#ff8700', 'red', 'red'],
  )
  expect(cacheLabel(0, 61 * 60_000)?.text).toBe('exp. cold')
})
