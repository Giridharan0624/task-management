'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createDayOff,
  getMyDayOffs,
  getPendingDayOffs,
  getAllDayOffs,
  approveDayOff,
  rejectDayOff,
  cancelDayOff,
} from '@/lib/api/dayoffApi'
import type { DayOffRequest, DayOffStatus } from '@/types/dayoff'

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

/** Optimistically update a day-off request's status across all cached lists */
function useOptimisticStatusUpdate(newStatus: DayOffStatus) {
  const queryClient = useQueryClient()
  const invalidateAll = useInvalidateAll()

  return {
    onMutate: async (requestId: string) => {
      await queryClient.cancelQueries({ queryKey: ['dayoffs'] })
      const prevMy = queryClient.getQueryData<DayOffRequest[]>(dayOffKeys.my)
      const prevPending = queryClient.getQueryData<DayOffRequest[]>(dayOffKeys.pending)
      const prevAll = queryClient.getQueryData<DayOffRequest[]>(dayOffKeys.all)

      const updateList = (list: DayOffRequest[] | undefined) =>
        list?.map((d) =>
          d.requestId === requestId
            ? { ...d, status: newStatus, updatedAt: new Date().toISOString() }
            : d
        )

      queryClient.setQueryData(dayOffKeys.my, updateList(prevMy))
      queryClient.setQueryData(dayOffKeys.pending, updateList(prevPending))
      queryClient.setQueryData(dayOffKeys.all, updateList(prevAll))

      return { prevMy, prevPending, prevAll }
    },
    onError: (_err: unknown, _vars: string, context: { prevMy?: DayOffRequest[]; prevPending?: DayOffRequest[]; prevAll?: DayOffRequest[] } | undefined) => {
      if (context) {
        queryClient.setQueryData(dayOffKeys.my, context.prevMy)
        queryClient.setQueryData(dayOffKeys.pending, context.prevPending)
        queryClient.setQueryData(dayOffKeys.all, context.prevAll)
      }
    },
    onSettled: invalidateAll,
  }
}

export function useMyDayOffs() {
  return useQuery({
    queryKey: dayOffKeys.my,
    queryFn: getMyDayOffs,
    staleTime: 30000,
    refetchInterval: 30000,
  })
}

export function usePendingDayOffs() {
  return useQuery({
    queryKey: dayOffKeys.pending,
    queryFn: getPendingDayOffs,
    staleTime: 30000,
    refetchInterval: 30000,
  })
}

export function useAllDayOffs() {
  return useQuery({
    queryKey: dayOffKeys.all,
    queryFn: getAllDayOffs,
    staleTime: 30000,
    refetchInterval: 30000,
  })
}

export function useCreateDayOff() {
  const queryClient = useQueryClient()
  const invalidateAll = useInvalidateAll()
  return useMutation({
    mutationFn: (data: { startDate: string; endDate: string; reason: string }) =>
      createDayOff(data),
    onSuccess: (newRequest) => {
      if (newRequest) {
        queryClient.setQueryData<DayOffRequest[]>(dayOffKeys.my, (old) =>
          old ? [newRequest, ...old] : [newRequest]
        )
      }
      invalidateAll()
    },
  })
}

export function useApproveDayOff() {
  return useMutation({
    mutationFn: (requestId: string) => approveDayOff(requestId),
    ...useOptimisticStatusUpdate('APPROVED'),
  })
}

export function useRejectDayOff() {
  return useMutation({
    mutationFn: (requestId: string) => rejectDayOff(requestId),
    ...useOptimisticStatusUpdate('REJECTED'),
  })
}

export function useCancelDayOff() {
  return useMutation({
    mutationFn: (requestId: string) => cancelDayOff(requestId),
    ...useOptimisticStatusUpdate('CANCELLED'),
  })
}
