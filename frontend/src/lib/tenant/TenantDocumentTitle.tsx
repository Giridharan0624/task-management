'use client'

import { useTenantDocumentTitle } from '@/lib/tenant/useTenantDocumentTitle'

/** Mount this once inside the provider tree to keep document.title in
 * sync with the current tenant's display name. Renders nothing. */
export function TenantDocumentTitle() {
  useTenantDocumentTitle()
  return null
}
