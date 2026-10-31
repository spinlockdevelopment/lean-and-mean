export const CACHE_TTL_MS = 60 * 60 * 1000

export const AUTO_END_MS = 5 * 60 * 1000

/** True once the 1h prompt cache has 5 minutes or less left. */
export const autoEndDue = (cacheAt: number | null, now: number) =>
  cacheAt !== null && now >= cacheAt + CACHE_TTL_MS - AUTO_END_MS

/** Time idle since the last request, counting up to the 1h TTL, for the Cache Idle bar; null before the first request.
 *  `fraction` is idle time over the TTL. Color by idle time: <30m green, <45m yellow,
 *  <50m orange, else red (auto-end fires at 55m); `hex` is the same color for the SVG bar. */
export function cacheLabel(cacheAt: number | null, now: number) {
  if (cacheAt === null) return null
  const idle = Math.min(CACHE_TTL_MS, Math.max(0, now - cacheAt))
  const m = idle / 60_000
  const [color, hex] = m < 30 ? ['green', '#22c55e'] : m < 45 ? ['yellow', '#eab308'] : m < 50 ? ['#ff8700', '#ff8700'] : ['red', '#ef4444']
  return { minutes: idle === CACHE_TTL_MS ? 'cold' : `${Math.floor(m)}m`, fraction: idle / CACHE_TTL_MS, color, hex }
}

/** True once the 1h prompt cache has expired: the next request resends the whole context uncached. */
export const cacheCold = (cacheAt: number | null, now: number) => cacheAt !== null && now >= cacheAt + CACHE_TTL_MS

/** Desktop pane bar: rounded track, fill by idle time. */
export const barSvg = (fraction: number, hex: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="8" viewBox="0 0 200 8">` +
  `<rect width="200" height="8" rx="4" fill="#8884" />` +
  `<rect width="${Math.round(fraction * 200)}" height="8" rx="4" fill="${hex}" /></svg>`

/** Terminal bar cells filled, rounded up so any idle time shows. */
export const BAR_CELLS = 12
export const barCells = (fraction: number) => Math.ceil(fraction * BAR_CELLS)
