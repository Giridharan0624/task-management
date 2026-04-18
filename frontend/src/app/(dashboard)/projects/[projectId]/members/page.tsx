'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useProject } from '@/lib/hooks/useProjects'
import { useAuth } from '@/lib/auth/AuthProvider'
import { usePermission } from '@/lib/hooks/usePermission'
import { MemberList } from '@/components/project/MemberList'
import { Spinner } from '@/components/ui/Spinner'
import type { ProjectRole } from '@/types/user'
import { useEffect } from 'react'

export default function MembersPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const router = useRouter()
  const { user } = useAuth()

  const { data: project, isLoading, error } = useProject(projectId)

  const currentMember = project?.members?.find((m) => m.userId === user?.userId)
  const projectRole = currentMember?.projectRole as ProjectRole | undefined
  const permissions = usePermission(projectRole, user?.systemRole)

  // Redirect non-admins away from this page
  useEffect(() => {
    if (!isLoading && project && !permissions.canManageMembers) {
      router.replace(`/projects/${projectId}`)
    }
  }, [isLoading, project, permissions.canManageMembers, projectId, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="rounded-lg bg-red-50 p-6 text-center text-red-700">
        Failed to load project.
      </div>
    )
  }

  if (!permissions.canManageMembers) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/projects/${projectId}`}
          className="rounded-lg p-2 text-muted-foreground/70 hover:text-foreground/85 hover:bg-muted transition-colors"
          aria-label="Back to project"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Members</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{project.name}</p>
        </div>
      </div>

      <MemberList
        projectId={projectId}
        members={project.members ?? []}
        canManageMembers={permissions.canManageMembers}
      />
    </div>
  )
}
