import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  assignTask,
  type CreateTaskData,
  type UpdateTaskData,
} from '@/lib/api/taskApi'

export const taskKeys = {
  all: (projectId: string) => ['tasks', projectId] as const,
}

export function useTasks(projectId: string) {
  return useQuery({
    queryKey: taskKeys.all(projectId),
    queryFn: () => getTasks(projectId),
    enabled: !!projectId,
  })
}

export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTaskData) => createTask(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all(projectId) })
    },
  })
}

export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: UpdateTaskData }) =>
      updateTask(projectId, taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all(projectId) })
    },
  })
}

export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => deleteTask(projectId, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all(projectId) })
    },
  })
}

export function useAssignTask(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, assignedTo }: { taskId: string; assignedTo: string[] }) =>
      assignTask(projectId, taskId, assignedTo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all(projectId) })
    },
  })
}
