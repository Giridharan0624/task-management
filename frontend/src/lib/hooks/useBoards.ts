import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getBoards,
  getBoard,
  createBoard,
  deleteBoard,
  type CreateBoardData,
} from '@/lib/api/boardApi'

export const boardKeys = {
  all: ['boards'] as const,
  detail: (boardId: string) => ['boards', boardId] as const,
}

export function useBoards() {
  return useQuery({
    queryKey: boardKeys.all,
    queryFn: getBoards,
  })
}

export function useBoard(boardId: string) {
  return useQuery({
    queryKey: boardKeys.detail(boardId),
    queryFn: () => getBoard(boardId),
    enabled: !!boardId,
  })
}

export function useCreateBoard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateBoardData) => createBoard(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.all })
    },
  })
}

export function useDeleteBoard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (boardId: string) => deleteBoard(boardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.all })
    },
  })
}
