'use client'

import { useState, useRef } from 'react'
import { Spinner } from './Spinner'
import { ImageCropper } from './ImageCropper'
import { uploadAvatar } from '@/lib/api/uploadApi'

interface AvatarUploadProps {
  currentUrl?: string
  name: string
  size?: 'md' | 'lg' | 'xl'
  onUpload: (url: string) => void
  editable?: boolean
}

const sizeClasses = {
  md: 'w-12 h-12 text-lg',
  lg: 'w-20 h-20 text-2xl',
  xl: 'w-24 h-24 text-3xl',
}

const AVATAR_GRADIENTS = [
  'from-indigo-500 to-purple-600',
  'from-cyan-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-violet-500 to-fuchsia-600',
]

function getGradient(name: string): string {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]
}

export function AvatarUpload({ currentUrl, name, size = 'lg', onUpload, editable = true }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setCropSrc(reader.result as string)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleCropComplete = async (croppedBlob: Blob) => {
    setCropSrc(null)
    setUploading(true)
    try {
      const cdnUrl = await uploadAvatar(croppedBlob)
      onUpload(cdnUrl)
    } catch {
      // Upload failed silently — user can retry
    } finally {
      setUploading(false)
    }
  }

  const initial = (name || '?').charAt(0).toUpperCase()

  return (
    <>
      <div className="relative group">
        {currentUrl ? (
          <img
            src={currentUrl}
            alt={name}
            className={`${sizeClasses[size]} rounded-2xl object-cover shadow-sm ring-2 ring-white dark:ring-[#1a1c25]`}
          />
        ) : (
          <div className={`${sizeClasses[size]} rounded-2xl bg-gradient-to-br ${getGradient(name)} flex items-center justify-center shadow-sm ring-2 ring-white dark:ring-[#1a1c25]`}>
            <span className="text-white font-bold drop-shadow-sm">{initial}</span>
          </div>
        )}

        {editable && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
            >
              {uploading ? (
                <Spinner size="sm" className="text-white" />
              ) : (
                <svg className="w-6 h-6 text-white drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </>
        )}
      </div>

      {cropSrc && (
        <ImageCropper
          imageSrc={cropSrc}
          isOpen={true}
          onClose={() => setCropSrc(null)}
          onCropComplete={handleCropComplete}
          cropShape="round"
          aspect={1}
        />
      )}
    </>
  )
}

/* Simple avatar display (no upload) */
export function Avatar({ url, name, size = 'md' }: { url?: string; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const classes = {
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-lg',
  }

  const radiusClass = size === 'sm' ? 'rounded-lg' : 'rounded-xl'

  if (url) {
    return <img src={url} alt={name} className={`${classes[size]} ${radiusClass} object-cover`} />
  }

  return (
    <div className={`${classes[size]} ${radiusClass} bg-gradient-to-br ${getGradient(name)} flex items-center justify-center flex-shrink-0`}>
      <span className="text-white font-bold drop-shadow-sm">{(name || '?').charAt(0).toUpperCase()}</span>
    </div>
  )
}
