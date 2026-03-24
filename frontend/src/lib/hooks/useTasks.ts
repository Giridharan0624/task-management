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
  all: (boardId: string) => ['tasks', boardId] as const,
}

export function useTasks(boardId: string) {
  return useQuery({
    queryKey: taskKeys.all(boardId),
    queryFn: () => getTasks(boardId),
    enabled: !!boardId,
  })
}

export function useCreateTask(boardId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTaskData) => createTask(boardId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all(boardId) })
    },
  })
}

export function useUpdateTask(boardId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: UpdateTaskData }) =>
      updateTask(boardId, taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all(boardId) })
    },
  })
}

export function useDeleteTask(boardId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => deleteTask(boardId, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all(boardId) })
    },
  })
}

export function useAssignTask(boardId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, assignedTo }: { taskId: string; assignedTo: string }) =>
      assignTask(boardId, taskId, assignedTo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all(boardId) })
    },
  })
}
