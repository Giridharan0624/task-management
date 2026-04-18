import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getProjects,
  getProject,
  getProjectStatus,
  createProject,
  updateProject,
  deleteProject,
  type CreateProjectData,
  type UpdateProjectData,
} from '@/lib/api/projectApi'

export const projectKeys = {
  all: ['projects'] as const,
  detail: (projectId: string) => ['projects', projectId] as const,
  status: (projectId: string) => ['projects', projectId, 'status'] as const,
}

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: getProjects,
    staleTime: 30000,
    refetchInterval: 30000,
  })
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: projectKeys.detail(projectId),
    queryFn: () => getProject(projectId),
    enabled: !!projectId,
    staleTime: 30000,
    refetchInterval: 30000,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateProjectData) => createProject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateProjectData) => updateProject(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useProjectStatus(
  projectId: string,
  options: { enabled?: boolean } = {}
) {
  const enabled = options.enabled ?? true
  return useQuery({
    queryKey: projectKeys.status(projectId),
    queryFn: () => getProjectStatus(projectId),
    enabled: enabled && !!projectId,
    staleTime: 30000,
    refetchInterval: enabled ? 30000 : false,
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (projectId: string) => deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}
