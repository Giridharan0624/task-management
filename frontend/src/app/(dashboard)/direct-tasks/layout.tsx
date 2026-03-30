import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Direct Tasks' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
