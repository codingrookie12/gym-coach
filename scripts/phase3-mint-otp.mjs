// One-off, throwaway script for Phase 3 live verification — mints a real
// email OTP code for a disposable test user against the DEV Supabase
// project (gym-coach-dev), via the admin API, so the real login UI
// (app/login/page.tsx's 6-digit-code flow) can be driven end-to-end in a
// live browser session without needing an actual inbox. Reads
// .env.development.local (dev project only — never .env.local/prod).
// Not part of the app; safe to delete after verification.
import { config } from 'dotenv'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env.development.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing dev Supabase credentials in .env.development.local')
  process.exit(1)
}

const email = process.argv[2] || 'phase3-verify@example.com'
const client = createClient(url, serviceKey, { auth: { persistSession: false } })

const { data, error } = await client.auth.admin.generateLink({
  type: 'magiclink',
  email,
})
if (error) {
  console.error('generateLink error:', error.message)
  process.exit(1)
}

console.log('email:', email)
console.log('email_otp:', data.properties?.email_otp)
console.log('hashed_token:', data.properties?.hashed_token)
console.log('user_id:', data.user?.id)
