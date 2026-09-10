-- Widens user_routine_exercises.weight_unit to accept 'kg', alongside the
-- existing 'lbs'/'pins'. Part of the equipment-type/unit-conversion
-- foundation slice (see 20260909000000_equipment_model.sql's header and
-- docs/redesign-branch-reconciliation.md, bucket 2).
--
-- `sets.unit` and `exercise_weight_override.unit` already accept
-- 'Lbs'|'Kg'|'Pins' (20260423000000_initial_schema.sql) and
-- `users.unit_preference` already accepts 'Lbs'|'Kg'
-- (20260822000000_phase1_schema_prep.sql) — this is the one remaining
-- two-value holdout (lowercase 'lbs'|'pins', no kg), on the routine's
-- static per-exercise default unit.
--
-- Additive/widening only — every existing 'lbs'/'pins' row keeps working
-- unchanged; this only legalizes a new value the column could not
-- previously hold. No screen currently writes 'kg' here (that wiring is
-- explicitly out of scope for this migration's pass — see
-- docs/redesign-branch-reconciliation.md step 3), so this has zero runtime
-- effect until a later phase's UI actually sets it.
--
-- Per CLAUDE.md: authored/reviewed here, applied manually by Johnnatan in
-- Supabase Studio — never auto-applied by an agent.

ALTER TABLE public.user_routine_exercises
  DROP CONSTRAINT IF EXISTS user_routine_exercises_weight_unit_check;

ALTER TABLE public.user_routine_exercises
  ADD CONSTRAINT user_routine_exercises_weight_unit_check
    CHECK (weight_unit IN ('lbs', 'pins', 'kg'));
