import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { join } from 'path'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  const logoData = readFileSync(join(process.cwd(), 'public', 'logo.png'))
  const base64 = logoData.toString('base64')
  const src = `data:image/png;base64,${base64}`

  return new ImageResponse(
    (
      <img src={src} width={32} height={32} style={{ borderRadius: 8 }} />
    ),
    { ...size }
  )
}
