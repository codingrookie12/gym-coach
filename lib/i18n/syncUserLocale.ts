import { createSupabaseBrowserClient } from '@/lib/supabase'
import type { Locale } from '@/lib/i18n/config'

/**
 * GYM-29: persists the resolved locale to `public.users.locale` so it
 * follows the user cross-device (not just this browser's cookie).
 *
 * Best-effort, fire-and-forget: the `locale` column is additive/nullable
 * schema-prep (see supabase/migrations — Phase 1) and may not exist yet on
 * a given environment until Johnnatan applies the migration in Studio, so
 * this must never throw or block rendering if the write fails.
 */
export async function syncUserLocale(userId: string, locale: Locale): Promise<void> {
  try {
    const supabase = createSupabaseBrowserClient()
    await supabase.from('users').update({ locale }).eq('id', userId)
  } catch {
    // Non-fatal — cookie remains the source of truth for this session.
  }
}
