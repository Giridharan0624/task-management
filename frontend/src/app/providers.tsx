'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { AuthProvider } from '@/lib/auth/AuthProvider'
import { TenantProvider } from '@/lib/tenant/TenantProvider'
import { ThemeProvider } from '@/lib/theme/ThemeProvider'
import { ToastProvider } from '@/components/ui/Toast'
import { ConfirmProvider } from '@/components/ui/ConfirmDialog'

export function Providers({ children }: { children: React.ReactNode }) {
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
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TenantProvider>
          <AuthProvider><ToastProvider><ConfirmProvider>{children}</ConfirmProvider></ToastProvider></AuthProvider>
        </TenantProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
