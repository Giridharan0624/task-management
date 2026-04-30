'use client'

import { useState } from 'react'

import type { ConnectFormSchema } from '@/lib/api/integrationsApi'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'

export interface DynamicConnectFormProps {
  schema: ConnectFormSchema
  isSubmitting?: boolean
  errorMessage?: string | null
  onSubmit: (formValues: Record<string, string>) => void
}

/**
 * Renders a connector's connect_form_schema as a real form. Adding a new
 * connector with a new field shape (e.g. a Slack workspace dropdown) shows
 * up here with no frontend code change unless it needs a custom widget.
 */
export function DynamicConnectForm({
  schema,
  isSubmitting,
  errorMessage,
  onSubmit,
}: DynamicConnectFormProps) {
  const initial = Object.fromEntries(
    schema.fields.map((f) => [f.name, f.default ?? '']),
  )
  const [values, setValues] = useState<Record<string, string>>(initial)

  function update(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(values)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {schema.description && (
        <p className="text-sm text-gray-600">{schema.description}</p>
      )}

      {schema.fields.map((field) => (
        <div key={field.name} className="space-y-1">
          <Label htmlFor={field.name}>
            {field.label}
            {field.required && <span className="ml-1 text-red-500">*</span>}
          </Label>
          {field.type === 'select' ? (
            <select
              id={field.name}
              value={values[field.name] ?? ''}
              onChange={(e) => update(field.name, e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required={field.required}
            >
              {(field.options ?? []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id={field.name}
              type={field.type === 'password' ? 'password' : 'text'}
              value={values[field.name] ?? ''}
              onChange={(e) => update(field.name, e.target.value)}
              placeholder={field.placeholder}
              required={field.required}
              autoComplete={field.secret ? 'off' : undefined}
            />
          )}
          {field.help && (
            <p className="text-xs text-gray-500">{field.help}</p>
          )}
        </div>
      ))}

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Connecting…' : 'Connect'}
      </Button>
    </form>
  )
}
