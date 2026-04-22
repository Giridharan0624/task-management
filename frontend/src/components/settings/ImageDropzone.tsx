'use client'

import { useCallback, useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2, UploadCloud } from 'lucide-react'
import { uploadFile } from '@/lib/api/uploadApi'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

interface ImageDropzoneProps {
  label: string
  /** Currently-stored URL — empty string for "no image". */
  value: string
  onChange: (next: string) => void
  hint?: string
  /** Accepted MIME types, forwarded to both the input and drop validation. */
  accept?: string
  /** Max upload size in bytes. Default 2 MB — plenty for a logo or favicon. */
  maxBytes?: number
  /** Preview size (object-contain box). Default 96 px. */
  previewSize?: number
  /** Render a subtle checkerboard behind the preview — helps visualize
   *  transparency on logos / favicons. */
  checkered?: boolean
}

// Tiny inline SVG data-URL — a 10px checkerboard tile we can drop onto
// any element without shipping a real asset.
const CHECKER_BG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><rect width='5' height='5' fill='%23e5e7eb'/><rect x='5' y='5' width='5' height='5' fill='%23e5e7eb'/></svg>\")"

/**
 * Drag-and-drop + click-to-select uploader for a single image field. Talks
 * to the existing `uploadFile('attachment')` helper which presigns an S3
 * PUT url under the caller's tenant prefix.
 *
 * Written as a controlled component (`value` / `onChange`) so it slots
 * straight into the Branding form state without any extra glue.
 */
export function ImageDropzone({
  label,
  value,
  onChange,
  hint,
  accept = 'image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon',
  maxBytes = 2 * 1024 * 1024,
  previewSize = 96,
  checkered = false,
}: ImageDropzoneProps) {
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const toast = useToast()

  const handleFile = useCallback(
    async (file: File) => {
      // Reject obvious non-images early. The accept= attr on the input
      // filters most of them but drag-drop bypasses that.
      if (!file.type.startsWith('image/')) {
        toast.error('Please choose an image file.')
        return
      }
      if (file.size > maxBytes) {
        const mb = (maxBytes / (1024 * 1024)).toFixed(1)
        toast.error(`Image is too large — max ${mb} MB.`)
        return
      }

      setUploading(true)
      try {
        const url = await uploadFile(
          'attachment',
          file,
          file.name,
          file.type || 'application/octet-stream'
        )
        onChange(url)
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [maxBytes, onChange, toast]
  )

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) void handleFile(file)
    },
    [handleFile]
  )

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-foreground">{label}</label>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        aria-label={`Upload ${label}`}
        className={cn(
          'group relative flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed p-3 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40',
          uploading && 'pointer-events-none opacity-70'
        )}
      >
        {/* Preview tile */}
        <div
          className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background"
          style={{
            width: previewSize,
            height: previewSize,
            // Checkerboard helps users see transparency on PNG / SVG logos.
            ...(checkered
              ? { backgroundImage: CHECKER_BG, backgroundSize: '10px 10px' }
              : {}),
          }}
        >
          {value ? (
            // Background-image keeps the file contained regardless of aspect.
            // Falls back to an icon on load failure via the onError handler.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt=""
              className="h-full w-full object-contain p-2"
              onError={(e) => {
                ;(e.currentTarget as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <ImagePlus
              className="h-6 w-6 text-muted-foreground/60"
              strokeWidth={1.5}
            />
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
        </div>

        {/* Drop-zone copy */}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <UploadCloud className="h-4 w-4 text-primary" />
            {value
              ? 'Replace image'
              : dragOver
                ? 'Release to upload'
                : 'Drag and drop or click to select'}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {uploading
              ? 'Uploading…'
              : hint ||
                `PNG, JPG, WebP or SVG — up to ${(maxBytes / (1024 * 1024)).toFixed(1)} MB`}
          </p>
        </div>

        {/* Remove button — only when something is uploaded. Stops propagation
            so the outer click doesn't reopen the picker. */}
        {value && !uploading && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange('')
            }}
            aria-label={`Remove ${label}`}
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
            // Allow re-selecting the same filename after a remove.
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
