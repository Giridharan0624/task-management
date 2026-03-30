'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { updateProfile, getProfile } from '@/lib/api/userApi'
import { AvatarUpload } from '@/components/ui/AvatarUpload'
import { DatePicker } from '@/components/ui/DatePicker'
import { PasswordInput } from '@/components/ui/PasswordInput'
import type { User } from '@/types/user'

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-700 ring-1 ring-inset ring-purple-200',
  CEO: 'bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-200',
  MD: 'bg-fuchsia-100 text-fuchsia-700 ring-1 ring-inset ring-fuchsia-200',
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
  const [editConfirmed, setEditConfirmed] = useState(false)
  const [bioDataConfirmed, setBioDataConfirmed] = useState(false)
  const [bioDataSaving, setBioDataSaving] = useState(false)
  const [bioDataSuccess, setBioDataSuccess] = useState(false)
  const [bioDataError, setBioDataError] = useState('')

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
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSuccess(false)
    setSaveError('')
    try {
      const skills = skillsText.split(',').map((s) => s.trim()).filter(Boolean)
      const updated = await updateProfile({
        name, phone, designation, location, bio, skills,
        dateOfBirth, collegeName, areaOfInterest, hobby,
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
  const bioDataSubmitted = !!(profile?.dateOfBirth)

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-fade-in">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Profile</h1>
        {!editing && (isOwner || bioDataSubmitted) && (
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

      {/* Main card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">

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
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1 block">{isOwner ? 'Company Name' : 'Full Name'}</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
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
        {!isOwner && bioDataSubmitted && (
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

        {/* Skills section — hidden for OWNER, shown after bio data submitted */}
        {!isOwner && bioDataSubmitted && (
          <Section title="Skills">
            {editing ? (
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1 block">Comma separated</label>
                <input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder="React, Python, AWS" className={inputClass} />
              </div>
            ) : profile?.skills && profile.skills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map((skill) => (
                  <span key={skill} className="inline-flex items-center rounded-md bg-gray-50 border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700">
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-300">No skills added.</p>
            )}
          </Section>
        )}

        {/* Edit mode: checkbox + save/cancel at bottom */}
        {editing && (isOwner || bioDataSubmitted) && (
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

      {/* Bio Data form — only shown once (before first submission), hidden for OWNER */}
      {!isOwner && !bioDataSubmitted && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50/60">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Bio Data</h3>
          </div>
          <div className="px-6 py-5">
            {bioDataSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-700 mb-4 animate-fade-in">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Bio data saved successfully.
              </div>
            )}
            {bioDataError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700 mb-4">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {bioDataError}
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
                  bioDataConfirmed ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                }`}>
                  {bioDataConfirmed && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={bioDataConfirmed}
                  onChange={(e) => setBioDataConfirmed(e.target.checked)}
                  className="sr-only"
                />
                <span className="text-sm text-gray-600">I confirm that the above details are true and correct.</span>
              </label>

              <div className="flex justify-end">
                <Button
                  disabled={!bioDataConfirmed || bioDataSaving}
                  loading={bioDataSaving}
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
                      setBioDataError(err instanceof Error ? err.message : 'Failed to save bio data')
                    } finally {
                      setBioDataSaving(false)
                    }
                  }}
                >
                  Submit Bio Data
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security — Change Password */}
      <ChangePasswordSection />
    </div>
  )
}

function ChangePasswordSection() {
  const { changePassword } = useAuth()
  const [open, setOpen] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

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

  const handleClose = () => {
    setOpen(false)
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
    setError('')
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
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

      <Modal isOpen={open} onClose={handleClose} title="Change Password" size="sm">
        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <PasswordInput label="Current Password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Enter current password" />
          <PasswordInput label="New Password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Enter new password" />
          <PasswordInput label="Confirm New Password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Re-enter new password" />
          <p className="text-[11px] text-gray-400">
            Must be at least 8 characters with uppercase, lowercase, and a number.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={handleClose}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} loading={saving}>Change Password</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
