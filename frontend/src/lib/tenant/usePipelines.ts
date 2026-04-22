'use client'

import { useCallback, useMemo } from 'react'
import { useTenant } from '@/lib/tenant/TenantProvider'
import { TASK_STATUS_LABEL } from '@/types/task'
import type { Pipeline } from '@/types/org'

/** Phase 5 — read this org's task pipelines from TenantContext.
 *
 * Pipelines are folded into GET /orgs/current alongside settings + plan,
 * so by the time the dashboard renders they're already in the context.
 * No extra fetch needed; consumers just read from here.
 */
export function usePipelines(): {
  pipelines: Pipeline[]
  isLoading: boolean
  error: Error | null
} {
  const { current, isLoading, error } = useTenant()
  return {
    pipelines: current?.pipelines ?? [],
    isLoading,
    error: error ? new Error(error) : null,
  }
}

/** Convenience: look up a status's label/color across all pipelines.
 * Used by status badges that don't know which pipeline a task belongs
 * to — first match wins. */
export function findStatusMeta(
  pipelines: Pipeline[],
  statusId: string
): { label: string; color: string } | null {
  for (const p of pipelines) {
    const s = p.statuses.find((x) => x.id === statusId)
    if (s) return { label: s.label, color: s.color }
  }
  return null
}

/** Find a pipeline by id, falling back to the default pipeline (first
 * one with `isDefault`) when an unknown id is requested. Returns null
 * if pipelines have not loaded yet. */
export function findPipeline(
  pipelines: Pipeline[],
  pipelineId: string | undefined
): Pipeline | null {
  if (!pipelines.length) return null
  if (pipelineId) {
    const found = pipelines.find((p) => p.pipelineId === pipelineId)
    if (found) return found
  }
  return pipelines.find((p) => p.isDefault) ?? pipelines[0] ?? null
}

/** Convenience hook: returns a label-lookup function for task status
 * strings, consulting the tenant's pipelines first and falling back to
 * the hardcoded `TASK_STATUS_LABEL` for legacy statuses not in any
 * pipeline. Use in place of `TASK_STATUS_LABEL[status]` in components. */
export function useStatusLabel(): (status: string) => string {
  const { pipelines } = usePipelines()
  const index = useMemo(() => buildStatusIndex(pipelines), [pipelines])
  return useCallback(
    (status: string) =>
      index.get(status)?.label ??
      TASK_STATUS_LABEL[status as keyof typeof TASK_STATUS_LABEL] ??
      status,
    [index],
  )
}

/** Companion hook for inline status color (hex string from pipelines,
 * falling back to null when the status isn't in any pipeline — callers
 * can then use their existing TASK_STATUS_COLORS tailwind classes). */
export function useStatusColor(): (status: string) => string | null {
  const { pipelines } = usePipelines()
  const index = useMemo(() => buildStatusIndex(pipelines), [pipelines])
  return useCallback(
    (status: string) => index.get(status)?.color ?? null,
    [index],
  )
}

/** Flatten the union of all pipelines' statuses, keyed by status id.
 * The first occurrence wins, so a status defined in multiple pipelines
 * (e.g. "DONE" in DEVELOPMENT + DESIGNING) takes its label/color from
 * whichever pipeline lists it first. */
export function buildStatusIndex(
  pipelines: Pipeline[]
): Map<string, { label: string; color: string; order: number; pipelineId: string }> {
  const idx = new Map<
    string,
    { label: string; color: string; order: number; pipelineId: string }
  >()
  for (const p of pipelines) {
    for (const s of p.statuses) {
      if (!idx.has(s.id)) {
        idx.set(s.id, {
          label: s.label,
          color: s.color,
          order: s.order,
          pipelineId: p.pipelineId,
        })
      }
    }
  }
  return idx
}
