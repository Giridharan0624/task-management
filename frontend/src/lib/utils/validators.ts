/**
 * Composable form-field validators.
 *
 * Each validator is a pure function `(value, context?) => string | null`.
 * `null` means "no error", a string is the error message to show under the
 * field. Validators chain via `compose(...validators)` — the first one
 * that returns a non-null message wins. Keep messages short and second-
 * person ("Pick a date", not "The date field is required").
 *
 * Usage:
 *   const validateEmail = compose(required('Email is required'), email())
 *   const error = validateEmail(value)
 *
 *   // Or, for whole-form validation:
 *   const errors = validateForm(values, {
 *     email: compose(required(), email()),
 *     password: compose(required(), minLength(8)),
 *   })
 */

export type Validator<TContext = unknown> = (
  value: string,
  context?: TContext,
) => string | null

/** Chain validators left-to-right. First non-null message wins. */
export function compose<TContext = unknown>(
  ...validators: Validator<TContext>[]
): Validator<TContext> {
  return (value, context) => {
    for (const v of validators) {
      const err = v(value, context)
      if (err) return err
    }
    return null
  }
}

/* ─────────────────────────────────────────────────────────────────
 * Primitives
 * ───────────────────────────────────────────────────────────────── */

export const required =
  (message = 'This field is required'): Validator =>
  (value) => {
    if (typeof value === 'string' ? value.trim().length === 0 : !value) {
      return message
    }
    return null
  }

export const minLength =
  (n: number, message?: string): Validator =>
  (value) => {
    if (!value) return null // pair with `required` if the field is mandatory
    if (value.length < n) {
      return message ?? `Must be at least ${n} character${n === 1 ? '' : 's'}`
    }
    return null
  }

export const maxLength =
  (n: number, message?: string): Validator =>
  (value) => {
    if (!value) return null
    if (value.length > n) {
      return message ?? `Must be at most ${n} character${n === 1 ? '' : 's'}`
    }
    return null
  }

/* ─────────────────────────────────────────────────────────────────
 * Format validators
 * ───────────────────────────────────────────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const email =
  (message = 'Enter a valid email address'): Validator =>
  (value) => {
    if (!value) return null
    return EMAIL_RE.test(value) ? null : message
  }

const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i

export const url =
  (message = 'Enter a valid URL (https://…)'): Validator =>
  (value) => {
    if (!value) return null
    return URL_RE.test(value) ? null : message
  }

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

export const hexColor =
  (message = 'Use a hex color like #4F46E5'): Validator =>
  (value) => {
    if (!value) return null
    return HEX_RE.test(value) ? null : message
  }

/** HH:MM in 24-hour form. Used by working-hours pickers. */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export const time =
  (message = 'Use HH:MM (24-hour)'): Validator =>
  (value) => {
    if (!value) return null
    return TIME_RE.test(value) ? null : message
  }

/** YYYY-MM-DD (ISO date-only). Accepts the date portion of a longer ISO string. */
const DATE_RE = /^\d{4}-\d{2}-\d{2}/

export const isoDate =
  (message = 'Pick a valid date'): Validator =>
  (value) => {
    if (!value) return null
    if (!DATE_RE.test(value)) return message
    const d = new Date(value.slice(0, 10))
    return Number.isNaN(d.getTime()) ? message : null
  }

/** Slug — lowercase letters, digits, single hyphens. Used for workspace codes. */
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

export const slug =
  (
    message = 'Use lowercase letters, digits, and single hyphens',
  ): Validator =>
  (value) => {
    if (!value) return null
    return SLUG_RE.test(value) ? null : message
  }

/* ─────────────────────────────────────────────────────────────────
 * Numeric
 * ───────────────────────────────────────────────────────────────── */

export const numeric =
  (message = 'Must be a number'): Validator =>
  (value) => {
    if (!value) return null
    return Number.isFinite(Number(value)) ? null : message
  }

export const min =
  (n: number, message?: string): Validator =>
  (value) => {
    if (!value) return null
    const num = Number(value)
    if (!Number.isFinite(num)) return null
    return num < n ? (message ?? `Must be at least ${n}`) : null
  }

export const max =
  (n: number, message?: string): Validator =>
  (value) => {
    if (!value) return null
    const num = Number(value)
    if (!Number.isFinite(num)) return null
    return num > n ? (message ?? `Must be at most ${n}`) : null
  }

/* ─────────────────────────────────────────────────────────────────
 * Whole-form helpers
 * ───────────────────────────────────────────────────────────────── */

export type ValidationRules<T extends Record<string, unknown>> = {
  [K in keyof T]?: Validator<T>
}

export type ValidationErrors<T> = Partial<Record<keyof T, string>>

/**
 * Run a rules map against a values object. Returns a record of
 * `{ field: errorMessage }` for fields that failed; the result is
 * `{}` when everything is valid.
 *
 * Usage:
 *   const errors = validateForm(values, {
 *     email: compose(required(), email()),
 *     password: compose(required(), minLength(8)),
 *   })
 *   if (Object.keys(errors).length > 0) return errors  // block submit
 */
export function validateForm<T extends Record<string, unknown>>(
  values: T,
  rules: ValidationRules<T>,
): ValidationErrors<T> {
  const out: ValidationErrors<T> = {}
  for (const key of Object.keys(rules) as (keyof T)[]) {
    const validator = rules[key]
    if (!validator) continue
    const value = values[key]
    const err = validator(value == null ? '' : String(value), values)
    if (err) out[key] = err
  }
  return out
}
