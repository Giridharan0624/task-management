export type SystemRole = 'ADMIN' | 'MEMBER' | 'VIEWER'
export type BoardRole = 'ADMIN' | 'MEMBER' | 'VIEWER'

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
