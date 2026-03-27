'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, updateUserRole, getUserProgress, createUser, deleteUser, getMyTasks } from '@/lib/api/userApi'

const userKeys = {
  all: ['users'] as const,
  progress: (userId: string) => ['users', userId, 'progress'] as const,
  myTasks: ['my-tasks'] as const,
}

export function useUsers() {
  return useQuery({
    queryKey: userKeys.all,
    queryFn: getUsers,
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { email: string; name: string; password: string; systemRole: string }) =>
      createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all })
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all })
    },
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

export function useMyTasks() {
  return useQuery({
    queryKey: userKeys.myTasks,
    queryFn: getMyTasks,
  })
}
