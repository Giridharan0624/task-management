'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './Dialog'
import { cn } from '@/lib/utils'

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

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  className,
  size = 'md',
}: ModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          // `flex flex-col` overrides the base `grid`. `h-fit` forces
          // the modal to be exactly its content height (instead of
          // letting Radix's animations / transforms inflate it), with
          // `max-h-[90vh]` capping it on tall forms. Inner scroll is
          // handled by the body wrapper below, NOT the outer
          // container — so there can never be scrollable empty space
          // below the form's last element.
          'flex flex-col h-fit max-h-[90vh] p-0 gap-0',
          sizeClasses[size],
          className
        )}
      >
        <DialogHeader className="shrink-0 px-6 py-4 border-b border-border">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
