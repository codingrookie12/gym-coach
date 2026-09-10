/**
 * e2e/fixtures/auth.ts
 *
 * The reusable version of a pattern every live-verification session this
 * app has had reinvented from scratch as a throwaway script (see
 * scripts/phase3-mint-otp.mjs and tests/helpers.ts's signInAs): mint a real
 * Supabase session for a disposable @gym-test.invalid user against
 * gym-coach-dev (never production) via the admin magic-link -> verifyOtp
 * flow, with no real inbox required, then replay that session through the
 * app's own @supabase/ssr client so the captured cookies match the exact
 * name/shape/chunking the app's middleware and browser client expect.
 *
 * Never hand-roll the `sb-<project-ref>-auth-token` cookie format — always
 * derive it from a real setSession() call, the way this file does. That
 * format is a @supabase/ssr implementation detail and has no business being
 * duplicated by hand in test code.
 *
 * One seeded user per TEST (not per worker/file) — swap specs mutate the
 * routine they're given, so sharing a user across tests would make one
 * test's swap leak into the next test's assumptions about what's planned.
 * The per-test admin API round trip costs a couple of seconds; that's a
 * fair trade for specs that don't need to reason about shared state.
 */
import { test as base, type BrowserContext } from '@playwright/test'
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
import { randomUUID } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cloneTemplate, createBlankProgram, type CreateBlankProgramInput } from '../../lib/userProgram'

loadEnv({ path: resolve(__dirname, '../../.env.dev.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey || !serviceKey) {
  throw new Error(
    'Missing gym-coach-dev credentials. Copy .env.dev.local.example to ' +
    '.env.dev.local and fill in the keys from the dashboard (see ' +
    'e2e/README.md) — never point these specs at production.'
  )
}

// Guard rail: these specs create/delete real auth users and write real
// routine rows. Refuse to run against anything that isn't the known
// gym-coach-dev project ref, even if someone's local .env.dev.local
// (or a misconfigured CI secret) accidentally points elsewhere.
const DEV_PROJECT_REF = 'yxugejzqxiiihuevadnj'
if (!url.includes(DEV_PROJECT_REF)) {
  throw new Error(
    `e2e specs must target gym-coach-dev (${DEV_PROJECT_REF}), got ${url}. ` +
    'Refusing to run against an unexpected Supabase project.'
  )
}

export const serviceClient: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false },
})

export interface MintedSession {
  userId: string
  email: string
  /** Authenticated as the real user — same RLS path the app itself uses. */
  client: SupabaseClient
  cookies: Array<{ name: string; value: string }>
}

/**
 * Mints a disposable user + session. Mirrors
 * .worktrees/redesign-phase1-foundation/tests/e2e/global-setup.ts's proven
 * approach exactly (admin.createUser -> admin.generateLink(magiclink) ->
 * anon client verifyOtp -> replay through createServerClient to capture
 * real cookies) rather than inventing a new one.
 */
export async function mintSession(labelPrefix = 'e2e'): Promise<MintedSession> {
  const email = `test-${labelPrefix}-${Date.now()}-${randomUUID().slice(0, 8)}@gym-test.invalid`

  const { data: created, error: createErr } = await serviceClient.auth.admin.createUser({
    email,
    email_confirm: true,
  })
  if (createErr) throw createErr
  const userId = created.user!.id

  const { data: linkData, error: linkErr } = await serviceClient.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkErr) throw linkErr
  const tokenHash = linkData.properties?.hashed_token
  if (!tokenHash) throw new Error('generateLink returned no hashed_token')

  const anonClient = createClient(url!, anonKey!, { auth: { persistSession: false } })
  const { data: verified, error: verifyErr } = await anonClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  })
  if (verifyErr) throw verifyErr
  const mintedSession = verified.session
  if (!mintedSession) throw new Error('verifyOtp returned no session')

  const capturedCookies: Array<{ name: string; value: string }> = []
  const ssrClient = createServerClient(url!, anonKey!, {
    cookies: {
      getAll() {
        return []
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(c => capturedCookies.push({ name: c.name, value: c.value }))
      },
    },
  })
  const { error: setErr } = await ssrClient.auth.setSession(mintedSession)
  if (setErr) throw setErr
  if (capturedCookies.length === 0) {
    throw new Error('No cookies captured from setSession — @supabase/ssr cookie shape may have changed')
  }

  // Authenticated SDK client as the real user — used below to seed a
  // routine through the app's own write helpers (real RLS path), not a
  // service-role bypass.
  const authedClient = createClient(url!, anonKey!, { auth: { persistSession: false } })
  await authedClient.auth.setSession(mintedSession)

  return { userId, email, client: authedClient, cookies: capturedCookies }
}

export async function deleteTestUser(userId: string): Promise<void> {
  await serviceClient.auth.admin.deleteUser(userId)
}

/** Applies minted cookies to a Playwright browser context, in the shape it expects. */
export async function applyAuthCookies(context: BrowserContext, cookies: MintedSession['cookies']): Promise<void> {
  await context.addCookies(
    cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: 'localhost',
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    }))
  )
}

/** The three real catalog exercises every seeded routine below uses — all
 *  plain Barbell (mass-based) movements, chosen so getAlternatives() always
 *  has real candidates to suggest for the swap specs. */
export const SEED_EXERCISES = {
  a: 'Barbell Bench Press - Medium Grip',
  b: 'Bent Over Barbell Row',
  c: 'Barbell Squat',
} as const

const BLANK_PROGRAM: CreateBlankProgramInput = {
  name: 'E2E Test Day',
  splits: [
    {
      name: 'Day A',
      exercises: [
        { name: SEED_EXERCISES.a, sets: 1, repRange: [8, 10] },
        { name: SEED_EXERCISES.b, sets: 1, repRange: [8, 10] },
        { name: SEED_EXERCISES.c, sets: 1, repRange: [8, 10] },
      ],
    },
  ],
}

export interface SeededUser extends MintedSession {
  programId: string
}

/**
 * Seeds a ready-to-train 3-exercise, 1-set-each custom routine (via the
 * SAME createBlankProgram() helper the real "Build My Own" flow calls —
 * CLAUDE.md's GYM-94 rule: user_routine_exercises writes must go through
 * the provenance-safe helpers, never a raw insert, even in test setup),
 * then marks onboarding complete and this program active via a direct
 * service-role update. That last part is plain fixture bootstrapping (which
 * program is "active" for a user), not a routine write, so it doesn't need
 * to go through a UI helper.
 *
 * One set per exercise keeps every spec fast and unambiguous: completing a
 * single weight+reps pair finishes that exercise, and there's exactly one
 * RIR row to interact with per exercise (no scoping needed to disambiguate
 * "set 1's RIR" from "set 2's RIR").
 */
export async function seedReadyToTrainUser(labelPrefix = 'e2e'): Promise<SeededUser> {
  const session = await mintSession(labelPrefix)
  const programId = await createBlankProgram(session.client, session.userId, BLANK_PROGRAM)
  const { error } = await serviceClient
    .from('users')
    .update({ onboarding_completed: true, active_user_program_id: programId })
    .eq('id', session.userId)
  if (error) throw error
  return { ...session, programId }
}

// Re-exported for anything that wants the curated-template path instead
// (unused by the current specs, kept available since it's the more
// realistic "real user" seed shape for future specs).
export { cloneTemplate }

export const test = base.extend<{ seededUser: SeededUser }>({
  seededUser: async ({ context }, use, testInfo) => {
    const user = await seedReadyToTrainUser(`t${testInfo.workerIndex}`)
    await applyAuthCookies(context, user.cookies)
    await use(user)
    await deleteTestUser(user.userId)
  },
})

export { expect } from '@playwright/test'
