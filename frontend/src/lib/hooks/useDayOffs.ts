'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createDayOff,
  getMyDayOffs,
  getPendingDayOffs,
  getAllDayOffs,
  approveDayOff,
  rejectDayOff,
} from '@/lib/api/dayoffApi'

const dayOffKeys = {
  my: ['dayoffs', 'my'] as const,
  pending: ['dayoffs', 'pending'] as const,
  all: ['dayoffs', 'all'] as const,
}

function useInvalidateAll() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: dayOffKeys.my })
    queryClient.invalidateQueries({ queryKey: dayOffKeys.pending })
    queryClient.invalidateQueries({ queryKey: dayOffKeys.all })
  }
}

export function useMyDayOffs() {
  return useQuery({
    queryKey: dayOffKeys.my,
    queryFn: getMyDayOffs,
  })
}

export function usePendingDayOffs() {
  return useQuery({
    queryKey: dayOffKeys.pending,
    queryFn: getPendingDayOffs,
  })
}

export function useAllDayOffs() {
  return useQuery({
    queryKey: dayOffKeys.all,
    queryFn: getAllDayOffs,
  })
}

export function useCreateDayOff() {
  const invalidateAll = useInvalidateAll()
  return useMutation({
    mutationFn: (data: { startDate: string; endDate: string; reason: string }) =>
      createDayOff(data),
    onSuccess: invalidateAll,
  })
}

export function useApproveDayOff() {
  const invalidateAll = useInvalidateAll()
  return useMutation({
    mutationFn: (requestId: string) => approveDayOff(requestId),
    onSuccess: invalidateAll,
  })
}

export function useRejectDayOff() {
  const invalidateAll = useInvalidateAll()
  return useMutation({
    mutationFn: (requestId: string) => rejectDayOff(requestId),
    onSuccess: invalidateAll,
  })
}
