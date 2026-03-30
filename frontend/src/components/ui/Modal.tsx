'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({ isOpen, onClose, title, children, className, size = 'md' }: ModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen || !mounted) return null

  const modal = (
    <div className="fixed inset-0 z-[9998] overflow-y-auto" onClick={onClose}>
      <div className="min-h-full flex items-center justify-center py-8 px-4">
        <div
          onClick={(e) => e.stopPropagation()}
          className={clsx(
            'relative w-full rounded-2xl bg-white',
            'flex flex-col',
            'shadow-[0_25px_60px_-12px_rgba(0,0,0,0.15),0_10px_30px_-8px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.04)]',
            'animate-fade-in-scale',
            sizeClasses[size],
            className
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
            <h2 id="modal-title" className="text-base font-bold text-gray-900">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Close modal"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="px-6 py-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
