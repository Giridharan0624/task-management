'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { updateProfile, getProfile } from '@/lib/api/userApi'
import { AvatarUpload } from '@/components/ui/AvatarUpload'
import { DatePicker } from '@/components/ui/DatePicker'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { useTheme } from '@/lib/theme/ThemeProvider'
import { useMyTasks } from '@/lib/hooks/useUsers'
import { useLiveHours } from '@/lib/hooks/useLiveHours'
import { useProjects } from '@/lib/hooks/useProjects'
import { useMyDayOffs } from '@/lib/hooks/useDayOffs'
import { formatDuration } from '@/lib/utils/formatDuration'
import type { User } from '@/types/user'

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-700 ring-1 ring-inset ring-purple-200',
  ADMIN: 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-200',
  MEMBER: 'bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200',
}

const inputClass = "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 outline-none transition-all placeholder:text-gray-400"

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <div className="flex items-center justify-between px-6 py-4 bg-gray-50/60">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">{title}</h3>
        {action}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-400 mb-0.5">{label}</dt>
      <dd className="text-sm text-gray-900 font-medium">{value || <span className="text-gray-300 font-normal">—</span>}</dd>
    </div>
  )
}

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const [profile, setProfile] = useState<User | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [designation, setDesignation] = useState('')
  const [location, setLocation] = useState('')
  const [bio, setBio] = useState('')
  const [skillsText, setSkillsText] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [collegeName, setCollegeName] = useState('')
  const [areaOfInterest, setAreaOfInterest] = useState('')
  const [hobby, setHobby] = useState('')
  const [companyPrefix, setCompanyPrefix] = useState('')
  const [editConfirmed, setEditConfirmed] = useState(false)
  const [personalInfoConfirmed, setBioDataConfirmed] = useState(false)
  const [personalInfoSaving, setBioDataSaving] = useState(false)
  const [personalInfoSuccess, setBioDataSuccess] = useState(false)
  const [personalInfoError, setBioDataError] = useState('')

  useEffect(() => {
    getProfile().then((p) => {
      setProfile(p)
      setName(p.name || '')
      setPhone(p.phone || '')
      setDesignation(p.designation || '')
      setLocation(p.location || '')
      setBio(p.bio || '')
      setSkillsText((p.skills ?? []).join(', '))
      setDateOfBirth(p.dateOfBirth || '')
      setCollegeName(p.collegeName || '')
      setAreaOfInterest(p.areaOfInterest || '')
      setHobby(p.hobby || '')
      setCompanyPrefix(p.companyPrefix || 'NS')
    })
  }, [])

  // Stats data
  const { data: myTasks } = useMyTasks()
  const { totalHours: liveTodayHours } = useLiveHours()
  const { data: projects } = useProjects()

  const { data: myDayOffs } = useMyDayOffs()

  const tasksDone = (myTasks ?? []).filter(t => t.status === 'DONE').length
  const totalTasks = (myTasks ?? []).length
  const todayHours = liveTodayHours
  const projectCount = (projects ?? []).length

  // Day-off score (same logic as day-offs page)
  const dayOffScore = (() => {
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`
    let daysOff = 0
    for (const d of (myDayOffs ?? [])) {
      if (d.status !== 'APPROVED') continue
      const start = d.startDate.slice(0, 10)
      const end = d.endDate.slice(0, 10)
      if (start > monthEnd || end < monthStart) continue
      const from = new Date(Math.max(new Date(start).getTime(), new Date(monthStart).getTime()))
      const to = new Date(Math.min(new Date(end).getTime(), new Date(monthEnd).getTime()))
      daysOff += Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1
    }
    return daysOff === 0 ? 100 : daysOff <= 2 ? 75 : daysOff <= 5 ? 50 : 25
  })()

  // Profile completeness
  const completenessFields = [
    profile?.name, profile?.bio, profile?.phone, profile?.designation,
    profile?.location, profile?.dateOfBirth, profile?.collegeName,
    profile?.areaOfInterest, profile?.hobby, profile?.avatarUrl,
    profile?.skills && profile.skills.length > 0 ? 'yes' : null,
  ]
  const filledCount = completenessFields.filter(Boolean).length
  const completeness = Math.round((filledCount / completenessFields.length) * 100)

  const handleSave = async () => {
    setSaving(true)
    setSuccess(false)
    setSaveError('')
    try {
      const skills = skillsText.split(',').map((s) => s.trim()).filter(Boolean)
      const updated = await updateProfile({
        name, phone, designation, location, bio, skills,
        dateOfBirth, collegeName, areaOfInterest, hobby,
        ...(user?.systemRole === 'OWNER' && companyPrefix ? { companyPrefix } : {}),
      })
      setProfile(updated)
      updateUser({ name })
      setEditing(false)
      setEditConfirmed(false)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (profile) {
      setName(profile.name || '')
      setPhone(profile.phone || '')
      setDesignation(profile.designation || '')
      setLocation(profile.location || '')
      setBio(profile.bio || '')
      setSkillsText((profile.skills ?? []).join(', '))
    }
    setEditing(false)
    setEditConfirmed(false)
  }

  if (!user) return null
  const dp = profile || user
  const isOwner = dp.systemRole === 'OWNER'
  const personalInfoSubmitted = !!(profile?.dateOfBirth)

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-fade-in">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Profile</h1>
        {!editing && (isOwner || personalInfoSubmitted) && (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            {isOwner ? 'Edit Company Profile' : 'Edit Profile'}
          </Button>
        )}
      </div>

      {/* Success/Error banner */}
      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-700 animate-fade-in">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Profile updated successfully.
        </div>
      )}
      {saveError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {saveError}
        </div>
      )}

      {/* Quick Stats + Profile Completeness */}
      {!isOwner && !editing && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xl font-bold text-emerald-700 tabular-nums">{tasksDone}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Tasks Done</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xl font-bold text-blue-700 tabular-nums">{totalTasks - tasksDone}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Active</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xl font-bold text-indigo-700 tabular-nums">{projectCount}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Projects</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xl font-bold text-cyan-700 tabular-nums">{formatDuration(todayHours)}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Today</p>
          </div>
          <div className={`rounded-xl border p-4 shadow-sm ${
            dayOffScore === 100 ? 'bg-emerald-50 border-emerald-200' :
            dayOffScore >= 75 ? 'bg-blue-50 border-blue-200' :
            dayOffScore >= 50 ? 'bg-amber-50 border-amber-200' :
            'bg-red-50 border-red-200'
          }`}>
            <p className={`text-xl font-bold tabular-nums ${
              dayOffScore === 100 ? 'text-emerald-700' :
              dayOffScore >= 75 ? 'text-blue-700' :
              dayOffScore >= 50 ? 'text-amber-700' :
              'text-red-700'
            }`}>{dayOffScore}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Day-Off Score</p>
          </div>
          {/* Profile completeness */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="relative flex-shrink-0" style={{ width: 28, height: 28 }}>
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke={completeness >= 100 ? '#10b981' : completeness >= 60 ? '#6366f1' : '#f59e0b'}
                    strokeWidth="3.5" strokeDasharray={`${completeness} ${100 - completeness}`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[7px] font-bold tabular-nums" style={{ color: completeness >= 100 ? '#10b981' : completeness >= 60 ? '#6366f1' : '#f59e0b' }}>{completeness}%</span>
                </div>
              </div>
              <p className="text-sm font-bold tabular-nums" style={{ color: completeness >= 100 ? '#10b981' : completeness >= 60 ? '#6366f1' : '#f59e0b' }}>{filledCount}/{completenessFields.length}</p>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Profile</p>
          </div>
        </div>
      )}

      {/* Main card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Identity section */}
        <Section title="Identity">
          <div className="flex items-center gap-5">
            <AvatarUpload
              currentUrl={profile?.avatarUrl}
              name={dp.name || dp.email}
              size="lg"
              editable={!editing}
              onUpload={async (url) => {
                const updated = await updateProfile({ avatarUrl: url })
                setProfile(updated)
              }}
            />
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1 block">{isOwner ? 'Company Name' : 'Full Name'}</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                  </div>
                  {isOwner && (
                    <div>
                      <label className="text-xs font-medium text-gray-400 mb-1 block">Employee ID Prefix</label>
                      <div className="flex items-center gap-2">
                        <input value={companyPrefix} onChange={(e) => setCompanyPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                          placeholder="NS" maxLength={6} className={`${inputClass} w-24 uppercase font-mono`} />
                        <span className="text-[11px] text-gray-400">Format: {companyPrefix || 'NS'}-DEPT-YXXXX</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <h2 className="text-lg font-bold text-gray-900 truncate">{dp.name || dp.email}</h2>
                  <p className="text-sm text-gray-500 truncate">{dp.email}</p>
                </>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${ROLE_COLORS[dp.systemRole] || ROLE_COLORS.MEMBER}`}>
                  {dp.systemRole}
                </span>
                {!isOwner && profile?.employeeId && (
                  <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-mono font-bold text-gray-500 ring-1 ring-inset ring-gray-200">
                    {profile.employeeId}
                  </span>
                )}
                {dp.createdAt && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Joined {new Date(dp.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Section>

        {/* About section */}
        <Section title="About">
          {editing ? (
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Write a short bio..."
              className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 outline-none resize-none transition-all placeholder:text-gray-400"
            />
          ) : (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {profile?.bio || <span className="text-gray-300">No bio added yet.</span>}
            </p>
          )}
        </Section>

        {/* Contact & Work section — hidden for OWNER (company account) */}
        {!isOwner && personalInfoSubmitted && (
          <Section title="Contact & Work">
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1 block">Phone</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1 block">Date of Birth</label>
                  <DatePicker value={dateOfBirth} onChange={setDateOfBirth} max={new Date().toISOString().slice(0, 10)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1 block">Designation</label>
                  <input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Software Engineer" className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1 block">Department <span className="text-gray-300">(admin only)</span></label>
                  <input value={profile?.department || ''} disabled className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2 text-sm text-gray-400 cursor-not-allowed" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1 block">Location</label>
                  <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Chennai, India" className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1 block">College Name</label>
                  <input value={collegeName} onChange={(e) => setCollegeName(e.target.value)} placeholder="University / College" className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1 block">Area of Interest</label>
                  <input value={areaOfInterest} onChange={(e) => setAreaOfInterest(e.target.value)} placeholder="Web Development, AI, etc." className={inputClass} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1 block">Hobby</label>
                  <input value={hobby} onChange={(e) => setHobby(e.target.value)} placeholder="Reading, Music, etc." className={inputClass} />
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-y-5 gap-x-6">
                <Field label="Phone" value={profile?.phone} />
                <Field label="Date of Birth" value={profile?.dateOfBirth ? new Date(profile.dateOfBirth + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined} />
                <Field label="Designation" value={profile?.designation} />
                <Field label="Department" value={profile?.department} />
                <Field label="Location" value={profile?.location} />
                <Field label="College" value={profile?.collegeName} />
                <Field label="Area of Interest" value={profile?.areaOfInterest} />
                <Field label="Hobby" value={profile?.hobby} />
                <Field label="Joined" value={dp.createdAt ? new Date(dp.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined} />
              </dl>
            )}
          </Section>
        )}

        {/* Skills section — hidden for OWNER, shown after personal info submitted */}
        {!isOwner && personalInfoSubmitted && (
          <Section title="Skills">
            {editing ? (
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1 block">Comma separated</label>
                <input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder="React, Python, AWS" className={inputClass} />
              </div>
            ) : profile?.skills && profile.skills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map((skill, i) => {
                  const colors = [
                    'bg-indigo-50 text-indigo-700 border-indigo-200',
                    'bg-emerald-50 text-emerald-700 border-emerald-200',
                    'bg-violet-50 text-violet-700 border-violet-200',
                    'bg-amber-50 text-amber-700 border-amber-200',
                    'bg-blue-50 text-blue-700 border-blue-200',
                    'bg-teal-50 text-teal-700 border-teal-200',
                    'bg-pink-50 text-pink-700 border-pink-200',
                    'bg-orange-50 text-orange-700 border-orange-200',
                  ]
                  return (
                    <span key={skill} className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${colors[i % colors.length]}`}>
                      {skill}
                    </span>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-300">No skills added.</p>
            )}
          </Section>
        )}

        {/* Edit mode: checkbox + save/cancel at bottom */}
        {editing && (isOwner || personalInfoSubmitted) && (
          <div className="border-t border-gray-100 px-6 py-5">
            <label className="flex items-start gap-3 cursor-pointer mb-4">
              <div className={`flex items-center justify-center h-5 w-5 rounded-md border-2 mt-0.5 transition-all flex-shrink-0 ${
                editConfirmed ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
              }`}>
                {editConfirmed && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <input type="checkbox" checked={editConfirmed} onChange={(e) => setEditConfirmed(e.target.checked)} className="sr-only" />
              <span className="text-sm text-gray-600">I confirm that the above details are true and correct.</span>
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={handleCancel}>Cancel</Button>
              <Button size="sm" onClick={handleSave} loading={saving} disabled={!editConfirmed}>Save Changes</Button>
            </div>
          </div>
        )}

      </div>

      {/* Personal Info form — only shown once (before first submission), hidden for OWNER */}
      {!isOwner && !personalInfoSubmitted && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50/60">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Personal Info</h3>
          </div>
          <div className="px-6 py-5">
            {personalInfoSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-700 mb-4 animate-fade-in">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Bio data saved successfully.
              </div>
            )}
            {personalInfoError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700 mb-4">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {personalInfoError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1 block">Full Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              </div>

              {/* Date of Birth */}
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1 block">Date of Birth</label>
                <DatePicker value={dateOfBirth} onChange={setDateOfBirth} max={new Date().toISOString().slice(0, 10)} />
              </div>

              {/* Phone */}
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1 block">Phone Number</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className={inputClass} />
              </div>

              {/* Email — read only */}
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1 block">Email ID</label>
                <input value={dp.email} disabled className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2 text-sm text-gray-400 cursor-not-allowed" />
              </div>

              {/* College Name */}
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1 block">College Name</label>
                <input value={collegeName} onChange={(e) => setCollegeName(e.target.value)} placeholder="University / College" className={inputClass} />
              </div>

              {/* Location */}
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1 block">Location</label>
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Chennai, India" className={inputClass} />
              </div>

              {/* Join Date — read only */}
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1 block">Join Date</label>
                <input value={dp.createdAt ? new Date(dp.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''} disabled className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2 text-sm text-gray-400 cursor-not-allowed" />
              </div>

              {/* Role — read only */}
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1 block">Role</label>
                <input value={dp.systemRole} disabled className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2 text-sm text-gray-400 cursor-not-allowed" />
              </div>

              {/* Area of Interest */}
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1 block">Area of Interest</label>
                <input value={areaOfInterest} onChange={(e) => setAreaOfInterest(e.target.value)} placeholder="Web Development, AI, etc." className={inputClass} />
              </div>

              {/* Hobby */}
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1 block">Hobby</label>
                <input value={hobby} onChange={(e) => setHobby(e.target.value)} placeholder="Reading, Music, etc." className={inputClass} />
              </div>
            </div>

            {/* Confirmation checkbox + Submit */}
            <div className="mt-5 pt-4 border-t border-gray-100">
              <label className="flex items-start gap-3 cursor-pointer mb-4">
                <div className={`flex items-center justify-center h-5 w-5 rounded-md border-2 mt-0.5 transition-all flex-shrink-0 ${
                  personalInfoConfirmed ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                }`}>
                  {personalInfoConfirmed && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={personalInfoConfirmed}
                  onChange={(e) => setBioDataConfirmed(e.target.checked)}
                  className="sr-only"
                />
                <span className="text-sm text-gray-600">I confirm that the above details are true and correct.</span>
              </label>

              <div className="flex justify-end">
                <Button
                  disabled={!personalInfoConfirmed || personalInfoSaving}
                  loading={personalInfoSaving}
                  onClick={async () => {
                    setBioDataSaving(true)
                    setBioDataSuccess(false)
                    setBioDataError('')
                    try {
                      const skills = skillsText.split(',').map((s) => s.trim()).filter(Boolean)
                      const updated = await updateProfile({
                        name, phone, location, bio, skills, designation,
                        dateOfBirth, collegeName, areaOfInterest, hobby,
                      })
                      setProfile(updated)
                      updateUser({ name })
                      setBioDataSuccess(true)
                      setBioDataConfirmed(false)
                      setTimeout(() => setBioDataSuccess(false), 4000)
                    } catch (err: unknown) {
                      setBioDataError(err instanceof Error ? err.message : 'Failed to save personal info')
                    } finally {
                      setBioDataSaving(false)
                    }
                  }}
                >
                  Submit Personal Info
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Appearance */}
      <ThemeSection />

      {/* Security — Change Password */}
      <ChangePasswordSection />

      {/* Desktop App Download */}
      <DesktopAppSection />
    </div>
  )
}

function ThemeSection() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 bg-gray-50/60">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Appearance</h3>
      </div>
      <div className="px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Theme</p>
            <p className="text-xs text-gray-400 mt-0.5">Choose your preferred appearance</p>
          </div>
          <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setTheme('light')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                theme === 'light'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              Light
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                theme === 'dark'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              Dark
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChangePasswordSection() {
  const { changePassword, user } = useAuth()
  const [open, setOpen] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Forgot password flow
  const [forgotMode, setForgotMode] = useState<'off' | 'sent' | 'confirm'>('off')
  const [forgotCode, setForgotCode] = useState('')
  const [forgotNewPw, setForgotNewPw] = useState('')
  const [forgotConfirmPw, setForgotConfirmPw] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState('')
  const [forgotSuccess, setForgotSuccess] = useState(false)

  const handleSubmit = async () => {
    setError('')
    setSuccess(false)

    if (!currentPw || !newPw || !confirmPw) {
      setError('All fields are required')
      return
    }
    if (newPw.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }
    if (newPw !== confirmPw) {
      setError('New passwords do not match')
      return
    }
    if (currentPw === newPw) {
      setError('New password must be different from current password')
      return
    }

    setSaving(true)
    try {
      await changePassword(currentPw, newPw)
      setSuccess(true)
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      setOpen(false)
      setTimeout(() => setSuccess(false), 4000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to change password'
      if (msg.includes('Incorrect')) {
        setError('Current password is incorrect')
      } else if (msg.includes('policy') || msg.includes('Password')) {
        setError('Password must have 8+ characters with uppercase, lowercase, and a number')
      } else {
        setError(msg)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleForgotSendCode = async () => {
    if (!user?.email) return
    setForgotError('')
    setForgotLoading(true)
    try {
      const { forgotPassword } = await import('@/lib/auth/cognitoClient')
      await forgotPassword(user.email)
      setForgotMode('confirm')
    } catch (err: unknown) {
      setForgotError(err instanceof Error ? err.message : 'Failed to send code')
    } finally {
      setForgotLoading(false)
    }
  }

  const handleForgotConfirm = async () => {
    setForgotError('')
    if (!forgotCode.trim()) { setForgotError('Code is required'); return }
    if (forgotNewPw.length < 8) { setForgotError('Min 8 characters'); return }
    if (!/[A-Z]/.test(forgotNewPw)) { setForgotError('Need an uppercase letter'); return }
    if (!/[a-z]/.test(forgotNewPw)) { setForgotError('Need a lowercase letter'); return }
    if (!/[0-9]/.test(forgotNewPw)) { setForgotError('Need a number'); return }
    if (forgotNewPw !== forgotConfirmPw) { setForgotError('Passwords do not match'); return }

    setForgotLoading(true)
    try {
      const { confirmForgotPassword } = await import('@/lib/auth/cognitoClient')
      await confirmForgotPassword(user!.email, forgotCode.trim(), forgotNewPw)
      setForgotSuccess(true)
      setTimeout(() => {
        setOpen(false)
        setForgotMode('off')
        setForgotSuccess(false)
        setForgotCode('')
        setForgotNewPw('')
        setForgotConfirmPw('')
      }, 2000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset'
      if (msg.includes('CodeMismatch') || msg.includes('code')) setForgotError('Invalid code')
      else if (msg.includes('Expired')) setForgotError('Code expired. Request a new one.')
      else setForgotError(msg)
    } finally {
      setForgotLoading(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setForgotMode('off')
    setForgotError('')
    setForgotCode('')
    setForgotNewPw('')
    setForgotConfirmPw('')
    setForgotSuccess(false)
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
    setError('')
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50/60">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Security</h3>
        </div>
        <div className="px-6 py-5">
          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-700 mb-4 animate-fade-in">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Password changed successfully.
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Password</p>
              <p className="text-xs text-gray-400 mt-0.5">Manage your account password</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
              Change Password
            </Button>
          </div>
        </div>
      </div>

      <Modal isOpen={open} onClose={handleClose} title={forgotMode === 'off' ? 'Change Password' : 'Reset Password'} size="sm">
        {forgotSuccess ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <svg className="w-12 h-12 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-lg font-bold text-gray-900">Password Reset!</p>
            <p className="text-sm text-gray-500">Please sign in again with your new password.</p>
          </div>
        ) : forgotMode === 'confirm' ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">A verification code has been sent to <span className="font-semibold text-gray-900">{user?.email}</span></p>
            {forgotError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{forgotError}</div>
            )}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Verification Code</label>
              <input type="text" placeholder="Enter 6-digit code" value={forgotCode} onChange={(e) => setForgotCode(e.target.value)} autoComplete="one-time-code" className={inputClass} />
            </div>
            <PasswordInput label="New Password" value={forgotNewPw} onChange={(e) => setForgotNewPw(e.target.value)} placeholder="Enter new password" />
            <PasswordInput label="Confirm Password" value={forgotConfirmPw} onChange={(e) => setForgotConfirmPw(e.target.value)} placeholder="Re-enter new password" />
            <p className="text-[11px] text-gray-400">Min 8 characters with uppercase, lowercase, and a number.</p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={() => { setForgotMode('off'); setForgotError('') }}>Back</Button>
              <Button size="sm" onClick={handleForgotConfirm} loading={forgotLoading}>Reset Password</Button>
            </div>
          </div>
        ) : forgotMode === 'sent' ? null : (
          <div className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>
            )}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-semibold text-gray-700">Current Password</label>
                <button type="button" onClick={handleForgotSendCode} disabled={forgotLoading} className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold">
                  {forgotLoading ? 'Sending...' : 'Forgot?'}
                </button>
              </div>
              <PasswordInput value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Enter current password" />
            </div>
            <PasswordInput label="New Password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Enter new password" />
            <PasswordInput label="Confirm New Password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Re-enter new password" />
            <p className="text-[11px] text-gray-400">Min 8 characters with uppercase, lowercase, and a number.</p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={handleClose}>Cancel</Button>
              <Button size="sm" onClick={handleSubmit} loading={saving}>Change Password</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

function DesktopAppSection() {
  const [latest, setLatest] = useState<{ version: string; downloads: Record<string, string> } | null>(null)

  useEffect(() => {
    fetch('https://d32wbqjdb87hcf.cloudfront.net/releases/latest.json')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setLatest(data) })
      .catch(() => {})
  }, [])

  const version = latest?.version || '1.0.0'
  const platforms = [
    { key: 'windows', label: 'Windows', icon: '💻', ext: '.exe' },
    { key: 'linux', label: 'Linux', icon: '🐧', ext: '.AppImage' },
    { key: 'macos', label: 'macOS', icon: '🍎', ext: '.dmg' },
  ]

  return (
    <div className="bg-white dark:bg-[var(--color-surface)] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 bg-gray-50/60 dark:bg-gray-800/30">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Desktop App</h3>
        <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md">v{version}</span>
      </div>
      <div className="px-6 py-5">
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Track time, monitor activity, and take screenshots with the desktop companion app.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {platforms.map(p => {
            const url = latest?.downloads?.[p.key] || `https://github.com/Giridharan0624/taskflow-desktop/releases/latest`
            return (
              <a
                key={p.key}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/5 transition-all group"
              >
                <span className="text-2xl">{p.icon}</span>
                <span className="text-[12px] font-semibold text-gray-700 dark:text-gray-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{p.label}</span>
                <span className="text-[10px] text-gray-400">{p.ext}</span>
              </a>
            )
          })}
        </div>
        <p className="text-[10px] text-gray-400 mt-3 text-center">
          <a href="https://github.com/Giridharan0624/taskflow-desktop/releases" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:text-indigo-600">
            View all releases on GitHub →
          </a>
        </p>
      </div>
    </div>
  )
}
