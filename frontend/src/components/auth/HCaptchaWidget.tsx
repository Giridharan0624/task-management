'use client'

import { useEffect, useId, useRef, useState } from 'react'

/**
 * Thin wrapper around hCaptcha's invisible + visible widget.
 *
 * No-op when NEXT_PUBLIC_HCAPTCHA_SITE_KEY is unset — the parent form
 * just doesn't include a token on submit, and the backend skips
 * verification (HCAPTCHA_SECRET also unset in the same environment).
 * This keeps local and staging frictionless while prod gets the check.
 *
 * We load the hCaptcha script on first render and render the widget
 * once. `onVerify` fires with the token string; `onExpire` nulls it so
 * the form can re-disable submit.
 */
interface HCaptchaWidgetProps {
  onVerify: (token: string) => void
  onExpire?: () => void
}

declare global {
  interface Window {
    hcaptcha?: {
      render: (
        container: HTMLElement,
        opts: {
          sitekey: string
          callback?: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
          theme?: 'light' | 'dark'
          size?: 'normal' | 'compact'
        },
      ) => string
      reset: (widgetId?: string) => void
    }
    hcaptchaOnLoad?: () => void
  }
}

const SCRIPT_SRC = 'https://js.hcaptcha.com/1/api.js?onload=hcaptchaOnLoad&render=explicit'

export function HCaptchaWidget({ onVerify, onExpire }: HCaptchaWidgetProps) {
  const sitekey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ?? ''
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const containerId = useId()

  useEffect(() => {
    if (!sitekey) return
    if (widgetIdRef.current !== null) return

    const renderWidget = () => {
      if (!window.hcaptcha || !containerRef.current) return
      widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
        sitekey,
        callback: (token: string) => onVerify(token),
        'expired-callback': () => onExpire?.(),
        'error-callback': () => setLoadError(true),
      })
    }

    // Already loaded — render directly.
    if (window.hcaptcha) {
      renderWidget()
      return
    }

    // Stash a load callback for the script's ?onload= parameter.
    const prev = window.hcaptchaOnLoad
    window.hcaptchaOnLoad = () => {
      prev?.()
      renderWidget()
    }

    // Inject once — guard against StrictMode double-mount.
    const existing = document.querySelector(`script[src^="${SCRIPT_SRC}"]`)
    if (!existing) {
      const s = document.createElement('script')
      s.src = SCRIPT_SRC
      s.async = true
      s.defer = true
      s.onerror = () => setLoadError(true)
      document.head.appendChild(s)
    }
  }, [sitekey, onVerify, onExpire])

  if (!sitekey) return null

  if (loadError) {
    return (
      <p className="text-[11px] text-destructive">
        Couldn&apos;t load captcha. Check your network and refresh.
      </p>
    )
  }

  return <div ref={containerRef} id={containerId} className="min-h-[78px]" />
}
