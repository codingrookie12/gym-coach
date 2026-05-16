import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

config({ path: resolve(__dirname, '../.env.local') })

export const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
export const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const serviceClient = createClient(url, serviceKey, {
  auth: { persistSession: false },
})

/**
 * Mints an authenticated SDK client for the given email.
 * Uses the admin magic-link → verifyOtp flow (passwordless; no email actually sent).
 */
export async function signInAs(email: string): Promise<SupabaseClient> {
  const { data, error } = await serviceClient.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (error) throw error
  const tokenHash = data.properties?.hashed_token
  if (!tokenHash) throw new Error('generateLink returned no hashed_token')

  const client = createClient(url, anon, { auth: { persistSession: false } })
  const { error: verifyErr } = await client.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  })
  if (verifyErr) throw verifyErr
  return client
}
