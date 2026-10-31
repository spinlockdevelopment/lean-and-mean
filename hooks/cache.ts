export const CACHE_TTL_MS = 60 * 60 * 1000

export const AUTO_END_MS = 5 * 60 * 1000

/** True once the 1h prompt cache has 5 minutes or less left. */
export const autoEndDue = (cacheAt: number | null, now: number) =>
  cacheAt !== null && now >= cacheAt + CACHE_TTL_MS - AUTO_END_MS

const BAR = 12

/** Band label for the 1h cache: "Cache Idle [*****-------] 21m", "... cold"; null before the first request.
 *  The bar fills by time left, rounded up.
 *  Color by time left: >30m green, >15m yellow, >10m orange, else red (auto-end fires at 5m). */
export function cacheLabel(cacheAt: number | null, now: number): { text: string; color: string } | null {
  if (cacheAt === null) return null
  const left = Math.max(0, cacheAt + CACHE_TTL_MS - now)
  const m = left / 60_000
  const color = m > 30 ? 'green' : m > 15 ? 'yellow' : m > 10 ? '#ff8700' : 'red'
  const full = Math.ceil((left / CACHE_TTL_MS) * BAR)
  const bar = `[${'*'.repeat(full)}${'-'.repeat(BAR - full)}]`
  return { text: `Cache Idle ${bar} ${left === 0 ? 'cold' : `${Math.ceil(m)}m`}`, color }
}

/** True once the 1h prompt cache has expired: the next request resends the whole context uncached. */
export const cacheCold = (cacheAt: number | null, now: number) => cacheAt !== null && now >= cacheAt + CACHE_TTL_MS
