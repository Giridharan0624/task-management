'use client'

import { StatCardsGrid, type StatCardItem } from '@/components/ui/StatCardsGrid'

interface UserStatStripProps {
  total: number
  management: number
  members: number
  online: number
  showManagement: boolean
}

export function UserStatStrip({
  total,
  management,
  members,
  online,
  showManagement,
}: UserStatStripProps) {
  const items: StatCardItem[] = [
    {
      key: 'total',
      label: 'Total',
      value: total,
      accent: 'text-indigo-700',
    },
    ...(showManagement
      ? [
          {
            key: 'management',
            label: 'Management',
            value: management,
            accent: 'text-violet-700',
          } as StatCardItem,
        ]
      : []),
    {
      key: 'members',
      label: 'Members',
      value: members,
      accent: 'text-blue-700',
    },
    {
      key: 'online',
      label: 'Online now',
      value: online,
      accent: online > 0 ? 'text-emerald-700' : 'text-muted-foreground',
      live: online > 0,
    },
  ]

  return <StatCardsGrid items={items} columns={items.length === 4 ? 4 : 3} />
}
