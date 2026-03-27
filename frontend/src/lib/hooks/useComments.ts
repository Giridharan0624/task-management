'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getComments, createComment } from '@/lib/api/commentApi'

export function useComments(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ['comments', taskId],
    queryFn: () => getComments(projectId, taskId),
    enabled: !!taskId,
  })
}

export function useCreateComment(projectId: string, taskId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (message: string) => createComment(projectId, taskId, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] })
    },
  })
}
