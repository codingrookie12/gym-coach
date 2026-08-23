-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2 — Coaching Engine Redesign: schema prep
-- (GYM-53 MEV/MAV volume tracking, GYM-57 RIR tracking, GYM-51 fatigue,
--  GYM-52 deload — see /Users/johnny/.claude/plans/goal-update-and-fully-memoized-valley.md)
--
-- Written on the Phase 2 worktree (branch phase-2-coaching-engine), authored
-- against the Phase 0 dev/test Supabase project (gym-coach-dev) per the plan's
-- standing rule — NOT YET VERIFIED there (only REST-level anon/service_role
-- keys exist for gym-coach-dev as of this writing, no DB-connection credential
-- to run `supabase db push`; same open gap Phase 1 hit). NOT applied to
-- production. Per CLAUDE.md: migrations are reviewed then applied manually in
-- Supabase Studio, never auto-applied by an agent.
--
-- Additive-only (Tier 2 under the plan's Section 2 rules): new tables + one
-- new nullable column on an existing table. No existing column, constraint,
-- or policy is touched. Does NOT redeclare `sets.rir` or `workouts.session_rpe`
-- — those are Phase 1's columns (20260822000000_phase1_schema_prep.sql on
-- branch phase-1-foundation-infra, not yet merged/visible in this worktree);
-- this engine consumes that contract, doesn't redefine it.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────
-- 1. training_landmarks — MEV/MAV/MRV per (muscle_group, experience_level, version)
-- ─────────────────────────────────────────────
-- muscle_group values match lib/exerciseLibrary.ts's `Muscle` union (the 17-value
-- granularity already used by exercises.json's primaryMuscles/secondaryMuscles —
-- the same granularity RP's own published landmark tables use), not the coarser
-- 6-value `MuscleGroup` in lib/muscleGroups.ts (that one stays a UI-only
-- navigation grouping, unrelated to this table).
CREATE TABLE public.training_landmarks (
  id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  muscle_group     TEXT         NOT NULL,
  experience_level TEXT         NOT NULL CHECK (experience_level IN ('novice', 'intermediate', 'advanced')),
  version          INTEGER      NOT NULL CHECK (version > 0),
  mev              SMALLINT     NOT NULL CHECK (mev >= 0),
  mav              SMALLINT     NOT NULL CHECK (mav >= mev),
  mrv              SMALLINT     NOT NULL CHECK (mrv >= mav),
  source_citation  TEXT         NOT NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (muscle_group, experience_level, version)
);

COMMENT ON TABLE public.training_landmarks IS
  'Weekly working-set volume landmarks (MEV/MAV/MRV) per muscle group and experience level, versioned. Shared config, not user data — see set_crediting_rules for the paired versioned crediting weights. Seed values in this migration are RP-published base numbers (intermediate tier) with this app''s own documented novice/advanced scaling factors — see seed INSERTs below for the exact split.';

-- ─────────────────────────────────────────────
-- 2. set_crediting_rules — primary vs. secondary muscle-involvement credit, versioned
-- ─────────────────────────────────────────────
CREATE TABLE public.set_crediting_rules (
  version          INTEGER      PRIMARY KEY CHECK (version > 0),
  primary_credit   NUMERIC(3,2) NOT NULL DEFAULT 1.0 CHECK (primary_credit > 0),
  secondary_credit NUMERIC(3,2) NOT NULL DEFAULT 0.5 CHECK (secondary_credit >= 0 AND secondary_credit <= primary_credit),
  source_citation  TEXT         NOT NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.set_crediting_rules IS
  'How much a logged set counts toward a muscle''s weekly volume tally when that muscle is primary vs. secondary for the exercise. Versioned independently from training_landmarks.version — a historical coaching annotation snapshots both version numbers (see lib/coaching/ CoachingFlag.landmarksVersion / setCreditingVersion) so a later default update never silently reinterprets old chart annotations.';

-- ─────────────────────────────────────────────
-- 3. users.experience_level — self-reported training-age signal (nullable)
-- ─────────────────────────────────────────────
-- NULL = not yet answered. The engine treats NULL as the documented cold-start
-- default (novice tier) in code (lib/coaching/landmarks.ts), not via a DB
-- DEFAULT value — a DB default would make "hasn't answered yet" indistinguishable
-- from "explicitly chose novice," the same NULL-as-sentinel pattern Phase 1
-- already established for sets.rir. The actual onboarding UI question that sets
-- this is a later-phase concern (per the dispatch scope) — this migration only
-- adds the column.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS experience_level TEXT CHECK (experience_level IN ('novice', 'intermediate', 'advanced'));

-- ─────────────────────────────────────────────
-- RLS — both new config tables follow the existing `training_modes_select`
-- pattern (20260423000000_initial_schema.sql): shared read-only config,
-- readable by every authenticated user, writable by nobody at the client
-- level. This explicitly overrides the standing ALTER DEFAULT PRIVILEGES grant
-- (20260514000000_data_api_default_grants.sql hands `authenticated` full CRUD
-- on every new table by default) — RLS enabled + only a SELECT policy means
-- INSERT/UPDATE/DELETE are denied for authenticated/anon regardless of the
-- schema-wide GRANT, same mechanism Phase 5's UGC dedup table will rely on.
-- ─────────────────────────────────────────────
ALTER TABLE public.training_landmarks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.set_crediting_rules  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_landmarks_select"
  ON public.training_landmarks FOR SELECT TO authenticated USING (true);

CREATE POLICY "set_crediting_rules_select"
  ON public.set_crediting_rules FOR SELECT TO authenticated USING (true);

-- ─────────────────────────────────────────────
-- Seed data — version 1
-- ─────────────────────────────────────────────
-- Base (intermediate-tier) numbers are RP's widely-published approximate weekly
-- working-set MEV/MAV/MRV ranges (Israetel et al., Renaissance Periodization
-- hypertrophy guidance) — traceable but approximate; log a formal citation
-- entry in Notion's Sports Science Research DB alongside checker review, not
-- done by this migration.
--
-- Novice/advanced are NOT independently-cited RP numbers — they're this app's
-- own documented scaling of the intermediate base (novice ×0.7, advanced
-- ×1.15, rounded), applied per RP's stated *principle* that lower-training-age
-- lifters have less recoverable volume and higher per-set responsiveness while
-- higher-training-age lifters need progressively more volume for continued
-- adaptation. Flagged explicitly as an assumption to revisit once backtest/
-- pilot data exists (see Phase 2 exit criterion's face-validity framing) —
-- not asserted as equally rigorous to the intermediate base.
INSERT INTO public.set_crediting_rules (version, primary_credit, secondary_credit, source_citation) VALUES
  (1, 1.0, 0.5, 'RP convention: secondary muscle involvement credited at half a primary set, not 1:1 (Israetel et al., Renaissance Periodization hypertrophy guidance) — this app''s literal implementation of that published convention.');

INSERT INTO public.training_landmarks (muscle_group, experience_level, version, mev, mav, mrv, source_citation) VALUES
  -- Chest
  ('Chest',        'intermediate', 1, 8,  16, 22, 'RP published weekly-set landmarks (intermediate), Israetel et al.'),
  ('Chest',        'novice',       1, 6,  11, 15, 'Scaled ×0.7 from intermediate base — this app''s documented assumption, not an independently-cited RP number.'),
  ('Chest',        'advanced',     1, 9,  18, 25, 'Scaled ×1.15 from intermediate base — this app''s documented assumption, not an independently-cited RP number.'),
  -- Lats
  ('Lats',         'intermediate', 1, 10, 16, 24, 'RP published weekly-set landmarks (intermediate, back/lats), Israetel et al.'),
  ('Lats',         'novice',       1, 7,  11, 17, 'Scaled ×0.7 from intermediate base — documented assumption.'),
  ('Lats',         'advanced',     1, 11, 18, 28, 'Scaled ×1.15 from intermediate base — documented assumption.'),
  -- Middle Back
  ('Middle Back',  'intermediate', 1, 10, 16, 24, 'RP published weekly-set landmarks (intermediate, back), Israetel et al.'),
  ('Middle Back',  'novice',       1, 7,  11, 17, 'Scaled ×0.7 from intermediate base — documented assumption.'),
  ('Middle Back',  'advanced',     1, 11, 18, 28, 'Scaled ×1.15 from intermediate base — documented assumption.'),
  -- Lower Back
  ('Lower Back',   'intermediate', 1, 4,  8,  12, 'RP published weekly-set landmarks (intermediate, lower back — kept conservative, high-injury-risk region), Israetel et al.'),
  ('Lower Back',   'novice',       1, 3,  6,  8,  'Scaled ×0.7 from intermediate base — documented assumption.'),
  ('Lower Back',   'advanced',     1, 5,  9,  14, 'Scaled ×1.15 from intermediate base — documented assumption.'),
  -- Traps
  ('Traps',        'intermediate', 1, 6,  12, 20, 'RP published weekly-set landmarks (intermediate, traps), Israetel et al.'),
  ('Traps',        'novice',       1, 4,  8,  14, 'Scaled ×0.7 from intermediate base — documented assumption.'),
  ('Traps',        'advanced',     1, 7,  14, 23, 'Scaled ×1.15 from intermediate base — documented assumption.'),
  -- Shoulders
  ('Shoulders',    'intermediate', 1, 8,  16, 24, 'RP published weekly-set landmarks (intermediate, delts combined), Israetel et al.'),
  ('Shoulders',    'novice',       1, 6,  11, 17, 'Scaled ×0.7 from intermediate base — documented assumption.'),
  ('Shoulders',    'advanced',     1, 9,  18, 28, 'Scaled ×1.15 from intermediate base — documented assumption.'),
  -- Biceps
  ('Biceps',       'intermediate', 1, 8,  14, 20, 'RP published weekly-set landmarks (intermediate, biceps), Israetel et al.'),
  ('Biceps',       'novice',       1, 6,  10, 14, 'Scaled ×0.7 from intermediate base — documented assumption.'),
  ('Biceps',       'advanced',     1, 9,  16, 23, 'Scaled ×1.15 from intermediate base — documented assumption.'),
  -- Triceps
  ('Triceps',      'intermediate', 1, 6,  12, 18, 'RP published weekly-set landmarks (intermediate, triceps), Israetel et al.'),
  ('Triceps',      'novice',       1, 4,  8,  13, 'Scaled ×0.7 from intermediate base — documented assumption.'),
  ('Triceps',      'advanced',     1, 7,  14, 21, 'Scaled ×1.15 from intermediate base — documented assumption.'),
  -- Forearms
  ('Forearms',     'intermediate', 1, 6,  12, 20, 'RP published weekly-set landmarks (intermediate, forearms), Israetel et al.'),
  ('Forearms',     'novice',       1, 4,  8,  14, 'Scaled ×0.7 from intermediate base — documented assumption.'),
  ('Forearms',     'advanced',     1, 7,  14, 23, 'Scaled ×1.15 from intermediate base — documented assumption.'),
  -- Quadriceps
  ('Quadriceps',   'intermediate', 1, 8,  14, 20, 'RP published weekly-set landmarks (intermediate, quads), Israetel et al.'),
  ('Quadriceps',   'novice',       1, 6,  10, 14, 'Scaled ×0.7 from intermediate base — documented assumption.'),
  ('Quadriceps',   'advanced',     1, 9,  16, 23, 'Scaled ×1.15 from intermediate base — documented assumption.'),
  -- Hamstrings
  ('Hamstrings',   'intermediate', 1, 6,  12, 20, 'RP published weekly-set landmarks (intermediate, hamstrings), Israetel et al.'),
  ('Hamstrings',   'novice',       1, 4,  8,  14, 'Scaled ×0.7 from intermediate base — documented assumption.'),
  ('Hamstrings',   'advanced',     1, 7,  14, 23, 'Scaled ×1.15 from intermediate base — documented assumption.'),
  -- Glutes
  ('Glutes',       'intermediate', 1, 4,  10, 16, 'RP published weekly-set landmarks (intermediate, glutes — high compound-exercise overlap), Israetel et al.'),
  ('Glutes',       'novice',       1, 3,  7,  11, 'Scaled ×0.7 from intermediate base — documented assumption.'),
  ('Glutes',       'advanced',     1, 5,  12, 18, 'Scaled ×1.15 from intermediate base — documented assumption.'),
  -- Calves
  ('Calves',       'intermediate', 1, 8,  12, 18, 'RP published weekly-set landmarks (intermediate, calves), Israetel et al.'),
  ('Calves',       'novice',       1, 6,  8,  13, 'Scaled ×0.7 from intermediate base — documented assumption.'),
  ('Calves',       'advanced',     1, 9,  14, 21, 'Scaled ×1.15 from intermediate base — documented assumption.'),
  -- Adductors
  ('Adductors',    'intermediate', 1, 4,  8,  14, 'RP-adjacent estimate (adductors are rarely a standalone landmark table entry; conservatively set near glutes/hamstrings tier), flagged for checker review.'),
  ('Adductors',    'novice',       1, 3,  6,  10, 'Scaled ×0.7 from intermediate base — documented assumption.'),
  ('Adductors',    'advanced',     1, 5,  9,  16, 'Scaled ×1.15 from intermediate base — documented assumption.'),
  -- Abductors
  ('Abductors',    'intermediate', 1, 4,  8,  14, 'RP-adjacent estimate (abductors are rarely a standalone landmark table entry; conservatively set near glutes/hamstrings tier), flagged for checker review.'),
  ('Abductors',    'novice',       1, 3,  6,  10, 'Scaled ×0.7 from intermediate base — documented assumption.'),
  ('Abductors',    'advanced',     1, 5,  9,  16, 'Scaled ×1.15 from intermediate base — documented assumption.'),
  -- Abdominals
  ('Abdominals',   'intermediate', 1, 0,  16, 25, 'RP published weekly-set landmarks (intermediate, abs — MEV 0 is RP''s own stated value, direct core work isn''t required for growth given compound-lift overlap), Israetel et al.'),
  ('Abdominals',   'novice',       1, 0,  11, 18, 'Scaled ×0.7 from intermediate base (MEV floor kept at 0 per RP''s stated value, not scaled below 0) — documented assumption.'),
  ('Abdominals',   'advanced',     1, 0,  18, 29, 'Scaled ×1.15 from intermediate base (MEV floor kept at 0) — documented assumption.'),
  -- Neck
  ('Neck',         'intermediate', 1, 0,  6,  12, 'Conservative estimate — neck is rarely a standalone RP landmark table entry, low exercise coverage (5 exercises) in this app''s catalog; flagged for checker review.'),
  ('Neck',         'novice',       1, 0,  4,  8,  'Scaled ×0.7 from intermediate base (MEV floor kept at 0) — documented assumption.'),
  ('Neck',         'advanced',     1, 0,  7,  14, 'Scaled ×1.15 from intermediate base (MEV floor kept at 0) — documented assumption.');
