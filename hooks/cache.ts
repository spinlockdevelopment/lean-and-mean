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
  const [color, hex] = tone(m, 30, 45, 50)
  return { minutes: idle === CACHE_TTL_MS ? 'cold' : `${Math.floor(m)}m`, fraction: idle / CACHE_TTL_MS, color, hex }
}

/** [terminal color, SVG hex]: green below `y`, yellow below `o`, orange below `r`, else red. */
const tone = (v: number, y: number, o: number, r: number) =>
  v < y ? ['green', '#22c55e'] : v < o ? ['yellow', '#eab308'] : v < r ? ['#ff8700', '#ff8700'] : ['red', '#ef4444']

/** Context or rate-limit fill, 0 to 100, for a pane meter: <50% green, <75% yellow, <90% orange, else red. */
export function meterLabel(percent: number) {
  const p = Math.min(100, Math.max(0, percent))
  const [color, hex] = tone(p, 50, 75, 90)
  return { text: `${Math.round(p)}%`, fraction: p / 100, color, hex }
}

/** Rate-limit window names as the pane shows them. */
export const limitTitle = (kind: string) => ({ five_hour: '5h limit', seven_day: 'Weekly limit' } as Record<string, string>)[kind] ?? kind

/** True once the 1h prompt cache has expired: the next request resends the whole context uncached. */
export const cacheCold = (cacheAt: number | null, now: number) => cacheAt !== null && now >= cacheAt + CACHE_TTL_MS

/** Desktop pane bar: rounded track, fill to `fraction`. With `from`, the part up to it is
 *  pale and the part from it to `fraction` solid: what was added since that baseline. */
export function barSvg(fraction: number, hex: string, from?: number) {
  const w = Math.round(fraction * 200)
  const x = from === undefined ? w : Math.min(w, Math.round(Math.max(0, from) * 200))
  const added = w - x > 0
    ? `<clipPath id="f"><rect width="${w}" height="8" rx="4" /></clipPath>` +
      `<rect x="${x}" width="${w - x}" height="8" fill="${hex}" clip-path="url(#f)" />`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="8" viewBox="0 0 200 8">` +
    `<rect width="200" height="8" rx="4" fill="#8884" />` +
    `<rect width="${w}" height="8" rx="4" fill="${hex}"${from === undefined ? '' : ' fill-opacity="0.5"'} />${added}</svg>`
}

/** Local calendar day of a `$.clock.now()` reading, for the weekly limit's "added today" baseline. */
export const dayKey = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/** Weekly baseline for `day`: kept while the same day, else (new day, first reading, or a reset
 *  dropped usage below it) restarted at the current percent. */
export const rebase = (base: { day: string; percent: number } | null, day: string, percent: number) =>
  base && base.day === day && percent >= base.percent ? base : { day, percent }

/** Time to an ISO reset, as `resets in 2d 4h` / `3h 10m` / `5m`; null when absent, unparsable or past. */
export function resetIn(iso: string | undefined, now: number) {
  const ms = iso ? Date.parse(iso) - now : NaN
  if (!(ms > 0)) return null
  const m = Math.ceil(ms / 60_000)
  const [d, h, mm] = [Math.floor(m / 1440), Math.floor((m % 1440) / 60), m % 60]
  return `resets in ${d ? `${d}d ${h}h` : h ? `${h}h ${mm}m` : `${mm}m`}`
}

/** Busy (a main-loop turn running): blue, the bar full with BUSY centered. */
export const BUSY_COLOR = 'blue'
export const BUSY_HEX = '#3b82f6'
export const busySvg = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="14" viewBox="0 0 200 14">` +
  `<rect width="200" height="14" rx="7" fill="${BUSY_HEX}" />` +
  `<text x="100" y="10.5" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="#fff">BUSY</text></svg>`

/** Terminal bar cells filled, rounded up so any idle time shows. */
export const BAR_CELLS = 12
export const barCells = (fraction: number) => Math.ceil(fraction * BAR_CELLS)
/** Terminal busy bar: BUSY centered in the bar's cells. */
export const BUSY_CELLS = 'BUSY'.padStart((BAR_CELLS + 4) / 2).padEnd(BAR_CELLS)
