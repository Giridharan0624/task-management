'use client'

import { useCallback, useState } from 'react'
import {
  validateForm,
  type ValidationRules,
  type ValidationErrors,
} from '@/lib/utils/validators'

/**
 * Lightweight form-error state container. Pairs with the `validators.ts`
 * helpers — pass a rules map, get back `{ errors, validate, clear, setError }`
 * to wire into Input components via the `error` prop.
 *
 * Pattern:
 *   const { errors, validate, clear } = useFormErrors({
 *     email: compose(required(), email()),
 *     password: compose(required(), minLength(8)),
 *   })
 *
 *   const handleSubmit = (e: React.FormEvent) => {
 *     e.preventDefault()
 *     if (!validate({ email, password })) return  // blocks on bad input
 *     // ...submit...
 *   }
 *
 *   <Input
 *     label="Email"
 *     value={email}
 *     onChange={(e) => { setEmail(e.target.value); clear('email') }}
 *     error={errors.email}
 *   />
 *
 * Why custom (not react-hook-form): forms in this app are small (3-8
 * fields), so the extra dependency, controller boilerplate, and
 * register-vs-controlled split aren't worth it. This 30-line hook
 * covers what we need with zero deps and full Tailwind/aria control.
 */
export function useFormErrors<T extends Record<string, unknown>>(
  rules: ValidationRules<T>,
) {
  const [errors, setErrors] = useState<ValidationErrors<T>>({})

  /** Run all rules over `values`. Returns true when valid (no errors). */
  const validate = useCallback(
    (values: T): boolean => {
      const next = validateForm(values, rules)
      setErrors(next)
      return Object.keys(next).length === 0
    },
    [rules],
  )

  /** Clear an individual field's error — use on `onChange` so the message
   *  disappears the moment the user starts fixing the field. */
  const clear = useCallback((field: keyof T) => {
    setErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  /** Manually set an error (e.g. server-side validation rejection). */
  const setError = useCallback((field: keyof T, message: string | null) => {
    setErrors((prev) => {
      const next = { ...prev }
      if (message == null) delete next[field]
      else next[field] = message
      return next
    })
  }, [])

  /** Reset all errors. Useful on form re-open (Dialog close → re-open). */
  const reset = useCallback(() => setErrors({}), [])

  return { errors, validate, clear, setError, reset }
}
