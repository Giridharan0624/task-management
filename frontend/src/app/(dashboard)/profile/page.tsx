'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { updateProfile, getProfile } from '@/lib/api/userApi'
import type { User } from '@/types/user'

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-red-100 text-red-800',
  MEMBER: 'bg-blue-100 text-blue-800',
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1">{label}</p>
      <p className="text-sm text-gray-900">{value || '-'}</p>
    </div>
  )
}

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const [profile, setProfile] = useState<User | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [designation, setDesignation] = useState('')
  const [department, setDepartment] = useState('')
  const [location, setLocation] = useState('')
  const [bio, setBio] = useState('')
  const [skillsText, setSkillsText] = useState('')

  useEffect(() => {
    getProfile().then((p) => {
      setProfile(p)
      setName(p.name || '')
      setPhone(p.phone || '')
      setDesignation(p.designation || '')
      setDepartment(p.department || '')
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
      const updated = await updateProfile({ name, phone, designation, department, location, bio, skills })
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
      setDepartment(profile.department || '')
      setLocation(profile.location || '')
      setBio(profile.bio || '')
      setSkillsText((profile.skills ?? []).join(', '))
    }
    setEditing(false)
  }

  if (!user) return null

  const displayProfile = profile || user

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Profile</h1>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-2xl">
              {(displayProfile.name || displayProfile.email).charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900">{displayProfile.name || displayProfile.email}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-500">{displayProfile.email}</span>
              <Badge className={ROLE_COLORS[displayProfile.systemRole]}>{displayProfile.systemRole}</Badge>
              {profile?.employeeId && (
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-mono font-medium text-gray-700">
                  {profile.employeeId}
                </span>
              )}
            </div>
            {(profile?.designation || profile?.department) && (
              <p className="text-sm text-gray-500 mt-0.5">
                {profile.designation}{profile.designation && profile.department ? ' · ' : ''}{profile.department}
              </p>
            )}
          </div>
          {!editing && (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              Edit Profile
            </Button>
          )}
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm mb-4">
            Profile updated successfully!
          </div>
        )}

        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                <input
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="Software Engineer"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department <span className="text-xs text-gray-400 font-normal">(set by admin)</span>
                </label>
                <input
                  value={profile?.department || ''}
                  disabled
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-500 cursor-not-allowed"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Chennai, India"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Skills <span className="font-normal text-gray-400">(comma separated)</span>
              </label>
              <input
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                placeholder="React, Python, AWS, TypeScript"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Bio */}
            {profile?.bio && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1">About</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{profile.bio}</p>
              </div>
            )}

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Employee ID" value={profile?.employeeId} />
              <Field label="Email" value={displayProfile.email} />
              <Field label="Phone" value={profile?.phone} />
              <Field label="Designation" value={profile?.designation} />
              <Field label="Department" value={profile?.department} />
              <Field label="Location" value={profile?.location} />
              <Field label="Joined" value={displayProfile.createdAt ? new Date(displayProfile.createdAt).toLocaleDateString() : undefined} />
            </div>

            {/* Skills */}
            {profile?.skills && profile.skills.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-2">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.skills.map((skill) => (
                    <span key={skill} className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
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
  )
}
