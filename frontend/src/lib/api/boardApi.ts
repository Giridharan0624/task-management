import { apiClient } from './client'
import type { Board } from '@/types/board'
import type { BoardMember, BoardRole } from '@/types/user'

export interface CreateBoardData {
  name: string
  description?: string
}

export interface AddMemberData {
  userId: string
  boardRole: BoardRole
}

export async function getBoards(): Promise<Board[]> {
  return apiClient.get<Board[]>('/boards')
}

export async function getBoard(boardId: string): Promise<Board> {
  return apiClient.get<Board>(`/boards/${boardId}`)
}

export async function createBoard(data: CreateBoardData): Promise<Board> {
  return apiClient.post<Board>('/boards', data)
}

export async function deleteBoard(boardId: string): Promise<void> {
  return apiClient.del<void>(`/boards/${boardId}`)
}

export async function addMember(boardId: string, data: AddMemberData): Promise<BoardMember> {
  return apiClient.post<BoardMember>(`/boards/${boardId}/members`, data)
}

export async function removeMember(boardId: string, userId: string): Promise<void> {
  return apiClient.del<void>(`/boards/${boardId}/members/${userId}`)
}

export async function updateMemberRole(
  boardId: string,
  userId: string,
  boardRole: BoardRole
): Promise<BoardMember> {
  return apiClient.put<BoardMember>(`/boards/${boardId}/members/${userId}`, { boardRole })
}
