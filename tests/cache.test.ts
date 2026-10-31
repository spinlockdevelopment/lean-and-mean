import { expect, test } from 'claude-code/testing'

import { autoEndDue, barCells, barSvg, cacheLabel } from '../hooks/cache'
import { brief, nextItems } from '../hooks/next'
import { applyPlan } from '../hooks/plan'

test('autoEndDue at 5 minutes left', async () => {
  expect(autoEndDue(null, 99 * 60_000)).toBe(false)
  expect(autoEndDue(0, 54 * 60_000)).toBe(false)
  expect(autoEndDue(0, 55 * 60_000)).toBe(true)
})

test('cacheLabel counts idle time up and colors by it', async () => {
  const at = (m: number) => cacheLabel(0, m * 60_000)?.color
  expect(cacheLabel(null, 0)).toBe(null)
  expect([at(29), at(30), at(44), at(45), at(49), at(50), at(55)]).toEqual(
    ['green', 'yellow', 'yellow', '#ff8700', '#ff8700', 'red', 'red'],
  )
  expect(cacheLabel(0, 0)?.minutes).toBe('0m')
  expect(cacheLabel(0, 21.5 * 60_000)?.minutes).toBe('21m')
  expect(cacheLabel(0, 21 * 60_000)?.fraction).toBe(21 / 60)
  expect(cacheLabel(0, 61 * 60_000)?.minutes).toBe('cold')
})

test('bar fills by idle time', async () => {
  expect([barCells(1), barCells(21 / 60), barCells(0.001), barCells(0)]).toEqual([12, 5, 1, 0])
  expect(barSvg(0.5, '#22c55e')).toContain('width="100" height="8" rx="4" fill="#22c55e"')
})

test('applyPlan mirrors update_plan', async () => {
  const t = applyPlan([], { items: [
    { content: 'a', status: 'in_progress' }, { content: 'b', status: 'pending' }, { content: 'c', status: 'pending' },
  ] })
  const s = (x: { status: string }[]) => x.map(i => i.status[0]).join('')
  expect(s(t)).toBe('ipp')
  expect(s(applyPlan(t, { advance: true }))).toBe('cip')
  expect(s(applyPlan(t, { done: [1, 2], start: 3 }))).toBe('cci')
  expect(s(applyPlan(applyPlan(t, { advance: true }), { advance: true }))).toBe('cci')
  expect(s(t)).toBe('ipp')
})

test('nextItems reads only ## Next, one brief item per lead line or bullet', async () => {
  const md = '## Rules\n- r\n## Next\nLead one (aside); more.\nLead two is pending: a long tail that goes on and on past the cap for sure, yes.\n- P1 — fix `x`\n  wrapped tail\n- plain\n## Notes\n- n\n'
  expect(nextItems(md)).toEqual([
    { priority: null, text: 'Lead one' },
    { priority: null, text: 'Lead two is pending' },
    { priority: 'P1', text: 'fix x wrapped tail' },
    { priority: null, text: 'plain' },
  ])
  expect(nextItems('# none')).toEqual([])
  const cut = brief('word '.repeat(30))
  expect(cut.endsWith('word…') && cut.length <= 64).toBe(true)
})
