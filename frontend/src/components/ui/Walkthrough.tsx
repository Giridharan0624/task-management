'use client'

/**
 * Animated guided tour for first-time users.
 *
 * Replaces the previous static "card in the centre of the screen"
 * walkthrough. The new tour:
 *
 *   · paints a full-screen dim backdrop with a *spotlight cutout*
 *     punched over the element being introduced — uses a single
 *     positioned div with a giant box-shadow, which gives a perfectly
 *     animatable rectangular cutout for free
 *   · slides the spotlight between targets with a single cubic-bezier
 *     transition, so the eye is led from one feature to the next
 *     instead of being teleported
 *   · pins a glass-card tooltip beside the highlighted region (auto-
 *     flipped so it never falls off-screen)
 *   · falls back to a centred hero card for steps that don't anchor
 *     to a DOM element (welcome, finale)
 *   · explodes confetti on the final step — a small cinematic moment
 *     so finishing the tour *feels* like onboarding completed
 *
 * Mounting + persistence:
 *
 *   · mounted globally in `(dashboard)/layout.tsx`
 *   · only fires for users whose account is < 5 minutes old (true
 *     first login). Existing users with a stale localStorage key from
 *     the v1 walkthrough won't see this — they've already completed
 *     onboarding under the old design, so re-prompting would feel
 *     like a regression.
 *   · `resetWalkthrough(userId)` exported for QA / retesting.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRight,
  ArrowLeft,
  X,
  Crown,
  Palette,
  CalendarRange,
  UserPlus,
  ScrollText,
  PartyPopper,
  Flag,
  Inbox,
  FileText,
  Activity,
  Kanban,
  KeyRound,
  HandHeart,
  Compass,
  ListTodo,
  Monitor,
  PencilLine,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { updateProfile } from '@/lib/api/userApi'
import { cn } from '@/lib/utils'

interface TourStep {
  /** CSS selector to spotlight. When omitted, the tooltip renders as
   *  a centred hero card with no spotlight. */
  target?: string
  title: string
  description: string
  Icon: LucideIcon
  /** Preferred placement of the tooltip relative to the target. The
   *  layout helper auto-flips when the preferred side would clip. */
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** Spotlight outset in pixels — how much extra room around the
   *  target gets included in the cutout. Bigger for chunky elements
   *  (sidebar), smaller for buttons. */
  pad?: number
}

// ───────────────────────────────────────────────────────────────────
// Three fully independent tours. No shared step copy — every step is
// written for a specific role's reality, even when the underlying
// surface (sidebar, notifications) is the same.
//
// Length varies on purpose — owners have more first-day setup
// (8 steps), admins are mid-weight (6), members are lean (6) so the
// person who just wants to start working isn't held up.
// ───────────────────────────────────────────────────────────────────

// ───────────────────────────────────────────────────────────────────
// Three guided tours — every step (other than the welcome and finale
// hero cards) anchors to a real DOM element via `data-tour="..."`.
// The spotlight slides between targets so the user actually *sees*
// the surface being introduced, not just a description of it.
// ───────────────────────────────────────────────────────────────────

// ─── OWNER · "Set up your workspace" ───────────────────────────────
const OWNER_STEPS: TourStep[] = [
  {
    title: "Welcome, you're the owner",
    description:
      "This workspace is yours to shape. I'll spotlight each surface as we walk through — eight stops, about a minute.",
    Icon: Crown,
  },
  {
    target: '[data-tour="sidebar"]',
    title: 'Your command rail',
    description:
      'Owners see every admin surface here — Settings, Team, Reports. Members and admins see a pruned version. The active item glows in your workspace primary color.',
    Icon: KeyRound,
    placement: 'right',
    pad: 8,
  },
  {
    target: '[data-tour="nav-settings"]',
    title: 'Configure your workspace',
    description:
      "Settings is where Theme, Terminology, Leave types, Departments, Roles, Pipelines, Plan, and Audit log live. Open it now — there are five curated palettes worth picking from.",
    Icon: Palette,
    placement: 'right',
    pad: 4,
  },
  {
    target: '[data-tour="nav-admin-users"]',
    title: 'Invite & manage your team',
    description:
      "Users is your roster. Send invites by email, assign roles, edit per-user details. Custom system roles let you give an admin everything except billing — or build a Finance role with read-only access.",
    Icon: UserPlus,
    placement: 'right',
    pad: 4,
  },
  {
    target: '[data-tour="nav-day-offs"]',
    title: 'Approve leave',
    description:
      "Day Offs surfaces every pending request. Owners auto-approve their own quota; for everyone else you'll see a pending count in the sidebar badge until you act.",
    Icon: CalendarRange,
    placement: 'right',
    pad: 4,
  },
  {
    target: '[data-tour="nav-reports"]',
    title: 'Run reports',
    description:
      "Reports → Activity covers desktop sessions, keystrokes, and AI work summaries. Reports → Weekly rollup is the team digest. Reports → Plan & usage shows you against your tier.",
    Icon: ClipboardList,
    placement: 'right',
    pad: 4,
  },
  {
    target: '[data-tour="notifications"]',
    title: 'Stay on top of events',
    description:
      "Bell badges show approvals, mentions, and audit-worthy events. Owner-only events (plan upgrades, transfers, deletions) show up here too with full audit metadata.",
    Icon: ScrollText,
    placement: 'bottom',
    pad: 6,
  },
  {
    title: "You're ready to launch",
    description:
      "Your workspace is yours. Open Users and send the first invite — your team will get a tour of their own.",
    Icon: PartyPopper,
  },
]

// ─── ADMIN · "Run your team" ───────────────────────────────────────
const ADMIN_STEPS: TourStep[] = [
  {
    title: "Welcome, you're an admin",
    description:
      "You've got the keys to keep the team unblocked. Six stops on the surfaces you'll live in every day.",
    Icon: Flag,
  },
  {
    target: '[data-tour="sidebar"]',
    title: 'Your work rail',
    description:
      "Sidebar shows everything you have permission to manage — Daily updates, Users, Projects, Reports, Day Offs. Numbers next to each link are pending counts.",
    Icon: KeyRound,
    placement: 'right',
    pad: 8,
  },
  {
    target: '[data-tour="notifications"]',
    title: 'Your approvals inbox',
    description:
      "Day-off requests and update flags land on the bell first. Clearing the queue here is the single highest-leverage thing you do — members are blocked until you act.",
    Icon: Inbox,
    placement: 'bottom',
    pad: 6,
  },
  {
    target: '[data-tour="nav-task-updates"]',
    title: 'Read what your team shipped',
    description:
      "Daily updates is the end-of-day digest from every member with an active timer. Skim it nightly — it's where you spot blockers and scope creep before they become incidents.",
    Icon: FileText,
    placement: 'right',
    pad: 4,
  },
  {
    target: '[data-tour="nav-reports"]',
    title: 'See where the hours went',
    description:
      "Reports → Activity shows app usage, keystrokes, and AI work summaries from each member's desktop sessions. Reports → Weekly rollup gives you the team-level view in one screen.",
    Icon: Activity,
    placement: 'right',
    pad: 4,
  },
  {
    target: '[data-tour="nav-projects"]',
    title: 'Move tasks across the pipeline',
    description:
      "Projects + the kanban view are your assignment surface. Drag cards across columns to update status; @-mention members in comments to redirect attention without an out-of-band ping.",
    Icon: Kanban,
    placement: 'right',
    pad: 4,
  },
  {
    title: "Handing you the queue",
    description:
      "Click the bell — anything pending right now is your first move.",
    Icon: HandHeart,
  },
]

// ─── MEMBER · "Get to work" ────────────────────────────────────────
const MEMBER_STEPS: TourStep[] = [
  {
    title: 'Welcome to the team',
    description:
      "Glad you're here. I'll point at the things you'll touch every day — should take under a minute.",
    Icon: Compass,
  },
  {
    target: '[data-tour="nav-my-tasks"]',
    title: 'Your tasks, in one place',
    description:
      "My tasks pulls everything assigned to you across every project. Filter by priority or deadline; in the kanban view, drag a card across columns to update its status — no menu hunting.",
    Icon: ListTodo,
    placement: 'right',
    pad: 4,
  },
  {
    target: '[data-tour="desktop-card"]',
    title: 'Track your time, hands-free',
    description:
      "Download the desktop app from this card. Start the timer when you sit down — it captures hours, app usage, and idle gaps so you don't have to fill a timesheet at end of week.",
    Icon: Monitor,
    placement: 'right',
    pad: 6,
  },
  {
    target: '[data-tour="nav-task-updates"]',
    title: 'Wrap your day with a daily update',
    description:
      "End of day, stop the desktop timer and open Daily Updates. Your desktop session pre-fills what you worked on — confirm, add context, submit.",
    Icon: PencilLine,
    placement: 'right',
    pad: 4,
  },
  {
    target: '[data-tour="nav-day-offs"]',
    title: 'Need a day off? Just ask',
    description:
      "Day Offs has a balance widget showing what you have left for the year. Pick a leave type, dates, and a reason — your admin gets the request and either approves or rejects.",
    Icon: CalendarPlus,
    placement: 'right',
    pad: 4,
  },
  {
    target: '[data-tour="theme-toggle"]',
    title: 'Light or dark, your choice',
    description:
      "Switch your personal mode with the sun/moon icon. Your choice is local to this device. The workspace palette itself is set by the owner.",
    Icon: Palette,
    placement: 'bottom',
    pad: 6,
  },
  {
    title: "You're all set, off you go",
    description:
      "Click My Tasks in the sidebar to see what's on your plate. Welcome aboard.",
    Icon: CheckCircle2,
  },
]

/**
 * Pick a tour by the user's *system role*. Custom system roles
 * (anything outside the canonical OWNER/ADMIN/MEMBER set) fall
 * through to MEMBER — the safest default since member steps
 * never reference surfaces the user might not have access to.
 */
function pickStepsForRole(role: string | undefined): TourStep[] {
  const r = (role ?? '').toUpperCase()
  if (r === 'OWNER') return OWNER_STEPS
  if (r === 'ADMIN') return ADMIN_STEPS
  return MEMBER_STEPS
}

const STORAGE_PREFIX = 'taskflow_walkthrough_seen_'

// ───────────────────────────────────────────────────────────────────
// Public component
// ───────────────────────────────────────────────────────────────────

export function Walkthrough() {
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // First-login detection. Source of truth is the server-persisted
  // `walkthrough_seen` flag on the user record — survives across
  // browsers, devices, and incognito. localStorage is a faster
  // local-only mirror so the tour never flashes for a returning
  // user during the brief window before /users/me responds.
  useEffect(() => {
    if (!user || !mounted) return

    // Already finished/skipped on the server → never show again.
    if (user.walkthroughSeen) return

    // Local mirror — set on dismiss in this browser. Skips the tour
    // immediately on subsequent loads even before the server check
    // would have completed. Cleared if a different user logs in
    // because the key includes the userId.
    const key = STORAGE_PREFIX + user.userId
    if (localStorage.getItem(key)) return

    setVisible(true)
  }, [user, mounted])

  const dismiss = useCallback(() => {
    setVisible(false)
    if (!user) return
    // Local mirror first — instant feedback even if the API call
    // races with a navigation.
    localStorage.setItem(STORAGE_PREFIX + user.userId, 'true')
    // Persist server-side so a different browser / device / incognito
    // won't replay the tour. Best-effort; localStorage covers us if
    // the API call fails (network blip, etc.).
    void updateProfile({ walkthroughSeen: true }).catch(() => {})
  }, [user])

  // Pick the tour at render time so the role's freshest value
  // wins (e.g. an OWNER who just got their role assigned). The
  // step list is referentially stable per-role — same array each
  // render until the role changes.
  const steps = pickStepsForRole(user?.systemRole)

  // Stash steps.length in a ref so the keyboard handler can read
  // the latest count without making the dep array vary in size
  // (React rejects useEffect dep arrays whose length changes
  // between renders — keeping it at 2 elements here also avoids
  // tearing down + rebinding the listener every render).
  const stepsLenRef = useRef(steps.length)
  stepsLenRef.current = steps.length

  // Keyboard shortcuts — Escape skips, ←/→ navigates.
  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
      else if (e.key === 'ArrowRight')
        setStep((s) => Math.min(stepsLenRef.current - 1, s + 1))
      else if (e.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, dismiss])

  if (!visible || !mounted) return null

  // Defensive: if the role array is empty for any reason, dismiss
  // silently rather than render a broken tour.
  if (steps.length === 0) return null

  const current = steps[Math.min(step, steps.length - 1)]
  const isLast = step >= steps.length - 1

  const next = () => {
    if (isLast) dismiss()
    else setStep((s) => s + 1)
  }
  const prev = () => setStep((s) => Math.max(0, s - 1))

  return createPortal(
    <TourOverlay
      step={current}
      stepIndex={Math.min(step, steps.length - 1)}
      stepCount={steps.length}
      onNext={next}
      onPrev={prev}
      onSkip={dismiss}
      isLast={isLast}
    />,
    document.body,
  )
}

/** Reset the tour for QA / retesting. */
export function resetWalkthrough(userId?: string) {
  if (userId) localStorage.removeItem(STORAGE_PREFIX + userId)
}

// ───────────────────────────────────────────────────────────────────
// Overlay — backdrop + spotlight + tooltip card
// ───────────────────────────────────────────────────────────────────

interface TourOverlayProps {
  step: TourStep
  stepIndex: number
  stepCount: number
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  isLast: boolean
}

function TourOverlay({
  step,
  stepIndex,
  stepCount,
  onNext,
  onPrev,
  onSkip,
  isLast,
}: TourOverlayProps) {
  const targetRect = useTargetRect(step.target)

  // No target → centred hero card. The first/last steps use this.
  if (!step.target || !targetRect) {
    return (
      <CenteredCard
        step={step}
        stepIndex={stepIndex}
        stepCount={stepCount}
        onNext={onNext}
        onPrev={onPrev}
        onSkip={onSkip}
        isLast={isLast}
      />
    )
  }

  return (
    <SpotlightCard
      step={step}
      rect={targetRect}
      stepIndex={stepIndex}
      stepCount={stepCount}
      onNext={onNext}
      onPrev={onPrev}
      onSkip={onSkip}
      isLast={isLast}
    />
  )
}

// ───────────────────────────────────────────────────────────────────
// Centred hero card (welcome / finale / unanchored steps)
// ───────────────────────────────────────────────────────────────────

function CenteredCard({
  step,
  stepIndex,
  stepCount,
  onNext,
  onPrev,
  onSkip,
  isLast,
}: Omit<TourOverlayProps, 'step'> & { step: TourStep }) {
  const Icon = step.Icon
  return (
    <>
      <div
        className="fixed inset-0 z-[99998] bg-foreground/65 backdrop-blur-sm"
        style={{ animation: 'tour-fade-in 240ms ease-out' }}
      />
      {isLast && <Confetti />}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className="fixed left-1/2 top-1/2 z-[99999] w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4"
      >
        <div
          className="relative overflow-hidden rounded-xl border border-border/70 bg-card shadow-2xl"
          style={{ animation: 'tour-card-in 320ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          <ProgressBar stepIndex={stepIndex} stepCount={stepCount} />
          <div className="px-7 pt-7 pb-5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground tabular-nums">
                Step {stepIndex + 1} of {stepCount}
              </span>
              <button
                type="button"
                onClick={onSkip}
                className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Skip tour
              </button>
            </div>

            <div className="mt-6 flex justify-center">
              <div
                className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary',
                  isLast && 'animate-bounce-soft',
                )}
              >
                <Icon className="h-6 w-6" strokeWidth={1.6} />
              </div>
            </div>

            <h2
              id="tour-title"
              className="mt-5 text-center text-xl font-semibold tracking-tight text-foreground"
            >
              {step.title}
            </h2>
            <p className="mx-auto mt-2 max-w-[340px] text-center text-sm leading-relaxed text-muted-foreground">
              {step.description}
            </p>
          </div>

          <Footer
            stepIndex={stepIndex}
            stepCount={stepCount}
            onNext={onNext}
            onPrev={onPrev}
            onSkip={onSkip}
            isLast={isLast}
          />
        </div>
      </div>
      <TourStyles />
    </>
  )
}

// ───────────────────────────────────────────────────────────────────
// Spotlight + tooltip card (steps anchored to a DOM element)
// ───────────────────────────────────────────────────────────────────

interface DomRect {
  top: number
  left: number
  width: number
  height: number
}

function SpotlightCard({
  step,
  rect,
  stepIndex,
  stepCount,
  onNext,
  onPrev,
  onSkip,
  isLast,
}: Omit<TourOverlayProps, 'step'> & { step: TourStep; rect: DomRect }) {
  const Icon = step.Icon
  const pad = step.pad ?? 6
  const cardSize = { width: 360, height: 240 } // approximate; used for placement math
  const tooltipPos = computeTooltipPosition(
    rect,
    step.placement ?? 'bottom',
    cardSize,
    pad,
  )

  return (
    <>
      {/* Spotlight cutout — single positioned div with a giant
          box-shadow that darkens everything else on screen. Animating
          left/top/width/height crossfades the highlight between
          targets without ever showing a re-render flash. */}
      <div
        className="pointer-events-none fixed z-[99998]"
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          borderRadius: 12,
          boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.65)',
          transition:
            'top 480ms cubic-bezier(0.22, 1, 0.36, 1), left 480ms cubic-bezier(0.22, 1, 0.36, 1), width 480ms cubic-bezier(0.22, 1, 0.36, 1), height 480ms cubic-bezier(0.22, 1, 0.36, 1)',
          animation: 'tour-fade-in 240ms ease-out',
        }}
      />

      {/* A second outline that pulses around the spotlight to draw
          the eye to the active region. Pure CSS keyframe; doesn't
          fire when prefers-reduced-motion is set. */}
      <div
        aria-hidden
        className="pointer-events-none fixed z-[99998] motion-safe:animate-tour-pulse"
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          borderRadius: 12,
          border: '1.5px solid rgb(var(--color-primary) / 0.7)',
          transition:
            'top 480ms cubic-bezier(0.22, 1, 0.36, 1), left 480ms cubic-bezier(0.22, 1, 0.36, 1), width 480ms cubic-bezier(0.22, 1, 0.36, 1), height 480ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />

      {/* Click-anywhere-outside layer — separate from the cutout so
          the cutout can stay pointer-events-none without breaking
          the dismiss-on-click intent. Sits behind the spotlight but
          above the page. */}
      <div
        className="fixed inset-0 z-[99997]"
        onClick={onSkip}
        aria-hidden
      />

      {/* Tooltip card — fixed-position, translated into place. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className="fixed z-[99999] w-[min(360px,calc(100vw-2rem))]"
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
          transition:
            'top 360ms cubic-bezier(0.22, 1, 0.36, 1), left 360ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div
          className="relative overflow-hidden rounded-xl border border-border/70 bg-card shadow-2xl"
          style={{ animation: 'tour-card-in 320ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          {/* Pointer arrow — small triangle pointing back at the target */}
          <Arrow placement={tooltipPos.placement} />

          <ProgressBar stepIndex={stepIndex} stepCount={stepCount} />
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground tabular-nums">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-3 w-3" strokeWidth={2} />
                </span>
                Step {stepIndex + 1} / {stepCount}
              </span>
              <button
                type="button"
                onClick={onSkip}
                aria-label="Skip tour"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
            </div>

            <h2
              id="tour-title"
              className="mt-3 text-base font-semibold tracking-tight text-foreground"
            >
              {step.title}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              {step.description}
            </p>
          </div>

          <Footer
            stepIndex={stepIndex}
            stepCount={stepCount}
            onNext={onNext}
            onPrev={onPrev}
            onSkip={onSkip}
            isLast={isLast}
          />
        </div>
      </div>

      <TourStyles />
    </>
  )
}

// ───────────────────────────────────────────────────────────────────
// Pieces (progress bar, footer, arrow, confetti)
// ───────────────────────────────────────────────────────────────────

function ProgressBar({
  stepIndex,
  stepCount,
}: {
  stepIndex: number
  stepCount: number
}) {
  const progress = ((stepIndex + 1) / stepCount) * 100
  return (
    <div className="h-[3px] w-full bg-muted">
      <div
        className="h-full bg-primary transition-[width] duration-500 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

function Footer({
  stepIndex,
  stepCount,
  onNext,
  onPrev,
  onSkip,
  isLast,
}: {
  stepIndex: number
  stepCount: number
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  isLast: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border/60 px-5 py-3">
      <div className="flex items-center gap-3">
        {/* Step dot strip */}
        <div className="flex gap-1">
          {Array.from({ length: stepCount }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1 rounded-full transition-all duration-300',
                i === stepIndex
                  ? 'w-5 bg-primary'
                  : i < stepIndex
                    ? 'w-1.5 bg-primary/40'
                    : 'w-1.5 bg-muted-foreground/25',
              )}
            />
          ))}
        </div>
        {/* Skip button — sits beside the dot strip so it's in the
            primary-action row, not hidden in a corner. Hidden on the
            last step (no point skipping the finale). */}
        {!isLast && (
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex h-8 items-center rounded-md px-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip tour
          </button>
        )}
      </div>
      <div className="flex items-center gap-1">
        {stepIndex > 0 && (
          <button
            type="button"
            onClick={onPrev}
            className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
            Back
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {isLast ? "Let's go" : 'Next'}
          {!isLast && <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />}
        </button>
      </div>
    </div>
  )
}

function Arrow({ placement }: { placement: 'top' | 'bottom' | 'left' | 'right' }) {
  // 8x8 triangle pointing at the spotlight, painted via two stacked
  // div elements so we get a hairline border + card-fill in one tip.
  const wrap = 'absolute h-3 w-3 rotate-45'
  const map = {
    top: 'bottom-[-6px] left-1/2 -translate-x-1/2 border-b border-r border-border/70',
    bottom: 'top-[-6px] left-1/2 -translate-x-1/2 border-t border-l border-border/70',
    left: 'right-[-6px] top-1/2 -translate-y-1/2 border-r border-t border-border/70',
    right: 'left-[-6px] top-1/2 -translate-y-1/2 border-l border-b border-border/70',
  } as const
  return <div aria-hidden className={cn(wrap, 'bg-card', map[placement])} />
}

/** Lightweight CSS-keyframe confetti — no external library. 18 dots,
 *  each with its own random horizontal drift + delay. */
function Confetti() {
  const dots = Array.from({ length: 24 })
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[99998] overflow-hidden"
    >
      {dots.map((_, i) => {
        const left = (i * 4.2 + Math.random() * 6) % 100
        const delay = (i % 8) * 60 + Math.random() * 200
        const duration = 1400 + Math.random() * 800
        const colors = [
          'var(--chart-1)',
          'var(--chart-2)',
          'var(--chart-3)',
          'var(--chart-4)',
          'var(--chart-5)',
          'var(--chart-6)',
        ]
        const color = colors[i % colors.length]
        return (
          <span
            key={i}
            className="absolute -top-2 h-2.5 w-1.5 rounded-sm"
            style={{
              left: `${left}%`,
              backgroundColor: color,
              animation: `tour-confetti ${duration}ms ${delay}ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards`,
              transform: 'translateY(-20px)',
            }}
          />
        )
      })}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────
// Hooks
// ───────────────────────────────────────────────────────────────────

/** Track a target element's bounding rect, re-measuring on resize +
 *  scroll so the spotlight stays aligned even if the user pans the
 *  page while the tour is open. Returns null when the selector isn't
 *  in the DOM yet (still mounting) — caller falls back to centred. */
function useTargetRect(selector: string | undefined): DomRect | null {
  const [rect, setRect] = useState<DomRect | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!selector) {
      setRect(null)
      return
    }
    let cancelled = false

    const measure = () => {
      const el = document.querySelector(selector)
      if (!el) {
        if (!cancelled) setRect(null)
        return
      }
      const r = el.getBoundingClientRect()
      if (!cancelled) {
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
      }
    }

    // Initial measure on next paint — gives the layout a tick to settle.
    rafRef.current = requestAnimationFrame(measure)
    const onResize = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(measure)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [selector])

  return rect
}

// ───────────────────────────────────────────────────────────────────
// Tooltip placement helper
// ───────────────────────────────────────────────────────────────────

const GAP = 14

function computeTooltipPosition(
  rect: DomRect,
  preferred: 'top' | 'bottom' | 'left' | 'right',
  card: { width: number; height: number },
  pad: number,
): { top: number; left: number; placement: 'top' | 'bottom' | 'left' | 'right' } {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768

  const candidates: Array<'top' | 'bottom' | 'left' | 'right'> = [
    preferred,
    ...(['bottom', 'top', 'right', 'left'] as const).filter(
      (p) => p !== preferred,
    ),
  ]

  for (const placement of candidates) {
    const pos = positionFor(rect, placement, card, pad)
    if (
      pos.top >= 8 &&
      pos.left >= 8 &&
      pos.top + card.height <= vh - 8 &&
      pos.left + card.width <= vw - 8
    ) {
      return { ...pos, placement }
    }
  }
  // Nothing fit cleanly — fall back to preferred and clamp into the
  // viewport so the card is at least partially visible.
  const pos = positionFor(rect, preferred, card, pad)
  return {
    top: Math.max(8, Math.min(vh - card.height - 8, pos.top)),
    left: Math.max(8, Math.min(vw - card.width - 8, pos.left)),
    placement: preferred,
  }
}

function positionFor(
  rect: DomRect,
  placement: 'top' | 'bottom' | 'left' | 'right',
  card: { width: number; height: number },
  pad: number,
): { top: number; left: number } {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  switch (placement) {
    case 'top':
      return {
        top: rect.top - pad - card.height - GAP,
        left: cx - card.width / 2,
      }
    case 'bottom':
      return {
        top: rect.top + rect.height + pad + GAP,
        left: cx - card.width / 2,
      }
    case 'left':
      return {
        top: cy - card.height / 2,
        left: rect.left - pad - card.width - GAP,
      }
    case 'right':
      return {
        top: cy - card.height / 2,
        left: rect.left + rect.width + pad + GAP,
      }
  }
}

// ───────────────────────────────────────────────────────────────────
// Inline keyframes — colocated so the component is self-contained
// ───────────────────────────────────────────────────────────────────

// Keyframes injected via a plain <style> tag — Next.js 16 App Router
// doesn't bundle styled-jsx by default, but a vanilla <style> child
// in a client component is supported by every React renderer.
const TOUR_KEYFRAMES = `
  @keyframes tour-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes tour-card-in {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0)   scale(1); }
  }
  @keyframes tour-pulse {
    0%, 100% { opacity: 0.55; }
    50%      { opacity: 1; }
  }
  .animate-tour-pulse {
    animation: tour-pulse 1.6s ease-in-out infinite;
  }
  @keyframes tour-confetti {
    0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
    100% { transform: translateY(110vh) rotate(540deg); opacity: 0.2; }
  }
  @keyframes tour-bounce-soft {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-4px); }
  }
  .animate-bounce-soft {
    animation: tour-bounce-soft 1.6s ease-in-out infinite;
  }
`

function TourStyles() {
  return <style dangerouslySetInnerHTML={{ __html: TOUR_KEYFRAMES }} />
}
