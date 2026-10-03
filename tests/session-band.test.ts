import { describe, expect, test } from 'claude-code/testing'

import { allDone, cacheLabel, parseTasks } from '../hooks/judge'

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

test('cache countdown', async () => {
  expect(cacheLabel(null, 0)).toEqual({ text: 'cache —', bar: '', isLow: false })
  expect(cacheLabel(0, 15 * 60_000)).toEqual({ text: 'cache 45m', bar: '████████░░', isLow: false })
  expect(cacheLabel(0, 55 * 60_000)).toEqual({ text: 'cache 5m', bar: '█░░░░░░░░░', isLow: true })
  expect(cacheLabel(0, 61 * 60_000)).toEqual({ text: 'cache cold', bar: '░░░░░░░░░░', isLow: true })
})
