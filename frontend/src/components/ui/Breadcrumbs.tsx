'use client'

import Link from 'next/link'

interface BreadcrumbItem {
  label: string
  href?: string
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-[12px] text-gray-400 mb-4">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && (
            <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          )}
          {item.href ? (
            <Link href={item.href} className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors font-medium">{item.label}</Link>
          ) : (
            <span className="text-gray-600 dark:text-gray-300 font-semibold">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
