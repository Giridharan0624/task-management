'use client'

import { Card } from '@/components/ui/Card'
import { CheckCircle2 } from 'lucide-react'

interface BrandingPreviewProps {
  primaryColor: string
  accentColor: string
  displayName: string
}

/**
 * Live UI sampler so OWNERs see the effect of color/branding changes
 * without saving + reloading. Renders representative components
 * (button, badge, link, progress) using inline styles tied to the
 * pending colors rather than CSS vars (which only update after Save).
 */
export function BrandingPreview({
  primaryColor,
  accentColor,
  displayName,
}: BrandingPreviewProps) {
  return (
    <Card className="space-y-4 p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Live preview
      </p>

      {/* Initial + name preview — no logo upload anymore, so we always
          render the colored initial tile. */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl text-base font-bold text-white shadow-sm"
          style={{ backgroundColor: primaryColor }}
        >
          {(displayName || 'A').charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">
            {displayName || 'Your workspace'}
          </p>
          <p className="text-[11px] text-muted-foreground">Workspace name</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 border-t border-border/60 pt-4 sm:grid-cols-2">
        {/* Primary button */}
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Primary button
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-white shadow-sm"
            style={{ backgroundColor: primaryColor }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Save changes
          </button>
        </div>

        {/* Badges + link */}
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Badges & link
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold"
              style={{
                color: primaryColor,
                backgroundColor: `${primaryColor}1A`,
              }}
            >
              ADMIN
            </span>
            <span
              className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold"
              style={{
                color: accentColor,
                backgroundColor: `${accentColor}1A`,
              }}
            >
              DONE
            </span>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="text-xs font-semibold underline"
              style={{ color: primaryColor }}
            >
              View details →
            </a>
          </div>
        </div>

        {/* Progress bar */}
        <div className="sm:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Progress bar
            </p>
            <span className="text-xs font-bold tabular-nums text-foreground">
              68%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{
                background: `linear-gradient(90deg, ${primaryColor}, ${accentColor})`,
                width: '68%',
              }}
            />
          </div>
        </div>
      </div>
    </Card>
  )
}
