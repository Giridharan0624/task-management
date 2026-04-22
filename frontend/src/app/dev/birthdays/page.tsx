'use client'

import { useState } from 'react'
import { BirthdayBanner, UpcomingBirthdays } from '@/components/ui/BirthdayBanner'
import { BirthdayCakeCut } from '@/components/ui/BirthdayCakeCut'

/* ─── Mock preview with fake data ─── */
function MockBirthdayBanner() {
  const [dismissed, setDismissed] = useState(false)
  const [cakeCutDone, setCakeCutDone] = useState(false)
  const [showCakeModal, setShowCakeModal] = useState(false)

  const mockToday = [
    { userId: '1', name: 'Giridharan S', designation: 'Full Stack Developer', department: 'Engineering', dateOfBirth: '2000-04-12' },
    { userId: '2', name: 'Priya Sharma', avatarUrl: '', designation: 'UI/UX Designer', department: 'Design', dateOfBirth: '1998-04-12' },
  ]

  if (dismissed) return null

  return (
    <div className="relative overflow-hidden rounded-2xl border border-pink-200 bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-50 dark:from-pink-500/10 dark:via-purple-500/10 dark:to-indigo-500/10 dark:border-pink-500/20 shadow-sm">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => {
          const colors = ['#f472b6', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#fb923c']
          const color = colors[Math.floor(Math.random() * colors.length)]
          const size = 6 + Math.random() * 6
          const duration = 2 + Math.random() * 2
          return (
            <div
              key={i}
              className="absolute rounded-sm animate-confetti pointer-events-none"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-10px',
                width: `${size}px`,
                height: `${size}px`,
                backgroundColor: color,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${duration}s`,
                opacity: 0.8,
              }}
            />
          )
        })}
      </div>

      <div className="relative px-5 py-4">
        <button onClick={() => setDismissed(true)} className="absolute top-3 right-3 text-muted-foreground/70 hover:text-muted-foreground transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        {/* Personal greeting with Cut the Cake button */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-4xl">🎂</span>
          <div className="flex-1 min-w-[200px]">
            <p className="text-lg font-bold text-foreground dark:text-gray-100">Happy Birthday, Giridharan! 🎉</p>
            <p className="text-sm text-muted-foreground dark:text-muted-foreground/50 mt-0.5">Wishing you a wonderful day from the entire team!</p>
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

        {/* Other birthdays */}
        <div className="mt-3 pt-3 border-t border-pink-200/50">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🎂</span>
            <p className="text-sm font-bold text-foreground/95 dark:text-gray-200">Today&apos;s Birthdays</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {mockToday.map(person => {
              const initials = person.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
              const hue = person.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
              return (
                <div key={person.userId} className="flex items-center gap-2.5 bg-card/60 dark:bg-white/10 rounded-xl px-3 py-2 border border-pink-100 dark:border-pink-500/20">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ring-2 ring-white shadow-sm" style={{ backgroundColor: `hsl(${hue}, 60%, 55%)` }}>
                    {initials}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-foreground/95 dark:text-gray-200">{person.name}</p>
                    <p className="text-[10px] text-muted-foreground dark:text-muted-foreground/70">{person.designation}</p>
                  </div>
                  <span className="text-lg ml-1">🎉</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Cake Cutting Modal */}
      {showCakeModal && (
        <BirthdayCakeCut
          name="Giridharan"
          onComplete={() => {
            setCakeCutDone(true)
            setShowCakeModal(false)
          }}
          onClose={() => setShowCakeModal(false)}
        />
      )}
    </div>
  )
}

function MockUpcomingBirthdays() {
  const mockUpcoming = [
    { userId: '3', name: 'Rahul Kumar', designation: 'Backend Developer', department: 'Engineering', dateOfBirth: '1999-04-13', daysUntil: 1 },
    { userId: '4', name: 'Ananya Reddy', designation: 'Project Manager', department: 'Management', dateOfBirth: '1997-04-15', daysUntil: 3 },
    { userId: '5', name: 'Vikram Patel', designation: 'DevOps Engineer', department: 'Engineering', dateOfBirth: '2001-04-17', daysUntil: 5 },
    { userId: '6', name: 'Sneha Iyer', designation: 'QA Engineer', department: 'Engineering', dateOfBirth: '1996-04-19', daysUntil: 7 },
  ]

  return (
    <div className="bg-card dark:bg-[var(--color-surface)] rounded-2xl border border-border dark:border-gray-800 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 dark:bg-gray-800/30 border-b border-border dark:border-gray-800">
        <span className="text-sm">🎂</span>
        <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Upcoming Birthdays</h3>
      </div>
      <div className="divide-y divide-border/60 dark:divide-gray-800">
        {mockUpcoming.map(person => {
          const dob = new Date(person.dateOfBirth)
          const monthDay = dob.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          const initials = person.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
          const hue = person.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
          return (
            <div key={person.userId} className="flex items-center gap-3 px-4 py-2.5">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ring-2 ring-white shadow-sm" style={{ backgroundColor: `hsl(${hue}, 60%, 55%)` }}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-foreground/95 dark:text-gray-200 truncate">{person.name}</p>
                <p className="text-[10px] text-muted-foreground/70">{person.designation}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">{monthDay}</p>
                <p className="text-[9px] text-muted-foreground/70">
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

export default function BirthdaysReviewPage() {
  const [showCakeDirectly, setShowCakeDirectly] = useState(false)

  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Birthday UI Review</h1>
        <p className="mt-1 text-sm text-muted-foreground/70">Preview of all birthday-related components</p>
      </div>

      {/* 0. Cake Cutting Modal — direct test */}
      <section>
        <h2 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wider">0. Cake Cutting Modal (direct test)</h2>
        <button
          onClick={() => setShowCakeDirectly(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2"
        >
          <span className="text-base">🔪</span>
          Open Cake Cutting Modal
        </button>
        {showCakeDirectly && (
          <BirthdayCakeCut
            name="Giridharan"
            onComplete={() => setShowCakeDirectly(false)}
            onClose={() => setShowCakeDirectly(false)}
          />
        )}
      </section>

      {/* 1. Dashboard Banner — Today's birthday (with confetti) */}
      <section>
        <h2 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wider">1. Dashboard Banner (shows when someone has birthday today)</h2>
        <MockBirthdayBanner />
      </section>

      {/* 2. Sidebar Widget — Upcoming Birthdays */}
      <section>
        <h2 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wider">2. Sidebar Widget (upcoming 7 days)</h2>
        <div className="max-w-[260px]">
          <MockUpcomingBirthdays />
        </div>
      </section>

      {/* 3. Live components (from API) */}
      <section>
        <h2 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wider">3. Live Components (from API)</h2>
        <p className="text-xs text-muted-foreground/70 mb-3">These pull real data from the /users/birthdays endpoint</p>
        <div className="flex flex-col gap-4">
          <BirthdayBanner />
          <div className="max-w-[260px]">
            <UpcomingBirthdays />
          </div>
        </div>
        <p className="text-xs text-muted-foreground/70 mt-2 italic">If nothing shows above, no one has a birthday today or in the next 7 days (or no date_of_birth is set for any user).</p>
      </section>
    </div>
  )
}
