'use client'

import { useTodayAttendance } from '@/lib/hooks/useAttendance'
import { LiveTimer } from './LiveTimer'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'

export function AttendanceTable() {
  const { data: records, isLoading } = useTodayAttendance()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    )
  }

  const attendance = records ?? []

  if (attendance.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 py-8 text-center">
        <p className="text-gray-500 text-sm">No one has signed in today yet.</p>
      </div>
    )
  }

  const signedIn = attendance.filter((a) => a.status === 'SIGNED_IN')
  const signedOut = attendance.filter((a) => a.status === 'SIGNED_OUT')

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
          <p className="text-xl font-bold text-green-700">{signedIn.length}</p>
          <p className="text-xs text-green-600">Working Now</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
          <p className="text-xl font-bold text-gray-700">{signedOut.length}</p>
          <p className="text-xs text-gray-500">Signed Out</p>
        </div>
        <div className="bg-indigo-50 rounded-lg p-3 text-center border border-indigo-100">
          <p className="text-xl font-bold text-indigo-700">{attendance.length}</p>
          <p className="text-xs text-indigo-600">Total Today</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sessions</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Hours</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {attendance.map((record) => (
              <tr key={record.userId} className="hover:bg-gray-50">
                <td className="px-5 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-indigo-600 font-medium text-xs">
                        {record.userName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{record.userName}</p>
                      <p className="text-xs text-gray-400">{record.systemRole}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 whitespace-nowrap">
                  {record.status === 'SIGNED_IN' ? (
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
    </div>
  )
}
