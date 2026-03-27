'use client'

import { useMyAttendance, useSignIn, useSignOut } from '@/lib/hooks/useAttendance'
import { LiveTimer } from './LiveTimer'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function AttendanceButton() {
  const { data: attendance, isLoading } = useMyAttendance()
  const signIn = useSignIn()
  const signOut = useSignOut()

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  // Not signed in yet today
  if (!attendance) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Work Attendance</p>
            <p className="text-xs text-gray-500 mt-0.5">You haven&apos;t signed in today</p>
          </div>
          <Button variant="primary" onClick={() => signIn.mutate()} loading={signIn.isPending}>
            Sign In to Work
          </Button>
        </div>
        {signIn.error && (
          <p className="mt-2 text-sm text-red-600">
            {signIn.error instanceof Error ? signIn.error.message : 'Failed to sign in'}
          </p>
        )}
      </div>
    )
  }

  const { sessions, totalHours, status, currentSignInAt } = attendance

  return (
    <div className={`rounded-xl border-2 p-5 shadow-sm ${
      status === 'SIGNED_IN' ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
    }`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div>
          {status === 'SIGNED_IN' ? (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <p className="text-sm font-medium text-green-800">Currently Working</p>
              {currentSignInAt && (
                <LiveTimer startTime={currentSignInAt} className="text-lg font-bold text-green-700 font-mono ml-2" />
              )}
            </div>
          ) : (
            <p className="text-sm font-medium text-gray-900">Work Complete</p>
          )}
          <p className="text-xs text-gray-500 mt-0.5">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} today
            {totalHours > 0 && ` \u00B7 ${totalHours.toFixed(1)}h total`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status === 'SIGNED_IN' ? (
            <Button variant="danger" onClick={() => signOut.mutate()} loading={signOut.isPending}>
              Sign Out
            </Button>
          ) : (
            <>
              <div className="text-right mr-2">
                <p className="text-2xl font-bold text-indigo-700">{totalHours.toFixed(1)}h</p>
                <p className="text-xs text-gray-500">total today</p>
              </div>
              <Button variant="primary" onClick={() => signIn.mutate()} loading={signIn.isPending}>
                Sign In Again
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Session timeline */}
      {sessions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sessions.map((s, i) => (
            <div
              key={i}
              className={`text-xs px-2.5 py-1 rounded-full ${
                s.signOutAt
                  ? 'bg-gray-100 text-gray-600'
                  : 'bg-green-200 text-green-800'
              }`}
            >
              {formatTime(s.signInAt)}
              {s.signOutAt ? ` — ${formatTime(s.signOutAt)}` : ' — now'}
              {s.hours != null && ` (${s.hours.toFixed(1)}h)`}
            </div>
          ))}
        </div>
      )}

      {(signIn.error || signOut.error) && (
        <p className="mt-2 text-sm text-red-600">
          {(signIn.error || signOut.error) instanceof Error
            ? (signIn.error || signOut.error)!.message
            : 'Operation failed'}
        </p>
      )}
    </div>
  )
}
