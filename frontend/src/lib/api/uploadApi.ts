import { apiClient } from './client'

interface PresignResponse {
  uploadUrl: string
  fileUrl: string
  key: string
}

/**
 * Get a presigned URL for uploading a file to S3.
 * @param type - 'avatar' or 'attachment'
 * @param filename - Original filename (e.g., 'photo.jpg')
 * @param contentType - MIME type (e.g., 'image/jpeg')
 */
export async function getPresignedUrl(
  type: 'avatar' | 'attachment',
  filename: string,
  contentType: string
): Promise<PresignResponse> {
  return apiClient.get<PresignResponse>(
    `/uploads/presign?type=${type}&filename=${encodeURIComponent(filename)}&contentType=${encodeURIComponent(contentType)}`
  )
}

/**
 * Upload a file to S3 using a presigned URL.
 * Returns the CDN URL of the uploaded file.
 */
export async function uploadFile(
  type: 'avatar' | 'attachment',
  file: Blob,
  filename: string,
  contentType: string
): Promise<string> {
  // Step 1: Get presigned URL from our API
  const { uploadUrl, fileUrl } = await getPresignedUrl(type, filename, contentType)

  // Step 2: Upload directly to S3 (no auth header — the URL itself is the auth)
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': contentType,
    },
  })

  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${res.statusText}`)
  }

  // Step 3: Return the CDN URL
  return fileUrl
}

/**
 * Upload an avatar image to S3.
 * Convenience wrapper around uploadFile.
 */
export async function uploadAvatar(blob: Blob): Promise<string> {
  return uploadFile('avatar', blob, 'avatar.jpg', 'image/jpeg')
}

/**
 * Upload a task attachment to S3.
 */
export async function uploadAttachment(file: File): Promise<string> {
  return uploadFile('attachment', file, file.name, file.type || 'application/octet-stream')
}
