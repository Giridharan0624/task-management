'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { AuthProvider } from '@/lib/auth/AuthProvider'
import { TenantProvider } from '@/lib/tenant/TenantProvider'
import { TenantDocumentTitle } from '@/lib/tenant/TenantDocumentTitle'
import { ThemeProvider } from '@/lib/theme/ThemeProvider'
import { ToastProvider } from '@/components/ui/Toast'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { initSentry } from '@/lib/observability/sentry'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Fire-and-forget — no-op when DSN or @sentry/browser is absent.
    void initSentry()
  }, [])

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10 * 1000,
            refetchOnWindowFocus: true,
            refetchIntervalInBackground: false,
            retry: 1,
          },
        },
      })
  )

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TenantProvider>
            <TenantDocumentTitle />
            <AuthProvider><ToastProvider><ConfirmProvider>{children}</ConfirmProvider></ToastProvider></AuthProvider>
          </TenantProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
