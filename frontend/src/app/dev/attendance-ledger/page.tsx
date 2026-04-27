'use client'

/**
 * Standalone preview for the editorial-industrial attendance-ledger
 * UI mock. The mock itself lives as a static asset under
 * /public/attendance-ledger.html so it stays self-contained (own
 * fonts, own CSS, no app chrome bleed-through). This route just
 * iframes it at full viewport and adds a thin dev-tools strip.
 *
 * Open at /dev/attendance-ledger.
 */
export default function AttendanceLedgerPreviewPage() {
  return (
    <div className="fixed inset-0 flex flex-col bg-[#1c1810] text-[#f3ecda]">
      {/* dev strip */}
      <header className="flex items-center justify-between gap-4 border-b border-[#3b3322] px-4 py-2 font-mono text-[11px]">
        <div className="flex items-center gap-3">
          <span className="inline-block h-2 w-2 rounded-full bg-[#7a1f1f]" />
          <span className="tracking-[0.18em] uppercase opacity-80">
            UI Preview · Daily Attendance Ledger
          </span>
        </div>
        <div className="flex items-center gap-3 opacity-60">
          <a
            href="/attendance-ledger.html"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[#f3ecda] transition-colors"
          >
            ↗ open standalone
          </a>
          <span className="opacity-40">·</span>
          <a
            href="/dev"
            className="hover:text-[#f3ecda] transition-colors"
          >
            ← dev index
          </a>
        </div>
      </header>

      {/* the mock itself */}
      <iframe
        src="/attendance-ledger.html"
        title="Attendance Ledger preview"
        className="flex-1 w-full border-0 bg-[#f3ecda]"
      />
    </div>
  )
}
