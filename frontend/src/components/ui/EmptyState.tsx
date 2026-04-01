'use client'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

const defaultIcon = (
  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
  </svg>
)

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-14 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-50 mx-auto mb-4 flex items-center justify-center">
        {icon || defaultIcon}
      </div>
      <p className="text-[14px] font-bold text-gray-800 mb-1">{title}</p>
      {description && <p className="text-[12px] text-gray-400 mb-5 max-w-xs mx-auto">{description}</p>}
      {action}
    </div>
  )
}
