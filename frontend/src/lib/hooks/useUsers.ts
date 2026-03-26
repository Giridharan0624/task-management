'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, updateUserRole, getUserProgress } from '@/lib/api/userApi'

const userKeys = {
  all: ['users'] as const,
  progress: (userId: string) => ['users', userId, 'progress'] as const,
}

export function useUsers() {
  return useQuery({
    queryKey: userKeys.all,
    queryFn: getUsers,
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, systemRole }: { userId: string; systemRole: string }) =>
      updateUserRole(userId, systemRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all })
    },
  })
}

export function useUserProgress(userId: string) {
  return useQuery({
    queryKey: userKeys.progress(userId),
    queryFn: () => getUserProgress(userId),
    enabled: !!userId,
  })
}
