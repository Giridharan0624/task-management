import type { Metadata, Viewport } from 'next'
import { Lexend } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const lexend = Lexend({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Task Management',
  description: 'Serverless task management system',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={lexend.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
