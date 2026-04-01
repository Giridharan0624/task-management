'use client'

import { useEffect } from 'react'

type ShortcutHandler = () => void

interface Shortcut {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  handler: ShortcutHandler
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) return

      for (const s of shortcuts) {
        const keyMatch = e.key.toLowerCase() === s.key.toLowerCase()
        const ctrlMatch = s.ctrl ? (e.ctrlKey || e.metaKey) : true
        const metaMatch = s.meta ? e.metaKey : true
        const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey

        if (keyMatch && ctrlMatch && metaMatch && shiftMatch) {
          // For Ctrl/Cmd shortcuts, always prevent default
          if (s.ctrl || s.meta) e.preventDefault()
          s.handler()
          return
        }
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [shortcuts])
}
