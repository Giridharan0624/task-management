'use client'

import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { DatePicker } from '@/components/ui/DatePicker'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import type { User } from '@/types/user'
import type { UpdateProfileData } from '@/lib/api/userApi'

interface ProfileEditDialogProps {
  open: boolean
  onClose: () => void
  profile: User
  isOwner: boolean
  onSave: (data: UpdateProfileData) => Promise<void>
  isSaving: boolean
}

export function ProfileEditDialog({
  open,
  onClose,
  profile,
  isOwner,
  onSave,
  isSaving,
}: ProfileEditDialogProps) {
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [phone, setPhone] = useState('')
  const [designation, setDesignation] = useState('')
  const [location, setLocation] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [collegeName, setCollegeName] = useState('')
  const [areaOfInterest, setAreaOfInterest] = useState('')
  const [hobby, setHobby] = useState('')
  const [skillsText, setSkillsText] = useState('')
  const [error, setError] = useState('')

  // Seed form state from profile whenever the dialog opens
  useEffect(() => {
    if (!open) return
    setName(profile.name || '')
    setBio(profile.bio || '')
    setPhone(profile.phone || '')
    setDesignation(profile.designation || '')
    setLocation(profile.location || '')
    setDateOfBirth(profile.dateOfBirth || '')
    setCollegeName(profile.collegeName || '')
    setAreaOfInterest(profile.areaOfInterest || '')
    setHobby(profile.hobby || '')
    setSkillsText((profile.skills ?? []).join(', '))
    setError('')
  }, [open, profile])

  const handleSave = async () => {
    setError('')
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    const skills = skillsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    try {
      await onSave({
        name,
        bio,
        phone,
        designation,
        location,
        dateOfBirth,
        collegeName,
        areaOfInterest,
        hobby,
        skills,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    }
  }

  const nameLabel = isOwner ? 'Company name' : 'Full name'

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isOwner ? 'Edit company profile' : 'Edit profile'}</DialogTitle>
          <DialogDescription>
            Update your details. Changes save to your account after you confirm.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isOwner ? (
          // OWNER has a simpler form — company name only. The Employee ID
          // prefix lives on the Organization settings page.
          <div className="flex flex-col gap-4">
            <Input
              label={nameLabel}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your company name"
            />
          </div>
        ) : (
          <Tabs defaultValue="basic" className="w-full">
            <TabsList>
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="contact">Contact & work</TabsTrigger>
              <TabsTrigger value="personal">Personal</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="mt-4 space-y-4">
              <Input
                label={nameLabel}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
              />
              <Textarea
                label="Bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Write a short bio..."
                rows={3}
              />
              <Input
                label="Skills"
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                placeholder="React, Python, AWS"
                hint="Comma separated"
              />
            </TabsContent>

            <TabsContent value="contact" className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 stagger-up">
              <Input
                label="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
              <Input
                label="Designation"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="Software Engineer"
              />
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">
                  Department
                </label>
                <Input
                  value={profile.department || ''}
                  disabled
                  hint="Managed by admins"
                />
              </div>
              <Input
                label="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Chennai, India"
              />
            </TabsContent>

            <TabsContent value="personal" className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 stagger-up">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-foreground">
                  Date of birth
                </label>
                <DatePicker
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <Input
                label="College / university"
                value={collegeName}
                onChange={(e) => setCollegeName(e.target.value)}
                placeholder="Your institution"
              />
              <Input
                label="Area of interest"
                value={areaOfInterest}
                onChange={(e) => setAreaOfInterest(e.target.value)}
                placeholder="Web development, AI, design..."
              />
              <Input
                label="Hobby"
                value={hobby}
                onChange={(e) => setHobby(e.target.value)}
                placeholder="Reading, music, hiking..."
              />
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            loading={isSaving}
            disabled={!name.trim()}
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
