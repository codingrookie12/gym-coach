-- Phase 1 (GYM-19/GYM-29/coaching redesign schema-prep) — see
-- /Users/johnny/.claude/plans/goal-update-and-fully-memoized-valley.md,
-- Section 7 Phase 1 doer scope + Section 8 (the `rir` joint contract).
--
-- Additive-only, nullable columns on existing tables. No new tables, no RLS
-- policy changes — the tables below already have RLS enabled with
-- ownership-scoped policies (20260423000000_initial_schema.sql) that cover
-- every column, including these new ones, with no changes needed.
-- Per CLAUDE.md: "Migrations — manual apply only." This file is authored
-- and reviewed here; Johnnatan (or an agent with him) applies it directly
-- in Supabase Studio — never auto-applied.
--
-- NOTE on branch state: the latest timestamp-prefixed migration committed
-- to `main` at authoring time is 20260519000001_shared_custom_exercises.sql.
-- Phase 0's 20260821000000_reconcile_undocumented_live_schema.sql exists on
-- the not-yet-merged gym-96-phase-0-cleanup branch (PR #45), not on `main`
-- — this file's timestamp (20260822000000) is chosen to sort after it
-- regardless of merge order, per Section 1's migration-file coordination
-- rule. Re-check `supabase/migrations/` for collisions before applying if
-- gym-96-phase-0-cleanup has merged in the meantime.
--
-- Scope note: this migration intentionally does NOT include Phase 5's
-- invite/UGC usage-count tables. Section 2 (Tier 3 rule 2b) and Section 9
-- explicitly gate that two-table mechanism behind Johnnatan's sign-off
-- "before any table/trigger is written" — Phase 1's doer scope mentions
-- them only as a design reference ("the two-table dedup design... see
-- Phase 5"), and Phase 5's own doer scope re-states authoring those
-- migrations as its own task. Building them here would jump that gate, so
-- they're deliberately deferred to Phase 5.

-- ─────────────────────────────────────────────
-- sets.rir — RIR (Reps in Reserve), Phase 2/3 joint contract
-- ─────────────────────────────────────────────
-- Value domain (settled once, here, per Section 8 — Phase 2's engine and
-- Phase 3's UI both consume this exact contract without re-deriving it):
--   integer 0-5+ (RP's standard RIR scale; open-ended upper bound, "+"
--   covers the rare very-light-set case above 5 — no CHECK ceiling)
--   NULL = not logged — the sentinel that tells the coaching engine to
--     infer from rep-range position instead (Phase 2's
--     origin: 'inferred-rep-range' vs 'logged-rir' provenance tag)
--   No half-steps in v1 (deliberate, documented simplification — SMALLINT,
--     not NUMERIC — revisit only if backtest data shows real granularity
--     loss, per the plan's Phase 2 exit criterion)
ALTER TABLE sets
  ADD COLUMN IF NOT EXISTS rir SMALLINT CHECK (rir IS NULL OR rir >= 0);

COMMENT ON COLUMN sets.rir IS
  'Reps in Reserve, integer 0-5+ (RP standard scale), NULL = not logged (engine infers from rep-range position instead). No half-steps in v1. Value domain is a joint Phase 2/3 contract — see Section 8 of the revamp plan.';

-- ─────────────────────────────────────────────
-- workouts.session_rpe — session-level readiness/fatigue signal
-- ─────────────────────────────────────────────
-- A single optional session-level tap (Sports-science panel finding —
-- "practical, cheap, currently-missing fatigue-signal input"). Standard
-- Borg CR10-style session-RPE scale (1-10), NULL = not logged. This exact
-- 1-10 domain is a Tier 2 implementation choice (the plan specifies the
-- *existence* of this signal, not its numeric scale) — flagged for
-- checker confirmation, not a joint-contract-locked value like `rir`.
ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS session_rpe SMALLINT CHECK (session_rpe IS NULL OR (session_rpe BETWEEN 1 AND 10));

COMMENT ON COLUMN workouts.session_rpe IS
  'Optional session-level RPE (Borg CR10-style, 1-10), NULL = not logged. Tier 2 scale choice — see Phase 1 schema-prep migration comment.';

-- ─────────────────────────────────────────────
-- public.users.locale — i18n (Section 5)
-- ─────────────────────────────────────────────
-- No CHECK constraint deliberately: the supported-locale list
-- (lib/i18n/config.ts's `locales`) is expected to stay small but is
-- validated at the application layer (isLocale()), not the DB, so adding
-- a future locale never requires a schema migration + CHECK-constraint
-- update in lockstep with the app-layer support matrix.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS locale TEXT;

COMMENT ON COLUMN users.locale IS
  'Persisted locale preference (e.g. en, es), NULL = not yet resolved server-side (cookie/Accept-Language auto-detect still authoritative for that request). See lib/i18n/config.ts. Validated at the app layer, not via CHECK.';

-- ─────────────────────────────────────────────
-- public.users.unit_preference — kg/lbs (Section 5, re-opened)
-- ─────────────────────────────────────────────
-- Matches the existing `sets.unit` / `exercise_weight_override.unit`
-- casing convention ('Lbs' | 'Kg' | 'Pins') for consistency — but only
-- Lbs/Kg are valid as a *user-level default preference* ('Pins' is an
-- exercise-specific unit, not a personal default).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS unit_preference TEXT CHECK (unit_preference IS NULL OR unit_preference IN ('Lbs', 'Kg'));

COMMENT ON COLUMN users.unit_preference IS
  'User default weight unit preference, NULL = not set (app falls back to Lbs, todays default). Conversion logic is re-derived fresh in the phase that consumes this, per the standing "start fresh" decision — not merged from the parked redesign/phase1-foundation branch''s unit-model work, which has a documented real bug (~2.2x value corruption) to avoid repeating.';
