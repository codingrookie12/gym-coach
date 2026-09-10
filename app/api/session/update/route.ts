import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase.server'
import { upsertWeightOverride } from '@/lib/supabase.queries'

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { pageId, changes } = body as {
      pageId: string
      changes: { weight?: number; reps?: number; notes?: string; rir?: number | null; equipmentInstanceId?: string | null }
    }

    if (!pageId || typeof pageId !== 'string') {
      return NextResponse.json({ error: 'Invalid pageId' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (changes.weight !== undefined) updates.weight = changes.weight
    if (changes.reps !== undefined) updates.reps = changes.reps
    if (changes.notes !== undefined) updates.notes = changes.notes
    if (changes.rir !== undefined) updates.rir = changes.rir
    // Equipment instance re-selected on an already-saved set (lib/autosavePlan.ts's
    // instanceChanged patch path). Explicit null clears a previously-tagged
    // instance, matching the untag option in the instance selector.
    if (changes.equipmentInstanceId !== undefined) updates.equipment_instance_id = changes.equipmentInstanceId
    if (Object.keys(updates).length === 0) return NextResponse.json({ success: true })

    // RLS policy on sets verifies the set belongs to the authenticated user
    const { error } = await supabase
      .from('sets')
      .update(updates)
      .eq('id', pageId)

    if (error) throw error

    // Weight-override re-sync (data-consistency audit, 2026-09): a weight
    // edit to a set that a previous autosave already persisted (late
    // correction, PR fix-up, etc.) reaches the DB only through this PATCH —
    // /api/session/write's upsertWeightOverride call never runs for it,
    // since planAutosave (lib/autosavePlan.ts) routes an already-snapshotted
    // set to toPatch, not toInsert. Left alone, exercise_weight_override
    // silently goes stale at whatever weight the FIRST autosave for this
    // exercise recorded — which then misfeeds ManageWeightsScreen's display,
    // /api/weights/exercise's add-mid-session pre-fill, and the coaching
    // engine's no-history fallback (lib/coaching/engine.ts). Recompute the
    // true max weight across this workout+exercise's sets (post-update) and
    // re-upsert, mirroring session/write's own "max weight wins" semantics.
    // Best-effort: the primary write (the sets row itself) already
    // succeeded and is reported truthfully below regardless of this outcome
    // — a sync failure here leaves the override no worse than it already
    // was, it must never turn an otherwise-successful set edit into a
    // reported failure (GYM-97 fix #1's "never lie about success" cuts both
    // ways).
    if (changes.weight !== undefined) {
      try {
        const { data: setRow } = await supabase
          .from('sets')
          .select('workout_id, exercise_id, unit')
          .eq('id', pageId)
          .maybeSingle()

        if (setRow?.workout_id && setRow?.exercise_id) {
          const { data: exerciseSets, error: exerciseSetsErr } = await supabase
            .from('sets')
            .select('weight')
            .eq('workout_id', setRow.workout_id)
            .eq('exercise_id', setRow.exercise_id)
          if (exerciseSetsErr) throw exerciseSetsErr

          const weights = (exerciseSets ?? []).map(r => Number(r.weight)).filter(w => Number.isFinite(w))
          if (weights.length > 0) {
            const maxWeight = Math.max(...weights)
            await upsertWeightOverride(supabase, user.id, setRow.exercise_id as string, maxWeight, (setRow.unit as string) ?? 'Lbs')
          }
        }
      } catch (syncError) {
        console.error('Weight-override re-sync failed (set update still succeeded):', syncError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update error:', error)
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 })
  }
}
