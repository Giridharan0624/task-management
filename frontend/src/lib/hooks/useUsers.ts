'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, getAdmins, updateUserRole, updateUserDepartment, getUserProgress, createUser, deleteUser, getMyTasks, getBirthdays } from '@/lib/api/userApi'
import type { User } from '@/types/user'

const userKeys = {
  all: ['users'] as const,
  progress: (userId: string) => ['users', userId, 'progress'] as const,
  myTasks: ['my-tasks'] as const,
}

export function useUsers() {
  return useQuery({
    queryKey: userKeys.all,
    queryFn: getUsers,
    retry: 1,
    staleTime: 30000,
    refetchInterval: 30000,
  })
}

export function useAdmins() {
  return useQuery({
    queryKey: ['admins'],
    queryFn: getAdmins,
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { email: string; name: string; systemRole: string; department: string; dateOfJoining?: string }) =>
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
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: userKeys.all })
      const previous = queryClient.getQueryData<User[]>(userKeys.all)
      queryClient.setQueryData<User[]>(userKeys.all, (old) =>
        old?.filter((u) => u.userId !== userId)
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(userKeys.all, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, systemRole }: { userId: string; systemRole: string }) =>
      updateUserRole(userId, systemRole),
    onMutate: async ({ userId, systemRole }) => {
      await queryClient.cancelQueries({ queryKey: userKeys.all })
      const previous = queryClient.getQueryData<User[]>(userKeys.all)
      queryClient.setQueryData<User[]>(userKeys.all, (old) =>
        old?.map((u) => (u.userId === userId ? { ...u, systemRole } as User : u))
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(userKeys.all, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  })
}

export function useUpdateUserDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, department }: { userId: string; department: string }) =>
      updateUserDepartment(userId, department),
    onMutate: async ({ userId, department }) => {
      await queryClient.cancelQueries({ queryKey: userKeys.all })
      const previous = queryClient.getQueryData<User[]>(userKeys.all)
      queryClient.setQueryData<User[]>(userKeys.all, (old) =>
        old?.map((u) => (u.userId === userId ? { ...u, department } : u))
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(userKeys.all, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
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
    staleTime: 10000,
    refetchInterval: 10000,
  })
}

export function useBirthdays() {
  return useQuery({
    queryKey: ['birthdays'],
    queryFn: getBirthdays,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  })
}
