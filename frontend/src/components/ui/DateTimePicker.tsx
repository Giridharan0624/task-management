'use client'

import { DatePicker } from './DatePicker'
import { TimePicker } from './TimePicker'

interface DateTimePickerProps {
  value: string // "YYYY-MM-DDTHH:mm" format
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function DateTimePicker({ value, onChange, placeholder = 'Select date & time', className }: DateTimePickerProps) {
  const datePart = value ? value.slice(0, 10) : ''
  const timePart = value ? value.slice(11, 16) : ''

  const handleDateChange = (d: string) => {
    const t = timePart || '09:00'
    onChange(d ? `${d}T${t}` : '')
  }

  const handleTimeChange = (t: string) => {
    if (datePart) {
      onChange(`${datePart}T${t}`)
    }
  }

  return (
    <div className={`flex items-start gap-3 ${className || ''}`}>
      <div className="flex-1">
        <DatePicker value={datePart} onChange={handleDateChange} placeholder={placeholder} />
      </div>
      <div className="flex-1">
        <TimePicker value={timePart} onChange={handleTimeChange} placeholder="Set time" />
      </div>
    </div>
  )
}
