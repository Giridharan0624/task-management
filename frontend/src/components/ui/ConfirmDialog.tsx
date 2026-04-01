'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx.confirm
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    options: ConfirmOptions
    resolve: (value: boolean) => void
  } | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>(resolve => {
      setState({ options, resolve })
    })
  }, [])

  const handleConfirm = () => {
    state?.resolve(true)
    setState(null)
  }

  const handleCancel = () => {
    state?.resolve(false)
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4" onClick={handleCancel}>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          <div onClick={e => e.stopPropagation()}
            className="relative bg-white dark:bg-[#191b24] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700/50 w-full max-w-sm p-6 animate-fade-in-scale"
            style={{ animationDuration: '0.15s' }}>
            <h3 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">{state.options.title}</h3>
            {state.options.description && (
              <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">{state.options.description}</p>
            )}
            <div className="flex items-center justify-end gap-2 mt-5">
              <Button variant="secondary" size="sm" onClick={handleCancel}>
                {state.options.cancelLabel || 'Cancel'}
              </Button>
              <Button variant={state.options.variant || 'danger'} size="sm" onClick={handleConfirm}>
                {state.options.confirmLabel || 'Confirm'}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </ConfirmContext.Provider>
  )
}
