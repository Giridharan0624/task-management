'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

type ToastType = 'success' | 'error' | 'info'

interface ToastAction {
  label: string
  onClick: () => void
}

interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
  action?: ToastAction
}

interface ToastOptions {
  duration?: number
  action?: ToastAction
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, options?: ToastOptions) => void
  success: (message: string, options?: ToastOptions) => void
  error: (message: string, options?: ToastOptions) => void
  info: (message: string, options?: ToastOptions) => void
  /** Convenience — shows a success toast with an Undo action. Returns
   *  the toast id in case the caller wants to dismiss it early. */
  undoable: (message: string, onUndo: () => void, options?: { duration?: number; label?: string }) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [mounted, setMounted] = useState(false)
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => { setMounted(true) }, [])

  const clearTimer = useCallback((id: string) => {
    const t = timersRef.current.get(id)
    if (t) {
      clearTimeout(t)
      timersRef.current.delete(id)
    }
  }, [])

  const removeToast = useCallback((id: string) => {
    clearTimer(id)
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [clearTimer])

  const addToast = useCallback(
    (message: string, type: ToastType = 'info', options?: ToastOptions) => {
      const id = `${Date.now()}-${Math.random()}`
      const duration = options?.duration ?? (type === 'error' ? 5000 : 3000)
      setToasts(prev => [...prev, { id, message, type, duration, action: options?.action }])
      if (duration > 0) {
        const timer = setTimeout(() => removeToast(id), duration)
        timersRef.current.set(id, timer)
      }
      return id
    },
    [removeToast]
  )

  const undoable = useCallback(
    (message: string, onUndo: () => void, options?: { duration?: number; label?: string }) => {
      const duration = options?.duration ?? 6000
      const label = options?.label ?? 'Undo'
      // Capture id after add so we can dismiss on action click.
      let capturedId: string | null = null
      const id = addToast(message, 'success', {
        duration,
        action: {
          label,
          onClick: () => {
            onUndo()
            if (capturedId) removeToast(capturedId)
          },
        },
      })
      capturedId = id
      return id
    },
    [addToast, removeToast]
  )

  const value: ToastContextValue = {
    toast: addToast,
    success: (msg, options) => addToast(msg, 'success', options),
    error: (msg, options) => addToast(msg, 'error', options),
    info: (msg, options) => addToast(msg, 'info', options),
    undoable,
    dismiss: removeToast,
  }

  useEffect(() => {
    const map = timersRef.current
    return () => {
      for (const t of map.values()) clearTimeout(t)
      map.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted && createPortal(
        <div
          role="region"
          aria-label="Notifications"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-[99999] flex flex-col gap-2 pointer-events-none"
        >
          {toasts.map(t => (
            <ToastItem key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const icons: Record<ToastType, React.ReactNode> = {
    success: <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
    error: <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
    info: <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  }
  const bg: Record<ToastType, string> = {
    success: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20',
    error: 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20',
    info: 'bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20',
  }

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm animate-fade-in-scale min-w-[280px] max-w-[420px] ${bg[toast.type]}`}
      style={{ animationDuration: '0.2s' }}
    >
      {icons[toast.type]}
      <p className="text-[13px] font-medium text-foreground/95 dark:text-gray-200 flex-1">{toast.message}</p>
      {toast.action && (
        <button
          onClick={toast.action.onClick}
          className="rounded-md px-2 py-1 text-[12px] font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="text-muted-foreground/70 hover:text-muted-foreground dark:hover:text-muted-foreground/50 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  )
}
