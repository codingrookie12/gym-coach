# e2e — Playwright regression specs

Real, committed browser tests, running against **gym-coach-dev** (never
production). Before this, every live-browser verification in this repo was
an ad-hoc, uncommitted `npx -p playwright node <throwaway>.mjs` script that
got reinvented from scratch by whichever agent session needed it — this
directory is the permanent version of that pattern.

## Setup (one-time, local)

1. Copy `.env.dev.local.example` to `.env.dev.local` (already gitignored)
   and fill in the three keys from the
   [gym-coach-dev dashboard](https://supabase.com/dashboard/project/yxugejzqxiiihuevadnj/settings/api-keys/legacy).
   Same file `tests/helpers.ts` and `scripts/phase3-mint-otp.mjs` already
   assume for dev-project work — nothing new to configure if you've run
   those before.
2. `npm install` (installs `@playwright/test`, already a devDependency).
3. `npx playwright install chromium` (downloads the browser binary — not
   an npm package, needs its own install step, once per machine).

## Running

```
npm run test:e2e        # headless, once
npm run test:e2e:ui     # Playwright's interactive UI mode (recommended for authoring/debugging)
npx playwright test exercise-swap   # a single spec file
npx playwright show-report e2e/report   # last run's HTML report
```

`playwright.config.ts` starts `npm run dev` for you (reusing an
already-running local dev server if you have one, so it won't fight a
manual session) and points every spec at gym-coach-dev via `.env.dev.local`
/ `.env.development.local` (Next.js's own recognized dev-env filename —
see that file's comment for why both exist).

No manual server start, no manual login, no hand-rolled auth cookie — that
was the whole ad-hoc pattern this replaces.

## How auth works (`e2e/fixtures/auth.ts`)

Every test gets its own disposable `test-*@gym-test.invalid` user, minted
against gym-coach-dev via the same flow every prior live-verification
session reinvented by hand:

1. `serviceClient.auth.admin.createUser()` — create the user.
2. `serviceClient.auth.admin.generateLink({ type: 'magiclink' })` — mint a
   real OTP/token without sending an actual email.
3. An anon-key client calls `verifyOtp()` with that token to produce a real
   Supabase session.
4. That session is replayed through `@supabase/ssr`'s own
   `createServerClient().auth.setSession()`, capturing whatever cookies it
   writes. This is the important part: the cookie name/shape/chunking
   (`sb-<project-ref>-auth-token`, possibly split across `.0`/`.1` chunks)
   is a `@supabase/ssr` implementation detail. Deriving it from a real
   `setSession()` call means this never has to be hand-rolled or
   re-discovered when that library's cookie format changes.
5. Those cookies are injected into the test's browser context
   (`context.addCookies`) before any navigation — the app sees an already
   logged-in user on the very first page load.

A routine is then seeded via `createBlankProgram()` — the **same** helper
`RoutineEditorScreen`'s "Build My Own" flow calls, not a raw table insert
(CLAUDE.md's GYM-94 rule: `user_routine_exercises` writes must go through
the provenance-safe helpers). Three real catalog exercises, one set each
(`SEED_EXERCISES` in `auth.ts`) — one set keeps every spec fast and removes
any ambiguity about which set's RIR/weight/reps row is being interacted
with.

The user (and everything it created) is deleted in the fixture's teardown,
every test, pass or fail.

**Safety guard:** `auth.ts` refuses to run at all unless
`NEXT_PUBLIC_SUPABASE_URL` contains gym-coach-dev's project ref
(`yxugejzqxiiihuevadnj`) — a misconfigured `.env.dev.local` (or CI secret,
see below) pointing at production fails loudly instead of quietly creating
and deleting real auth users there.

## What's covered, and why

| Spec | Locks in |
|---|---|
| `exercise-swap.spec.ts` | The "BROWSE ALL EXERCISES" escape hatch (8b17947) in both places it exists — pre-session (`WorkoutOverviewScreen`) and mid-workout (`ActiveSessionScreen`): the 2-3-suggestion fast path, the full-browser search-and-swap, and that an already-planned exercise is excluded from the picker. Only ever verified live, ad hoc, before this file existed. |
| `session-flow.spec.ts` | The fc01cbe regression: Reports used to fetch its data once on mount, so it showed "NO SESSIONS YET" forever after finishing a real workout until a hard reload. This test never calls `page.reload()` — if that regression came back, this test would go red instead of silently passing. Also the only end-to-end coverage of start → log a set with RIR → "✓ SAVED" flash → finish that exercises the real screens (vitest's `critical-path.test.ts` hits the same DB writes directly via the SDK, never through the UI). |
| `unit-toggle.spec.ts` | The kg/lbs display-unit toggle (6150ba7+) actually converts the stored/displayed number, not just the label — `lib/weightConversion.ts`'s header documents a real ~2.2x data-corruption bug the redesign branch found (relabeling without reconverting) that this class of test would have caught. |

Deliberately **not** exhaustive — these lock in real bugs found and fixed
this session, not general coverage. Extend before duplicating: check
whether an existing spec's fixture/navigation helpers already get you most
of the way there.

## Selector notes (no `data-testid`s in this codebase)

Specs key off accessible roles/names, real CSS classes already present for
styling (`.weight-btn`, `.reps-btn`, `.swap-badge`, `.saved-indicator`,
`.numpad-btn`), and — where a screen renders several structurally-identical
rows with no other distinguishing hook — a documented `xpath=../../..`-style
walk up to the nearest shared ancestor. See `e2e/fixtures/navigation.ts`'s
`workoutOverviewRow()` and `pickerSheet()` for the two cases that needed
this, with the exact DOM depth they're counting on written out in a
comment next to each. If a future refactor changes that nesting, the
failure will point straight at the comment that needs updating.

One real gotcha worth flagging explicitly: **overlays don't unmount the
screen underneath them.** `NumberPad`, `ExercisePickerSheet`, etc. render as
`position: fixed` layers on top of the current screen, not in place of it —
so an unscoped `getByRole('button', { name: '1' })` while the weight
NumberPad is open can also match a `RirRow` chip with the same text still
sitting in the DOM behind it. Scope to the overlay's own class/container
rather than querying the page globally.

## CI

`.github/workflows/test.yml` has an `e2e` job that runs these specs against
gym-coach-dev — but it self-disables (a "Check gym-coach-dev secrets" step
skips every later step) because **this repo has no gym-coach-dev-specific
CI secrets yet.** The existing `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` secrets (used
by the `test` job's vitest run) were created 2026-05-16 — before
gym-coach-dev existed (ratified 2026-08-22) — so they almost certainly
point at production, and `auth.ts`'s project-ref guard would refuse to run
against them anyway.

**To turn the `e2e` job on:** add three new repository secrets —
`DEV_SUPABASE_URL`, `DEV_SUPABASE_ANON_KEY`, `DEV_SUPABASE_SERVICE_ROLE_KEY`
— with gym-coach-dev's values (same dashboard link as above). That's a
GitHub-account-console action outside an agent's authority to take
unilaterally; once added, the job activates on the next run with no other
change needed.

Until then, run `npm run test:e2e` locally/on-demand.
