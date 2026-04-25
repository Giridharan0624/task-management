export type DayOffStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'N/A'

export interface DayOffRequest {
  requestId: string
  userId: string
  userName: string
  employeeId?: string
  startDate: string
  endDate: string
  reason: string
  /** Org-configured leave-type id (e.g. "casual", "sick"). Optional only
   *  for legacy records created before quota tracking shipped. */
  leaveTypeId?: string
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

export interface DayOffBalanceEntry {
  leaveTypeId: string
  name: string
  quota: number
  used: number
  pending: number
  remaining: number
}

export interface DayOffBalance {
  year: number
  balances: DayOffBalanceEntry[]
}
