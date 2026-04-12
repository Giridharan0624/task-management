'use client'

import { useEffect, useState } from 'react'
import { useBirthdays } from '@/lib/hooks/useUsers'
import { useAuth } from '@/lib/auth/AuthProvider'
import { BirthdayCakeCut } from './BirthdayCakeCut'

function ConfettiPiece({ delay, left }: { delay: number; left: number }) {
  const colors = ['#f472b6', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#fb923c']
  const color = colors[Math.floor(Math.random() * colors.length)]
  const size = 6 + Math.random() * 6
  const duration = 2 + Math.random() * 2

  return (
    <div
      className="absolute rounded-sm animate-confetti pointer-events-none"
      style={{
        left: `${left}%`,
        top: '-10px',
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
        opacity: 0.8,
      }}
    />
  )
}

function AvatarOrInitial({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm" />
  }
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ring-2 ring-white shadow-sm"
      style={{ backgroundColor: `hsl(${hue}, 60%, 55%)` }}
    >
      {initials}
    </div>
  )
}

export function BirthdayBanner() {
  const { data, isLoading } = useBirthdays()
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [cakeCutDone, setCakeCutDone] = useState(false)
  const [showCakeModal, setShowCakeModal] = useState(false)

  // Check localStorage to not re-show after dismiss today
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    if (localStorage.getItem(`birthday-dismissed-${today}`)) setDismissed(true)
    if (localStorage.getItem(`birthday-cake-cut-${today}`)) setCakeCutDone(true)
  }, [])

  if (isLoading || dismissed || !data?.today?.length) return null

  const handleDismiss = () => {
    const key = `birthday-dismissed-${new Date().toISOString().slice(0, 10)}`
    localStorage.setItem(key, '1')
    setDismissed(true)
  }

  const isMyBirthday = data.today.some(b => b.userId === user?.userId)
  const others = data.today.filter(b => b.userId !== user?.userId)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-pink-200 bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-50 dark:from-pink-500/10 dark:via-purple-500/10 dark:to-indigo-500/10 dark:border-pink-500/20 shadow-sm">
      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <ConfettiPiece key={i} delay={Math.random() * 3} left={Math.random() * 100} />
        ))}
      </div>

      <div className="relative px-5 py-4">
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        {isMyBirthday ? (
          /* It's the logged-in user's birthday */
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-4xl">🎂</span>
            <div className="flex-1 min-w-[200px]">
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">Happy Birthday, {user?.name?.split(' ')[0]}! 🎉</p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
                Wishing you a wonderful day from the entire team!
              </p>
            </div>
            {!cakeCutDone && (
              <button
                onClick={() => setShowCakeModal(true)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                <span className="text-base">🔪</span>
                Cut the Cake
              </button>
            )}
          </div>
        ) : null}

        {others.length > 0 && (
          <div className={isMyBirthday ? 'mt-3 pt-3 border-t border-pink-200/50' : ''}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🎂</span>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                {others.length === 1 ? "Today's Birthday" : "Today's Birthdays"}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {others.map(person => (
                <div key={person.userId} className="flex items-center gap-2.5 bg-white/60 dark:bg-white/10 rounded-xl px-3 py-2 border border-pink-100 dark:border-pink-500/20">
                  <AvatarOrInitial name={person.name} avatarUrl={person.avatarUrl} />
                  <div>
                    <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">{person.name}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      {person.designation || person.department || 'Team Member'}
                    </p>
                  </div>
                  <span className="text-lg ml-1">🎉</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cake Cutting Modal */}
      {showCakeModal && (
        <BirthdayCakeCut
          name={user?.name?.split(' ')[0] || 'there'}
          onComplete={() => {
            const key = `birthday-cake-cut-${new Date().toISOString().slice(0, 10)}`
            localStorage.setItem(key, '1')
            setCakeCutDone(true)
            setShowCakeModal(false)
          }}
          onClose={() => setShowCakeModal(false)}
        />
      )}
    </div>
  )
}

export function UpcomingBirthdays() {
  const { data, isLoading } = useBirthdays()

  if (isLoading || (!data?.upcoming?.length && !data?.today?.length)) return null

  const upcoming = data?.upcoming ?? []
  if (upcoming.length === 0) return null

  return (
    <div className="bg-white dark:bg-[var(--color-surface)] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50/60 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800">
        <span className="text-sm">🎂</span>
        <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Upcoming Birthdays</h3>
      </div>
      <div className="divide-y divide-gray-50 dark:divide-gray-800">
        {upcoming.slice(0, 5).map(person => {
          const dob = new Date(person.dateOfBirth)
          const monthDay = dob.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          return (
            <div key={person.userId} className="flex items-center gap-3 px-4 py-2.5">
              <AvatarOrInitial name={person.name} avatarUrl={person.avatarUrl} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-200 truncate">{person.name}</p>
                <p className="text-[10px] text-gray-400">{person.designation || person.department || 'Team Member'}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">{monthDay}</p>
                <p className="text-[9px] text-gray-400">
                  {person.daysUntil === 1 ? 'Tomorrow' : `In ${person.daysUntil} days`}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
