'use client'

/**
 * Dev harness for the screenshot gallery. Routes under /dev/... live
 * OUTSIDE the (dashboard) group on purpose — no sidebar, no auth gate,
 * no backend calls — so you can iterate on the viewer's UX without
 * needing a signed-in user who has real activity data.
 *
 * Sample images come from picsum.photos so there's nothing to deploy
 * or mock. Timestamps are synthesised from a fixed base + 5-min steps
 * so the nav counter behaves predictably.
 *
 * Delete this file before v1.3.0 ships — or keep it around if you
 * want a /dev sandbox for future UI components. It pulls zero
 * dependencies that aren't already in the bundle.
 */

import { ScreenshotGallery, type ScreenshotItem } from '@/components/reports/ScreenshotGallery'

const SAMPLE_COUNT = 12
const BASE = new Date('2026-05-01T09:00:00+05:30') // fixed so TZ differences don't confuse reviewers
const INTERVAL_MINUTES = 5

const sampleScreenshots: ScreenshotItem[] = Array.from({ length: SAMPLE_COUNT }, (_, i) => ({
  // picsum serves stable images per seed, so reloads show the same
  // sequence — lets you verify "did index 7 really change?" visually.
  url: `https://picsum.photos/seed/taskflow-sample-${i + 1}/1600/900`,
  timestamp: new Date(BASE.getTime() + i * INTERVAL_MINUTES * 60_000).toISOString(),
}))

export default function ScreenshotGalleryDevPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
            /dev sandbox
          </p>
          <h1 className="text-xl font-bold mt-1 text-gray-900 dark:text-gray-100">
            ScreenshotGallery
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {SAMPLE_COUNT} picsum.photos images on a 5-minute cadence, starting {BASE.toLocaleString()}.
            Click any thumbnail, then navigate with <kbd className="px-1.5 py-0.5 text-xs rounded bg-gray-200 dark:bg-gray-800">←</kbd>
            {' '}/{' '}
            <kbd className="px-1.5 py-0.5 text-xs rounded bg-gray-200 dark:bg-gray-800">→</kbd>,
            jump with{' '}
            <kbd className="px-1.5 py-0.5 text-xs rounded bg-gray-200 dark:bg-gray-800">Home</kbd>
            {' '}/{' '}
            <kbd className="px-1.5 py-0.5 text-xs rounded bg-gray-200 dark:bg-gray-800">End</kbd>,
            close with <kbd className="px-1.5 py-0.5 text-xs rounded bg-gray-200 dark:bg-gray-800">Esc</kbd>.
          </p>
        </header>

        {/* defaultCollapsed={false} so reviewers see the grid immediately. */}
        <div className="rounded-xl bg-white dark:bg-gray-900 border border-border/50 dark:border-gray-800 overflow-hidden">
          <ScreenshotGallery screenshots={sampleScreenshots} defaultCollapsed={false} />
        </div>

        <div className="mt-8 rounded-xl border border-dashed border-border/70 dark:border-gray-700 p-4 text-xs text-muted-foreground">
          <p className="font-semibold mb-1">What to check:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Timestamp pill (top-left) updates as you step through — shows date + second-precision time + the N / M counter.</li>
            <li>Prev arrow is hidden at index 1, Next arrow is hidden at index {SAMPLE_COUNT}.</li>
            <li>Thumbnail strip at bottom reflects the current selection with a white border.</li>
            <li>Click the backdrop (not the image) to close. Esc also closes.</li>
            <li>Tab order: close → prev → next → thumbnails. All have aria-labels.</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
