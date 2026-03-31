import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'linear-gradient(135deg, #4f46e5, #6366f1, #7c3aed)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg viewBox="0 0 32 32" fill="none" width="20" height="20">
          <path d="M10 7v18" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M4 7h16l4 4" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 16h8l3 3" stroke="rgba(255,255,255,0.6)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
