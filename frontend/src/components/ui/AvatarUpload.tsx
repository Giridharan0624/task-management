'use client'

import { useState, useRef } from 'react'
import { Spinner } from './Spinner'

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

export function AvatarUpload({ currentUrl, name, size = 'lg', onUpload, editable = true }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !cloudName || !uploadPreset) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', uploadPreset)
      formData.append('folder', 'taskflow-avatars')

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.secure_url) {
        onUpload(data.secure_url)
      }
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  const initial = (name || '?').charAt(0).toUpperCase()

  return (
    <div className="relative group">
      {currentUrl ? (
        <img
          src={currentUrl}
          alt={name}
          className={`${sizeClasses[size]} rounded-full object-cover shadow-xl border-4 border-white`}
        />
      ) : (
        <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl border-4 border-white`}>
          <span className="text-white font-bold">{initial}</span>
        </div>
      )}

      {editable && cloudName && uploadPreset && (
        <>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
          >
            {uploading ? (
              <Spinner size="sm" className="text-white" />
            ) : (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </>
      )}
    </div>
  )
}

/* Simple avatar display (no upload) */
export function Avatar({ url, name, size = 'md' }: { url?: string; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const classes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-lg',
  }

  if (url) {
    return <img src={url} alt={name} className={`${classes[size]} rounded-full object-cover`} />
  }

  return (
    <div className={`${classes[size]} rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0`}>
      <span className="text-white font-semibold">{(name || '?').charAt(0).toUpperCase()}</span>
    </div>
  )
}
