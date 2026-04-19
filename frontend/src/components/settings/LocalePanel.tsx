'use client'

import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

export interface LocaleState {
  timezone: string
  locale: string
  currency: string
  weekStartDay: number
  workingHoursStart: string
  workingHoursEnd: string
}

interface LocalePanelProps {
  value: LocaleState
  onChange: (next: LocaleState) => void
}

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New_York (ET)' },
  { value: 'America/Chicago', label: 'America/Chicago (CT)' },
  { value: 'America/Denver', label: 'America/Denver (MT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PT)' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'Europe/Paris', label: 'Europe/Paris' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney' },
]

const LOCALE_OPTIONS = [
  { value: 'en-IN', label: 'English (India)' },
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'en-AU', label: 'English (Australia)' },
  { value: 'fr-FR', label: 'French (France)' },
  { value: 'de-DE', label: 'German (Germany)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'ja-JP', label: 'Japanese (Japan)' },
]

const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR (₹)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'AUD', label: 'AUD (A$)' },
  { value: 'JPY', label: 'JPY (¥)' },
  { value: 'SGD', label: 'SGD (S$)' },
  { value: 'AED', label: 'AED (د.إ)' },
]

const WEEK_START_OPTIONS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '6', label: 'Saturday' },
]

export function LocalePanel({ value, onChange }: LocalePanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Region, calendar, and working-hour defaults for everyone in your
        workspace.
      </p>

      <Card className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-foreground/85">
            Timezone
          </label>
          <Select
            options={TIMEZONE_OPTIONS}
            value={value.timezone}
            onChange={(v) => onChange({ ...value, timezone: v })}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Used for attendance, reports, and scheduled jobs.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-foreground/85">
            Locale
          </label>
          <Select
            options={LOCALE_OPTIONS}
            value={value.locale}
            onChange={(v) => onChange({ ...value, locale: v })}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Date and number formatting.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-foreground/85">
            Currency
          </label>
          <Select
            options={CURRENCY_OPTIONS}
            value={value.currency}
            onChange={(v) => onChange({ ...value, currency: v })}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-foreground/85">
            Week starts on
          </label>
          <Select
            options={WEEK_START_OPTIONS}
            value={String(value.weekStartDay)}
            onChange={(v) => onChange({ ...value, weekStartDay: Number(v) })}
          />
        </div>

        <Input
          label="Working hours start"
          type="time"
          value={value.workingHoursStart}
          onChange={(e) =>
            onChange({ ...value, workingHoursStart: e.target.value })
          }
        />

        <Input
          label="Working hours end"
          type="time"
          value={value.workingHoursEnd}
          onChange={(e) =>
            onChange({ ...value, workingHoursEnd: e.target.value })
          }
        />
      </Card>
    </div>
  )
}
