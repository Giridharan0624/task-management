'use client'

import { useTodayAttendance } from '@/lib/hooks/useAttendance'
import { useAllDayOffs } from '@/lib/hooks/useDayOffs'
import { useUsers } from '@/lib/hooks/useUsers'
import { LiveTimer } from './LiveTimer'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { Avatar } from '@/components/ui/AvatarUpload'

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

export function AttendanceTable() {
  const { data: records, isLoading } = useTodayAttendance()
  const { data: allDayOffs } = useAllDayOffs()
  const { data: allUsers } = useUsers()

  // Build avatar lookup from users
  const avatarMap = new Map<string, string | undefined>()
  for (const u of allUsers ?? []) avatarMap.set(u.userId, u.avatarUrl)
  const getAvatar = (userId: string) => avatarMap.get(userId)

  const attendance = records ?? []
  const today = getToday()

  // Find approved day-offs that cover today
  const onDayOff = (allDayOffs ?? []).filter((d) => {
    if (d.status !== 'APPROVED') return false
    const start = d.startDate.slice(0, 10)
    const end = d.endDate.slice(0, 10)
    return today >= start && today <= end
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    )
  }

  const signedIn = attendance.filter((a) => a.status === 'SIGNED_IN')
  const signedOut = attendance.filter((a) => a.status === 'SIGNED_OUT')

  return (
    <div className="flex flex-col gap-4">
      {/* Day Off Banner */}
      {onDayOff.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-semibold text-amber-800">On Day Off Today ({onDayOff.length})</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onDayOff.map((d) => (
              <div key={d.requestId} className="inline-flex items-center gap-2 bg-white rounded-lg border border-amber-200 px-3 py-1.5">
                <Avatar url={getAvatar(d.userId)} name={d.userName} size="sm" />
                <div>
                  <span className="text-sm font-medium text-gray-900">{d.userName}</span>
                  {d.employeeId && <span className="text-xs text-gray-400 ml-1">({d.employeeId})</span>}
                </div>
                <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Day Off</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
          <p className="text-xl font-bold text-green-700">{signedIn.length}</p>
          <p className="text-xs text-green-600">Working Now</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
          <p className="text-xl font-bold text-gray-700">{signedOut.length}</p>
          <p className="text-xs text-gray-500">Done</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
          <p className="text-xl font-bold text-amber-700">{onDayOff.length}</p>
          <p className="text-xs text-amber-600">On Leave</p>
        </div>
        <div className="bg-indigo-50 rounded-lg p-3 text-center border border-indigo-100">
          <p className="text-xl font-bold text-indigo-700">{attendance.length}</p>
          <p className="text-xs text-indigo-600">Tracked</p>
        </div>
      </div>

      {attendance.length === 0 && onDayOff.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-8 text-center">
          <p className="text-gray-500 text-sm">No one has started tracking today yet.</p>
        </div>
      ) : attendance.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Task</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sessions</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {attendance.map((record) => (
                <tr key={record.userId} className="hover:bg-gray-50">
                  <td className="px-5 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Avatar url={getAvatar(record.userId)} name={record.userName} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{record.userName}</p>
                        <p className="text-xs text-gray-400">{record.systemRole}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    {record.status === 'SIGNED_IN' && record.currentTask ? (
                      <div>
                        <p className="text-sm font-medium text-green-700">{record.currentTask.taskTitle}</p>
                        <p className="text-xs text-gray-400">{record.currentTask.projectName}</p>
                      </div>
                    ) : record.status === 'SIGNED_IN' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                        Working
                      </span>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-600">Done</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {record.sessions.map((s, i) => (
                        <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${
                          s.signOutAt ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                        }`}>
                          {s.taskTitle ? `${s.taskTitle}: ` : ''}
                          {new Date(s.signInAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          {s.signOutAt
                            ? ` — ${new Date(s.signOutAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                            : ' — now'}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-sm font-medium">
                    {record.status === 'SIGNED_IN' && record.currentSignInAt ? (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">{record.totalHours.toFixed(1)}h +</span>
                        <LiveTimer startTime={record.currentSignInAt} className="text-green-700 font-mono" />
                      </div>
                    ) : (
                      <span className="text-gray-900">{record.totalHours.toFixed(1)}h</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
