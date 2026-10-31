import { expect, test } from 'claude-code/testing'

import { autoEndDue, cacheLabel } from '../hooks/cache'

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
