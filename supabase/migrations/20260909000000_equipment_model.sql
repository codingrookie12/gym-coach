-- Equipment-type / equipment-instance foundation (first slice: migrations +
-- pure lib modules only — no screen/UI wiring in this pass). See
-- docs/redesign-branch-reconciliation.md, bucket 2: confirmed-unclaimed
-- product scope from the parked `redesign/phase1-foundation` branch,
-- reimplemented fresh against current schema/conventions rather than
-- cherry-picked (that branch predates 20260821000000_reconcile_undocumented_
-- live_schema.sql, 20260822000000_phase1_schema_prep.sql, and
-- 20260822010000_phase2_coaching_engine_schema.sql).
--
-- Model:
--   1. exercises.equipment_type — 'mass-based' (real, lbs/kg-convertible via
--      lib/weightConversion.ts) vs 'abstract-scale' (pin-stack/band; the
--      logged number has no universal real-weight meaning). Nullable:
--      existing rows keep equipment_type = NULL until backfilled —
--      application code infers it from the existing weight_unit/equipment
--      signals instead (lib/equipmentType.ts's resolveEquipmentType), so
--      nothing regresses before a backfill runs. Same nullable-then-backfill
--      pattern as exercises.split (20260519000000_exercises_add_split.sql).
--
--   2. equipment_instances — optional user-defined gym/machine tag (e.g.
--      "Gold's Gym — leg press #2"), now with an optional per-instance
--      calibration (weight_per_unit + its mass unit) so a specific
--      abstract-scale machine's pin/level count can be resolved to a real
--      mass WITHOUT ever treating abstract-scale numbers as universally
--      convertible (see lib/weightConversion.ts's convertAbstractUnitsToMass
--      — calibration is per-instance, never a global formula). Both
--      calibration columns are nullable and travel together (paired CHECK
--      below) — most instances will have neither set.
--
--   3. sets.equipment_instance_id — optional FK: which instance a logged set
--      actually used. NULL = untagged = same default machine as pre-change
--      behavior (backward compatible).
--
--   4. user_routine_exercises.equipment_instance_id — optional default
--      instance to carry into a new session for this routine exercise.
--
-- Additive only, nullable, no data mutation.
--
-- IMPORTANT — live-state caveat (verify before applying): a prior
-- exploratory pass on the parked redesign branch left a live, EMPTY
-- `equipment_instances` table in at least one environment whose exact
-- column shape was never reconciled into this migration history (see
-- 20260821000000_reconcile_undocumented_live_schema.sql's note: "equipment_
-- instances table: present live, but EMPTY (0 rows) and its full column
-- shape could not be reconciled from data alone... out of scope until the
-- kg/lbs unit-system work actually begins, at which point its real live
-- shape should be introspected directly"). This migration is written
-- defensively (CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS +
-- DROP/ADD CONSTRAINT) specifically so it's safe whether that leftover
-- table is present or not — but Johnnatan should introspect the live table
-- in Supabase Studio before applying, in case it holds a genuinely
-- different, incompatible shape (e.g. a column name collision) that no
-- amount of defensive DDL here can know about in advance.
--
-- Per CLAUDE.md: migrations are authored and reviewed here, applied
-- manually by Johnnatan in Supabase Studio — never auto-applied by an
-- agent. This migration was NOT applied by the agent that wrote it.
--
-- Dependency: run only after 20260430000000_user_routine_exercises.sql and
-- 20260423000000_initial_schema.sql (uuid-ossp extension, users/exercises/
-- sets/user_routine_exercises tables).

-- ─────────────────────────────────────────────
-- 1. exercises.equipment_type
-- ─────────────────────────────────────────────
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS equipment_type TEXT;

ALTER TABLE public.exercises
  DROP CONSTRAINT IF EXISTS exercises_equipment_type_check;
ALTER TABLE public.exercises
  ADD CONSTRAINT exercises_equipment_type_check
    CHECK (equipment_type IS NULL OR equipment_type IN ('mass-based', 'abstract-scale'));

COMMENT ON COLUMN public.exercises.equipment_type IS
  'mass-based (real, lbs/kg-convertible) vs abstract-scale (pin-stack/band, no universal real-weight meaning). NULL = not yet classified — app infers from weight_unit/equipment via lib/equipmentType.ts resolveEquipmentType().';

-- ─────────────────────────────────────────────
-- 2. equipment_instances
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.equipment_instances (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defensive column adds — no-op if CREATE TABLE above just created them,
-- but closes the gap if a differently-shaped table already existed live.
ALTER TABLE public.equipment_instances
  ADD COLUMN IF NOT EXISTS weight_per_unit NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS weight_per_unit_mass_unit TEXT;

COMMENT ON COLUMN public.equipment_instances.weight_per_unit IS
  'This instance''s own calibration: how much real mass one abstract-scale unit (one pin/level) represents on THIS specific machine (e.g. "50" on a leg press whose weight_per_unit_mass_unit is lbs). NULL = uncalibrated (pin/level count stays a machine-specific number, not convertible). Always paired with weight_per_unit_mass_unit — see the calibration-pair CHECK below.';
COMMENT ON COLUMN public.equipment_instances.weight_per_unit_mass_unit IS
  'Mass unit (lbs|kg) that weight_per_unit is denominated in. NULL iff weight_per_unit is NULL.';

ALTER TABLE public.equipment_instances
  DROP CONSTRAINT IF EXISTS equipment_instances_calibration_pair_check;
ALTER TABLE public.equipment_instances
  ADD CONSTRAINT equipment_instances_calibration_pair_check
    CHECK ((weight_per_unit IS NULL) = (weight_per_unit_mass_unit IS NULL));

ALTER TABLE public.equipment_instances
  DROP CONSTRAINT IF EXISTS equipment_instances_calibration_unit_check;
ALTER TABLE public.equipment_instances
  ADD CONSTRAINT equipment_instances_calibration_unit_check
    CHECK (weight_per_unit_mass_unit IS NULL OR weight_per_unit_mass_unit IN ('lbs', 'kg'));

ALTER TABLE public.equipment_instances
  DROP CONSTRAINT IF EXISTS equipment_instances_calibration_positive_check;
ALTER TABLE public.equipment_instances
  ADD CONSTRAINT equipment_instances_calibration_positive_check
    CHECK (weight_per_unit IS NULL OR weight_per_unit > 0);

ALTER TABLE public.equipment_instances
  DROP CONSTRAINT IF EXISTS equipment_instances_user_id_name_key;
ALTER TABLE public.equipment_instances
  ADD CONSTRAINT equipment_instances_user_id_name_key UNIQUE (user_id, name);

CREATE INDEX IF NOT EXISTS idx_equipment_instances_user_id ON public.equipment_instances(user_id);

ALTER TABLE public.equipment_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "equipment_instances_select_own" ON public.equipment_instances;
CREATE POLICY "equipment_instances_select_own"
  ON public.equipment_instances FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "equipment_instances_insert_own" ON public.equipment_instances;
CREATE POLICY "equipment_instances_insert_own"
  ON public.equipment_instances FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "equipment_instances_update_own" ON public.equipment_instances;
CREATE POLICY "equipment_instances_update_own"
  ON public.equipment_instances FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "equipment_instances_delete_own" ON public.equipment_instances;
CREATE POLICY "equipment_instances_delete_own"
  ON public.equipment_instances FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 3. sets.equipment_instance_id
-- ─────────────────────────────────────────────
ALTER TABLE public.sets
  ADD COLUMN IF NOT EXISTS equipment_instance_id UUID REFERENCES public.equipment_instances(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sets_equipment_instance_id ON public.sets(equipment_instance_id);

-- ─────────────────────────────────────────────
-- 4. user_routine_exercises.equipment_instance_id
-- ─────────────────────────────────────────────
ALTER TABLE public.user_routine_exercises
  ADD COLUMN IF NOT EXISTS equipment_instance_id UUID REFERENCES public.equipment_instances(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ure_equipment_instance_id ON public.user_routine_exercises(equipment_instance_id);
