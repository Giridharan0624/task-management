'use client'

import { useCallback, useEffect, useState } from 'react'

export interface ScreenshotItem {
  url: string
  timestamp: string
}

interface ScreenshotGalleryProps {
  screenshots: ScreenshotItem[]
  /** Collapsed by default on the activity report; dev samples can
   *  pass `false` to show the grid immediately. */
  defaultCollapsed?: boolean
}

/**
 * Collapsible grid of screenshot thumbnails with a fullscreen viewer
 * that supports prev/next navigation (buttons + keyboard), shows the
 * timestamp of the currently-displayed shot, and falls through to
 * jump-anywhere via a thumbnail strip.
 *
 * Extracted from ActivityReport so the dev harness page and any
 * future "activity in project/task detail" views can reuse it.
 */
export function ScreenshotGallery({ screenshots, defaultCollapsed = true }: ScreenshotGalleryProps) {
  // Selected index (not URL) so we can navigate relative to the array.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const total = screenshots.length
  const selected = selectedIndex !== null ? screenshots[selectedIndex] : null
  const close = useCallback(() => setSelectedIndex(null), [])
  const goPrev = useCallback(() => {
    setSelectedIndex(i => (i === null || i <= 0 ? i : i - 1))
  }, [])
  const goNext = useCallback(() => {
    setSelectedIndex(i => (i === null || i >= total - 1 ? i : i + 1))
  }, [total])

  // Keyboard navigation (only active when modal is open). Arrow keys
  // move between shots; Escape closes; Home/End jump to ends. Matches
  // the OS photo-viewer conventions users already know.
  useEffect(() => {
    if (selectedIndex === null) return
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          goPrev()
          break
        case 'ArrowRight':
          e.preventDefault()
          goNext()
          break
        case 'Escape':
          e.preventDefault()
          close()
          break
        case 'Home':
          e.preventDefault()
          setSelectedIndex(0)
          break
        case 'End':
          e.preventDefault()
          setSelectedIndex(total - 1)
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedIndex, goPrev, goNext, close, total])

  return (
    <div className="px-5 py-4 border-b border-border/50 dark:border-gray-800">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 w-full text-left mb-3 group"
      >
        <svg className={`w-3.5 h-3.5 text-muted-foreground/70 transition-transform ${collapsed ? '' : 'rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest group-hover:text-muted-foreground transition-colors">
          Screenshots ({screenshots.length})
        </span>
      </button>
      {!collapsed && <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {screenshots.map((s, i) => (
          <button
            key={i}
            onClick={() => setSelectedIndex(i)}
            className="group relative rounded-lg overflow-hidden border border-border/80 dark:border-gray-700 hover:border-indigo-400 transition-all hover:shadow-md"
          >
            <img
              src={s.url}
              alt={`Screenshot ${i + 1}`}
              className="w-full aspect-video object-cover"
              loading="lazy"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1">
              <span className="text-[8px] text-white font-medium tabular-nums">
                {new Date(s.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </button>
        ))}
      </div>}

      {/* Fullscreen modal with prev/next navigation. Uses almost the
          full viewport (95vw × 95vh) and object-contain so the image
          is shown at the largest size that fits without cropping —
          capped by the native resolution, never by modal width. The
          previous max-w-5xl (1024px) made 1080p screenshots look
          blurry on anything bigger than a laptop screen. */}
      {selected && selectedIndex !== null && (
        <div
          className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-4 cursor-pointer"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={`Screenshot ${selectedIndex + 1} of ${total}`}
        >
          <div
            className="relative w-[95vw] h-[95vh] flex items-center justify-center"
            onClick={e => e.stopPropagation()}
          >
            {/* Full image */}
            <img
              src={selected.url}
              alt={`Screenshot ${selectedIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            />

            {/* Top-left: timestamp + counter. Always readable regardless
                of image content via solid bg + shadow. */}
            <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur text-white text-xs font-medium tabular-nums flex items-center gap-2">
              <span>
                {new Date(selected.timestamp).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
              <span className="text-white/60">·</span>
              <span className="text-white/80">
                {selectedIndex + 1} / {total}
              </span>
            </div>

            {/* Close */}
            <button
              onClick={close}
              aria-label="Close"
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Prev arrow — hidden at index 0 rather than disabled-styled
                so the UI doesn't imply "there's a previous, it's just off"
                which the user might click at repeatedly. */}
            {selectedIndex > 0 && (
              <button
                onClick={goPrev}
                aria-label="Previous screenshot"
                className="absolute top-1/2 left-3 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            {selectedIndex < total - 1 && (
              <button
                onClick={goNext}
                aria-label="Next screenshot"
                className="absolute top-1/2 right-3 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* Thumbnail strip — click to jump anywhere. */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
              {screenshots.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedIndex(i)}
                  aria-label={`Go to screenshot ${i + 1}`}
                  aria-current={i === selectedIndex ? 'true' : undefined}
                  className={`w-12 h-7 rounded overflow-hidden border-2 transition-all ${
                    i === selectedIndex ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={s.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
