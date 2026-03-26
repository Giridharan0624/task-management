export type SystemRole = 'OWNER' | 'ADMIN' | 'MEMBER'
export type BoardRole = 'ADMIN' | 'MEMBER'

export interface User {
  userId: string
  email: string
  name: string
  systemRole: SystemRole
  createdAt: string
  updatedAt: string
}

export interface BoardMember {
  boardId: string
  userId: string
  boardRole: BoardRole
  joinedAt: string
  user?: User
}
