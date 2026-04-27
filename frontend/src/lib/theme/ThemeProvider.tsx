'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null
    if (stored === 'dark' || stored === 'light') {
      setThemeState(stored)
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)

    // Re-apply the active workspace theme preset so the right palette
    // half (light vs dark) takes over. `applyThemePreset` reads the
    // `dark` class we just toggled — the import is dynamic to avoid a
    // circular dep with TenantProvider, and `data-theme` is the source
    // of truth for which preset is active. Falls back to "slate" if no
    // preset has been applied yet (first render before TenantProvider
    // hydrates settings).
    void import('@/lib/tenant/theme').then(({ applyThemePreset }) => {
      const activeTheme =
        root.getAttribute('data-theme') ?? 'slate'
      applyThemePreset(activeTheme)
    })
  }, [theme, mounted])

  const toggleTheme = () => setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'))
  const setTheme = (t: Theme) => setThemeState(t)

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
