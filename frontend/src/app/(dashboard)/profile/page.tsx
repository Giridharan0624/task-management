'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { updateProfile, getProfile } from '@/lib/api/userApi'
import { AvatarUpload } from '@/components/ui/AvatarUpload'
import type { User } from '@/types/user'

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-800',
  CEO: 'bg-violet-100 text-violet-800',
  MD: 'bg-fuchsia-100 text-fuchsia-800',
  ADMIN: 'bg-red-100 text-red-800',
  MEMBER: 'bg-blue-100 text-blue-800',
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 flex items-start gap-3">
      <div className="h-9 w-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 shadow-sm">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-900 mt-0.5">{value || 'Not set'}</p>
      </div>
    </div>
  )
}

const icons = {
  id: <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" /></svg>,
  email: <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  phone: <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
  role: <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
  dept: <svg className="w-4 h-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  loc: <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  cal: <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
}

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const [profile, setProfile] = useState<User | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [designation, setDesignation] = useState('')
  const [location, setLocation] = useState('')
  const [bio, setBio] = useState('')
  const [skillsText, setSkillsText] = useState('')

  useEffect(() => {
    getProfile().then((p) => {
      setProfile(p)
      setName(p.name || '')
      setPhone(p.phone || '')
      setDesignation(p.designation || '')
      setLocation(p.location || '')
      setBio(p.bio || '')
      setSkillsText((p.skills ?? []).join(', '))
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSuccess(false)
    try {
      const skills = skillsText.split(',').map((s) => s.trim()).filter(Boolean)
      const updated = await updateProfile({ name, phone, designation, location, bio, skills })
      setProfile(updated)
      updateUser({ name })
      setEditing(false)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      alert('Failed to update profile')
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
  }

  if (!user) return null
  const dp = profile || user

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-center gap-5 mb-5">
            <AvatarUpload
              currentUrl={profile?.avatarUrl}
              name={dp.name || dp.email}
              size="xl"
              editable={!editing}
              onUpload={async (url) => {
                const updated = await updateProfile({ avatarUrl: url })
                setProfile(updated)
              }}
            />
            <div className="flex-1 pb-1">
              <h1 className="text-xl font-bold text-gray-900">{dp.name || dp.email}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge className={ROLE_COLORS[dp.systemRole]}>{dp.systemRole}</Badge>
                {profile?.employeeId && (
                  <span className="inline-flex items-center rounded-lg bg-gray-100 px-2.5 py-0.5 text-xs font-mono font-semibold text-gray-600">{profile.employeeId}</span>
                )}
                {(profile?.designation || profile?.department) && (
                  <span className="text-xs text-gray-400">
                    {profile?.designation}{profile?.designation && profile?.department ? ' · ' : ''}{profile?.department}
                  </span>
                )}
              </div>
            </div>
            {!editing && (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Edit
              </Button>
            )}
          </div>

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm mb-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Profile updated successfully!
            </div>
          )}

          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Full Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Phone</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Designation</label>
                  <input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Software Engineer"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                    Department <span className="font-normal text-gray-400 normal-case">(set by admin)</span>
                  </label>
                  <input value={profile?.department || ''} disabled
                    className="w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-2.5 text-sm text-gray-400 cursor-not-allowed" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Location</label>
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Chennai, India"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Bio</label>
                <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 outline-none resize-none transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Skills <span className="font-normal text-gray-400 normal-case">(comma separated)</span>
                </label>
                <input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder="React, Python, AWS"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:border-indigo-500 outline-none transition-all" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
                <Button variant="primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Bio */}
              {profile?.bio && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">About</p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
                </div>
              )}

              {/* Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoCard icon={icons.id} label="Employee ID" value={profile?.employeeId} />
                <InfoCard icon={icons.email} label="Email" value={dp.email} />
                <InfoCard icon={icons.phone} label="Phone" value={profile?.phone} />
                <InfoCard icon={icons.role} label="Designation" value={profile?.designation} />
                <InfoCard icon={icons.dept} label="Department" value={profile?.department} />
                <InfoCard icon={icons.loc} label="Location" value={profile?.location} />
                <InfoCard icon={icons.cal} label="Joined" value={dp.createdAt ? new Date(dp.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : undefined} />
              </div>

              {/* Skills */}
              {profile?.skills && profile.skills.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Skills</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills.map((skill) => (
                      <span key={skill} className="inline-flex items-center rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
