'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

type Phase = 'idle' | 'dragging' | 'split' | 'celebration'

interface BirthdayCakeCutProps {
  name: string
  onComplete: () => void
  onClose: () => void
}

const COMPLETE_THRESHOLD = 80 // Knife must reach 80% of cake width to complete cut

function ConfettiBurst() {
  const colors = ['#f472b6', '#ec4899', '#a78bfa', '#8b5cf6', '#60a5fa', '#3b82f6', '#34d399', '#10b981', '#fbbf24', '#f59e0b', '#fb923c', '#f87171', '#ef4444']
  const shapes: ('square' | 'circle' | 'star' | 'streamer')[] = ['square', 'circle', 'square', 'circle', 'star', 'streamer']

  const particles = Array.from({ length: 60 }, (_, i) => {
    const angle = (i / 60) * 2 * Math.PI + (Math.random() - 0.5) * 0.4
    const distance = 100 + Math.random() * 120
    const dx = Math.cos(angle) * distance
    const dy = Math.sin(angle) * distance
    const color = colors[Math.floor(Math.random() * colors.length)]
    const size = 5 + Math.random() * 8
    const shape = shapes[Math.floor(Math.random() * shapes.length)]
    const rotation = Math.random() * 720
    return { i, dx, dy, color, size, delay: Math.random() * 0.15, shape, rotation }
  })

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50">
      {particles.map(p => {
        const baseStyle: React.CSSProperties = {
          width: `${p.size}px`,
          height: `${p.size}px`,
          backgroundColor: p.color,
          ['--dx' as any]: `${p.dx}px`,
          ['--dy' as any]: `${p.dy}px`,
          ['--rot' as any]: `${p.rotation}deg`,
          animationDelay: `${p.delay}s`,
        }

        if (p.shape === 'circle') {
          return <div key={p.i} className="absolute rounded-full animate-confetti-burst shadow-sm" style={baseStyle} />
        }
        if (p.shape === 'star') {
          return (
            <div key={p.i} className="absolute animate-confetti-burst" style={{
              ...baseStyle,
              width: `${p.size + 4}px`,
              height: `${p.size + 4}px`,
              clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
            }} />
          )
        }
        if (p.shape === 'streamer') {
          return <div key={p.i} className="absolute animate-confetti-burst rounded-full" style={{
            ...baseStyle,
            width: '3px',
            height: `${p.size + 10}px`,
          }} />
        }
        return <div key={p.i} className="absolute rounded-sm animate-confetti-burst shadow-sm" style={baseStyle} />
      })}
    </div>
  )
}

export function BirthdayCakeCut({ name, onComplete, onClose }: BirthdayCakeCutProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [knifeY, setKnifeY] = useState(0) // 0-100 percent from top
  const cakeRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)

  const handlePointerDown = (e: React.PointerEvent) => {
    if (phase !== 'idle' && phase !== 'dragging') return
    e.preventDefault()
    isDraggingRef.current = true
    setPhase('dragging')
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const handlePointerUp = useCallback(() => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false

    setKnifeY(prev => {
      if (prev >= COMPLETE_THRESHOLD) {
        // Trigger cut
        setPhase('split')
        setTimeout(() => setPhase('celebration'), 700)
        return prev
      } else {
        // Snap back
        setPhase('idle')
        return 0
      }
    })
  }, [])

  // Global pointer listeners to handle drag outside the knife
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!isDraggingRef.current || !cakeRef.current) return
      const rect = cakeRef.current.getBoundingClientRect()
      const y = e.clientY - rect.top
      const pct = Math.max(0, Math.min(100, (y / rect.height) * 100))
      setKnifeY(pct)
    }
    const up = () => handlePointerUp()
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [handlePointerUp])

  // Escape key to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'split') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, phase])

  const isSplit = phase === 'split' || phase === 'celebration'
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center animate-backdrop-fade">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={phase === 'idle' ? onClose : undefined} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-2xl max-w-md w-[90%] mx-4 animate-modal-pop">
        {/* Close button */}
        {phase === 'idle' && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}

        {/* Title */}
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">🎉 It&apos;s Your Birthday!</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {phase === 'celebration' ? 'Enjoy your special day!' : 'Drag the knife down to slice the cake'}
          </p>
        </div>

        {/* Cake area — top portion reserved for knife, cake at bottom */}
        <div
          className="relative mx-auto max-w-[340px] select-none touch-none"
          style={{ userSelect: 'none', height: '300px' }}
        >
          {/* Decorative plate */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[110%] h-4 rounded-full bg-gradient-to-b from-gray-200 via-white to-gray-300 dark:from-gray-600 dark:via-gray-500 dark:to-gray-700 shadow-xl z-0" />
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[105%] h-2 rounded-full bg-gradient-to-b from-gray-100 to-gray-300 dark:from-gray-500 dark:to-gray-700 z-0" />

          {/* Cake container — draggable region */}
          <div
            ref={cakeRef}
            className="absolute inset-x-0 bottom-4 h-44 flex items-end justify-center"
          >
            {/* Cake body — two halves */}
            <div className="relative w-full max-w-[280px] h-full">
              {/* Left half */}
              <div
                className={`absolute left-0 top-0 w-1/2 h-full origin-right ${isSplit ? 'animate-cake-split-left' : ''} ${phase === 'idle' ? 'animate-cake-bounce' : ''}`}
              >
                <CakeHalf side="left" />
              </div>
              {/* Right half */}
              <div
                className={`absolute right-0 top-0 w-1/2 h-full origin-left ${isSplit ? 'animate-cake-split-right' : ''} ${phase === 'idle' ? 'animate-cake-bounce' : ''}`}
              >
                <CakeHalf side="right" />
              </div>

              {/* Cut line (glowing vertical line down the middle) */}
              {phase === 'dragging' && (
                <div
                  className="absolute left-1/2 top-0 w-[3px] -translate-x-1/2 bg-gradient-to-b from-white via-white to-white/40 pointer-events-none shadow-[0_0_12px_rgba(255,255,255,1)] z-30"
                  style={{ height: `${knifeY}%` }}
                />
              )}

              {/* Knife — positioned relative to cake container, drags from top to bottom */}
              {!isSplit && (
                <div
                  onPointerDown={handlePointerDown}
                  className="absolute left-1/2 cursor-grab active:cursor-grabbing transition-none z-40"
                  style={{
                    top: `${knifeY}%`,
                    transform: 'translate(-50%, -85%)',
                  }}
                >
                  <Knife />
                </div>
              )}
            </div>
          </div>

          {/* Confetti burst on celebration */}
          {phase === 'celebration' && <ConfettiBurst />}
        </div>

        {/* Prompt or Greeting */}
        <div className="text-center mt-6 min-h-[60px]">
          {phase === 'idle' && (
            <p className="text-sm font-semibold text-pink-500 dark:text-pink-400 animate-pulse-prompt">
              👇 Drag the knife down to cut your cake!
            </p>
          )}
          {phase === 'dragging' && (
            <p className="text-sm font-semibold text-indigo-500 dark:text-indigo-400">
              {knifeY < COMPLETE_THRESHOLD ? `Cutting... ${Math.round(knifeY)}%` : 'Almost there!'}
            </p>
          )}
          {phase === 'split' && (
            <p className="text-sm font-semibold text-gray-500">Cutting...</p>
          )}
          {phase === 'celebration' && (
            <div className="animate-text-reveal">
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Happy Birthday, {name}! 🎂
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Wishing you a wonderful year ahead!
              </p>
              <button
                onClick={onComplete}
                className="mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all"
              >
                Thank You! 🎉
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ─── Cake Half Component ─── */
function CakeHalf({ side }: { side: 'left' | 'right' }) {
  const roundedCls = side === 'left' ? 'rounded-l-[20px]' : 'rounded-r-[20px]'
  const shadowSide = side === 'left' ? 'shadow-[inset_-8px_0_12px_-8px_rgba(0,0,0,0.2)]' : 'shadow-[inset_8px_0_12px_-8px_rgba(0,0,0,0.2)]'

  return (
    <div className={`relative w-full h-full ${roundedCls} overflow-hidden drop-shadow-2xl ${shadowSide}`}>
      {/* ═══ FROSTING TOP with drips ═══ */}
      <div className="absolute top-0 left-0 right-0 h-8 z-10">
        {/* Main pink frosting body */}
        <div className="absolute inset-0 bg-gradient-to-b from-pink-300 via-pink-400 to-pink-500 dark:from-pink-400 dark:via-pink-500 dark:to-pink-600" />
        {/* Highlight shine */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-b from-white/40 to-transparent" />
        {/* Dripping edges (scalloped bottom) */}
        <div
          className="absolute -bottom-2 left-0 right-0 h-3 bg-gradient-to-b from-pink-400 to-pink-500 dark:from-pink-500 dark:to-pink-600"
          style={{
            maskImage: 'radial-gradient(ellipse 14px 10px at 14px 0%, black 99%, transparent 100%)',
            maskSize: '28px 100%',
            maskRepeat: 'repeat-x',
            WebkitMaskImage: 'radial-gradient(ellipse 14px 10px at 14px 0%, black 99%, transparent 100%)',
            WebkitMaskSize: '28px 100%',
            WebkitMaskRepeat: 'repeat-x',
          }}
        />
      </div>

      {/* ═══ SPRINKLES on frosting ═══ */}
      <div className="absolute top-1 left-0 right-0 h-6 z-20 pointer-events-none">
        <div className="absolute top-1 left-[15%] w-1 h-2 bg-yellow-300 rounded-full rotate-12" />
        <div className="absolute top-2 left-[30%] w-1 h-2 bg-blue-400 rounded-full -rotate-45" />
        <div className="absolute top-1 left-[45%] w-1 h-2 bg-green-400 rounded-full rotate-45" />
        <div className="absolute top-3 left-[60%] w-1 h-2 bg-red-400 rounded-full rotate-12" />
        <div className="absolute top-1 left-[75%] w-1 h-2 bg-purple-400 rounded-full -rotate-12" />
        <div className="absolute top-2 left-[85%] w-1 h-2 bg-orange-400 rounded-full rotate-45" />
      </div>

      {/* ═══ CAKE LAYERS (cross-section view) ═══ */}
      {/* Top chocolate sponge */}
      <div className="absolute top-10 left-0 right-0 h-5 bg-gradient-to-b from-amber-700 via-amber-800 to-amber-900 dark:from-amber-800 dark:via-amber-900 dark:to-stone-900">
        {/* Texture dots */}
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: 'radial-gradient(circle at 20% 30%, #000 1px, transparent 1.5px), radial-gradient(circle at 60% 60%, #000 1px, transparent 1.5px), radial-gradient(circle at 80% 20%, #000 1px, transparent 1.5px)',
          backgroundSize: '12px 12px',
        }} />
      </div>

      {/* Cream filling 1 */}
      <div className="absolute top-[60px] left-0 right-0 h-2 bg-gradient-to-b from-amber-50 via-white to-amber-100 dark:from-amber-100 dark:via-amber-50 dark:to-amber-200 shadow-sm" />

      {/* Middle vanilla sponge */}
      <div className="absolute top-[68px] left-0 right-0 h-6 bg-gradient-to-b from-amber-100 via-amber-200 to-amber-300 dark:from-amber-300 dark:via-amber-400 dark:to-amber-500">
        <div className="absolute inset-0 opacity-25" style={{
          backgroundImage: 'radial-gradient(circle at 30% 40%, #7c2d12 1px, transparent 1.5px), radial-gradient(circle at 70% 70%, #7c2d12 1px, transparent 1.5px)',
          backgroundSize: '14px 14px',
        }} />
      </div>

      {/* Cream filling 2 */}
      <div className="absolute top-[92px] left-0 right-0 h-2 bg-gradient-to-b from-amber-50 via-white to-amber-100 dark:from-amber-100 dark:via-amber-50 dark:to-amber-200 shadow-sm" />

      {/* Bottom chocolate sponge */}
      <div className="absolute top-[100px] left-0 right-0 bottom-0 bg-gradient-to-b from-amber-700 via-amber-800 to-stone-900 dark:from-amber-800 dark:via-stone-800 dark:to-stone-950">
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: 'radial-gradient(circle at 25% 30%, #000 1px, transparent 1.5px), radial-gradient(circle at 65% 60%, #000 1px, transparent 1.5px), radial-gradient(circle at 40% 80%, #000 1px, transparent 1.5px)',
          backgroundSize: '14px 14px',
        }} />
      </div>

      {/* ═══ Plate/base shadow ═══ */}
      <div className="absolute -bottom-1 left-0 right-0 h-2 bg-gradient-to-t from-black/30 to-transparent" />
    </div>
  )
}

/* ─── Cherry component ─── */
function Cherry() {
  return (
    <div className="relative w-5 h-5">
      {/* Stem */}
      <div className="absolute -top-3 left-1/2 w-0.5 h-3 bg-green-700 -translate-x-1/2 rotate-12 origin-bottom" />
      {/* Leaf */}
      <div className="absolute -top-3 left-1/2 w-2 h-1 bg-green-500 rounded-full -translate-x-0 rotate-45" />
      {/* Cherry body */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-red-400 via-red-500 to-red-800 shadow-md" />
      {/* Shine */}
      <div className="absolute top-0.5 left-1 w-1.5 h-2 rounded-full bg-white/70 blur-[0.5px]" />
    </div>
  )
}

function Candle({ color }: { color: string }) {
  return (
    <div className="relative w-2">
      {/* Flame glow halo */}
      <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-yellow-300/40 blur-md animate-candle-flicker" />
      {/* Flame */}
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 animate-candle-flicker" style={{
        width: '10px',
        height: '16px',
      }}>
        {/* Outer flame (orange) */}
        <div className="absolute inset-0 bg-gradient-to-t from-orange-500 via-yellow-400 to-yellow-200" style={{
          clipPath: 'polygon(50% 0%, 85% 40%, 100% 70%, 85% 100%, 50% 90%, 15% 100%, 0% 70%, 15% 40%)',
        }} />
        {/* Inner flame (yellow/white) */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-3 bg-gradient-to-t from-yellow-200 to-white rounded-full opacity-90" />
      </div>
      {/* Wick */}
      <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-0.5 h-1 bg-gray-900" />
      {/* Candle body with stripes */}
      <div className={`relative w-2 h-10 rounded-sm shadow-md bg-gradient-to-b ${color} overflow-hidden`}>
        {/* Diagonal stripes */}
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, white 3px, white 5px)',
        }} />
        {/* Wax drip */}
        <div className="absolute -bottom-0.5 left-0 right-0 h-1 bg-white/20 rounded-full" />
      </div>
    </div>
  )
}

function Knife() {
  return (
    <div className="relative" style={{ width: '14px', height: '100px' }}>
      {/* Handle */}
      <div className="absolute top-0 left-0 w-3.5 h-8 rounded-t-md shadow-lg overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-700 via-amber-800 to-amber-950 dark:from-amber-600 dark:via-amber-700 dark:to-amber-900" />
        {/* Handle stripes */}
        <div className="absolute inset-0 opacity-40" style={{
          backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, black 2px, black 3px)',
        }} />
        {/* Handle shine */}
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-white/40 to-transparent" />
      </div>

      {/* Blade guard (small separator) */}
      <div className="absolute top-8 left-0 w-3.5 h-1 bg-gradient-to-b from-gray-500 to-gray-700 rounded-sm shadow-md" />

      {/* Blade */}
      <div
        className="absolute top-9 left-0 w-3.5 shadow-xl"
        style={{
          height: '90px',
          clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
          background: 'linear-gradient(to bottom, #d1d5db 0%, #f3f4f6 20%, #e5e7eb 50%, #9ca3af 100%)',
        }}
      >
        {/* Blade shine streak */}
        <div className="absolute top-0 left-1/2 w-0.5 h-full bg-white/60" style={{
          clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
        }} />
      </div>
    </div>
  )
}
