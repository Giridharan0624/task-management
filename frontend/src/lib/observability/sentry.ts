/**
 * Runtime-optional Sentry initialization.
 *
 * The flow is deliberately two-stage so the scaffold ships before the
 * operator commits to a Sentry account:
 *
 *   1. Set `NEXT_PUBLIC_SENTRY_DSN` in Vercel's env vars.
 *   2. `npm install @sentry/browser` (not in package.json by default —
 *      dynamic import below gracefully no-ops when the module is
 *      absent). That avoids bundling ~70KB into every page when nobody
 *      has wired up telemetry yet.
 *
 * The caller (ClientLayout or an equivalent root client boundary)
 * invokes `initSentry()` once on mount. If either prerequisite is
 * missing, nothing is loaded.
 */
let initialized = false

export async function initSentry(): Promise<void> {
  if (initialized) return
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) {
    initialized = true
    return
  }

  try {
    // Dynamic import so webpack tree-shakes it out when the package
    // isn't installed. The `@ts-ignore` is intentional — `@sentry/browser`
    // is optional and may not be resolvable at compile time.
    // @ts-expect-error optional peer
    const Sentry = await import(/* webpackIgnore: true */ '@sentry/browser')
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_ENV ?? 'unknown',
      release: process.env.NEXT_PUBLIC_GIT_SHA ?? 'unknown',
      // Low default — errors are always captured; traces (RUM) are
      // noisy + expensive. Operator can override via env.
      tracesSampleRate: Number(
        process.env.NEXT_PUBLIC_SENTRY_TRACES_RATE ?? '0.1',
      ),
      beforeSend(event: { request?: { url?: string } }) {
        // Drop obvious local-dev noise so the self-hosted instance
        // doesn't fill up during `npm run dev`. Prod will never have
        // a localhost URL.
        // Structural param type because @sentry/browser is an
        // optional peer dep — we can't import Sentry.Event without
        // re-triggering the @ts-expect-error from the import line.
        if (event.request?.url?.includes('localhost')) return null
        return event
      },
    })
    initialized = true
  } catch {
    // Package not installed — scaffold stays dormant. Intentional.
    initialized = true
  }
}
