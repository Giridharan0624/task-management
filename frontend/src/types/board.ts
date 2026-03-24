import type { BoardMember } from './user'

export interface Board {
  boardId: string
  name: string
  description?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  members?: BoardMember[]
}
