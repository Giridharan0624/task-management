'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getComments, createComment } from '@/lib/api/commentApi'
import type { ProgressComment } from '@/types/comment'

export function useComments(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ['comments', taskId],
    queryFn: () => getComments(projectId, taskId),
    enabled: !!taskId,
    staleTime: 15000,
    refetchInterval: 15000,
  })
}

export function useCreateComment(projectId: string, taskId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (message: string) => createComment(projectId, taskId, message),
    onMutate: async (message) => {
      await queryClient.cancelQueries({ queryKey: ['comments', taskId] })
      const previous = queryClient.getQueryData<ProgressComment[]>(['comments', taskId])

      const optimistic: ProgressComment = {
        commentId: `temp-${Date.now()}`,
        taskId,
        projectId,
        authorId: '',
        message,
        createdAt: new Date().toISOString(),
      }
      queryClient.setQueryData<ProgressComment[]>(['comments', taskId], (old) =>
        old ? [...old, optimistic] : [optimistic]
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['comments', taskId], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] })
    },
  })
}
