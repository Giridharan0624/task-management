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
import type { Task } from '@/types/task'

export const taskKeys = {
  all: (projectId: string) => ['tasks', projectId] as const,
}

/** Invalidate all task-related queries so every page stays in sync */
function invalidateAllTasks(queryClient: ReturnType<typeof useQueryClient>, projectId?: string) {
  if (projectId) queryClient.invalidateQueries({ queryKey: taskKeys.all(projectId) })
  queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
  queryClient.invalidateQueries({ queryKey: ['projects'] })
}

export function useTasks(projectId: string) {
  return useQuery({
    queryKey: taskKeys.all(projectId),
    queryFn: () => getTasks(projectId),
    enabled: !!projectId,
    staleTime: 10000,
    refetchInterval: 10000,
  })
}

export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTaskData) => createTask(projectId, data),
    onSuccess: (newTask) => {
      // Optimistically add to cache immediately
      if (newTask) {
        queryClient.setQueryData<Task[]>(taskKeys.all(projectId), (old) =>
          old ? [...old, newTask] : [newTask]
        )
      }
      invalidateAllTasks(queryClient, projectId)
    },
  })
}

export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: UpdateTaskData }) =>
      updateTask(projectId, taskId, data),
    onMutate: async ({ taskId, data }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all(projectId) })
      const previous = queryClient.getQueryData<Task[]>(taskKeys.all(projectId))

      // Optimistically update the task in cache
      queryClient.setQueryData<Task[]>(taskKeys.all(projectId), (old) =>
        old?.map((task) =>
          task.taskId === taskId ? { ...task, ...data, updatedAt: new Date().toISOString() } as Task : task
        )
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(taskKeys.all(projectId), context.previous)
      }
    },
    onSettled: () => invalidateAllTasks(queryClient, projectId),
  })
}

export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) => deleteTask(projectId, taskId),
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all(projectId) })
      const previous = queryClient.getQueryData<Task[]>(taskKeys.all(projectId))

      // Optimistically remove from cache
      queryClient.setQueryData<Task[]>(taskKeys.all(projectId), (old) =>
        old?.filter((task) => task.taskId !== taskId)
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(taskKeys.all(projectId), context.previous)
      }
    },
    onSettled: () => invalidateAllTasks(queryClient, projectId),
  })
}

export function useAssignTask(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, assignedTo }: { taskId: string; assignedTo: string[] }) =>
      assignTask(projectId, taskId, assignedTo),
    onMutate: async ({ taskId, assignedTo }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all(projectId) })
      const previous = queryClient.getQueryData<Task[]>(taskKeys.all(projectId))

      // Optimistically update assignment
      queryClient.setQueryData<Task[]>(taskKeys.all(projectId), (old) =>
        old?.map((task) =>
          task.taskId === taskId ? { ...task, assignedTo, updatedAt: new Date().toISOString() } : task
        )
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(taskKeys.all(projectId), context.previous)
      }
    },
    onSettled: () => invalidateAllTasks(queryClient, projectId),
  })
}
