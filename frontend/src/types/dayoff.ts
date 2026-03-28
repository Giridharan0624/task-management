export type DayOffStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'N/A'

export interface DayOffRequest {
  requestId: string
  userId: string
  userName: string
  employeeId?: string
  startDate: string
  endDate: string
  reason: string
  status: DayOffStatus
  teamLeadId?: string
  teamLeadName?: string
  teamLeadStatus: ApprovalStatus
  adminId: string
  adminName?: string
  adminStatus: ApprovalStatus
  forwardedTo?: string
  forwardedToName?: string
  forwardedBy?: string
  createdAt: string
  updatedAt: string
}
