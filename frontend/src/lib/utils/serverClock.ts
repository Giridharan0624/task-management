/**
 * serverClock — maintains the offset between the local `Date.now()`
 * and the backend's authoritative UTC clock.
 *
 * See the matching file in the desktop app for the full rationale.
 * Short version: two devices viewing the same session were showing
 * different elapsed times because each computed `Date.now() - signInAt`
 * against its own OS clock. Device A 30 s ahead of NTP + device B
 * synced = 30 s of permanent drift on the displayed timer. With this
 * module both ticks are relative to the server's clock, not the
 * local one, so cross-device displays agree.
 *
 * Every attendance response (fetch / sign-in / sign-out / heartbeat)
 * carries a `server_time` ISO string. The query layer calls
 * `recordServerTime(iso)` on receipt; that updates the offset. Timer
 * code calls `serverNow()` instead of `Date.now()`.
 */

const SAMPLE_CAPACITY = 8

// offset such that `serverNow() = Date.now() + offset`
let offset = 0
const samples: number[] = []

export function recordServerTime(iso: string | undefined | null): void {
  if (!iso) return
  const parsed = Date.parse(iso)
  if (!Number.isFinite(parsed)) return
  const sample = parsed - Date.now()
  samples.push(sample)
  if (samples.length > SAMPLE_CAPACITY) samples.shift()
  // Median of the recent samples — robust against a single slow
  // response that would skew a naive average.
  const sorted = [...samples].sort((a, b) => a - b)
  offset = sorted[Math.floor(sorted.length / 2)]
}

export function serverNow(): number {
  return Date.now() + offset
}

/** Elapsed milliseconds between an ISO timestamp and server-now. */
export function elapsedSince(iso: string | null | undefined): number {
  if (!iso) return 0
  const start = Date.parse(iso)
  if (!Number.isFinite(start)) return 0
  return Math.max(0, serverNow() - start)
}

/** Test seam. */
export function _resetForTests(): void {
  offset = 0
  samples.length = 0
}
