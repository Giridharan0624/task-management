'use client'

import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverAnchor = PopoverPrimitive.Anchor

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 6, onWheel, onTouchMove, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      // When this popover is opened inside a modal Dialog, Radix's
      // react-remove-scroll lock attaches a non-passive `wheel`/`touchmove`
      // listener on `document` that blocks scrolling outside the dialog's
      // subtree. This content is Portal'd to <body> — outside that subtree —
      // so any internal scroll area (e.g. a long user list) can't scroll.
      // Stopping propagation here keeps the event from ever reaching that
      // document-level blocker, so native scrolling works. Harmless outside
      // a dialog (a popover should never scroll the background anyway).
      onWheel={(e) => { e.stopPropagation(); onWheel?.(e) }}
      onTouchMove={(e) => { e.stopPropagation(); onTouchMove?.(e) }}
      className={cn(
        'z-[9999] w-72 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-elevated outline-none',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
