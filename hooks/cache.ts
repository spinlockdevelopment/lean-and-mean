export const CACHE_TTL_MS = 60 * 60 * 1000

export const AUTO_END_MS = 5 * 60 * 1000

/** True once the 1h prompt cache has 5 minutes or less left. */
export const autoEndDue = (cacheAt: number | null, now: number) =>
  cacheAt !== null && now >= cacheAt + CACHE_TTL_MS - AUTO_END_MS

/** The 1h cache's time left for the Cache Idle bar; null before the first request.
 *  `fraction` is time left over the TTL. Color by time left: >30m green, >15m yellow,
 *  >10m orange, else red (auto-end fires at 5m); `hex` is the same color for the SVG bar. */
export function cacheLabel(cacheAt: number | null, now: number) {
  if (cacheAt === null) return null
  const left = Math.max(0, cacheAt + CACHE_TTL_MS - now)
  const m = left / 60_000
  const [color, hex] = m > 30 ? ['green', '#22c55e'] : m > 15 ? ['yellow', '#eab308'] : m > 10 ? ['#ff8700', '#ff8700'] : ['red', '#ef4444']
  return { minutes: left === 0 ? 'cold' : `${Math.ceil(m)}m`, fraction: left / CACHE_TTL_MS, color, hex }
}

/** True once the 1h prompt cache has expired: the next request resends the whole context uncached. */
export const cacheCold = (cacheAt: number | null, now: number) => cacheAt !== null && now >= cacheAt + CACHE_TTL_MS

/** Desktop pane bar: rounded track, fill by time left. */
export const barSvg = (fraction: number, hex: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="8" viewBox="0 0 200 8">` +
  `<rect width="200" height="8" rx="4" fill="#8884" />` +
  `<rect width="${Math.round(fraction * 200)}" height="8" rx="4" fill="${hex}" /></svg>`

/** Terminal bar cells filled, rounded up so any time left shows. */
export const BAR_CELLS = 12
export const barCells = (fraction: number) => Math.ceil(fraction * BAR_CELLS)
