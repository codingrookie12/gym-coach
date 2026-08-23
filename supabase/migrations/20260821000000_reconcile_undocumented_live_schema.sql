-- Reconciliation migration: documents columns/tables confirmed present in the live
-- production database (rlcxbtovzqdagqyzywef.supabase.co) that had no corresponding
-- entry anywhere in this migration history. Discovered during the 2026-08-21 gym-coach
-- revamp's Phase 0 schema-drift audit (see docs/redesign/ROADMAP.md on the unmerged
-- redesign/phase1-foundation branch, which claims these were "applied live" during
-- exploratory work on that branch — confirmed accurate for these three items only;
-- the branch's equipment_type/equipment_instance_id columns were NOT actually applied
-- and are correctly absent).
--
-- All statements are idempotent (IF NOT EXISTS) and additive-only — no existing column,
-- constraint, or row is altered. Confirmed via live read-only probe before writing this:
--   - exercises.family_id / exercises.variant_label: present, sparsely populated
--     (2 of 200 sampled rows), UUID / TEXT respectively.
--   - user_routine_exercises.exercise_id: present, UUID, 0 of 68 rows populated
--     (unused today — safe foundation for Phase 2's exercise_id-based matching work).
--   - equipment_instances table: present live, but EMPTY (0 rows) and its full column
--     shape could not be reconciled from data alone (no rows to introspect via
--     PostgREST). Deliberately NOT touched by this migration — out of scope until the
--     kg/lbs unit-system work (plan Section 5) actually begins, at which point its real
--     live shape should be introspected directly (via Supabase Studio's table editor or
--     the CLI) before deciding whether to keep, rebuild, or drop it.

alter table exercises
  add column if not exists family_id uuid,
  add column if not exists variant_label text;

comment on column exercises.family_id is
  'Groups exercise variants (e.g. grip/stance variations of the same base movement) under a shared identifier. Reconciled 2026-08-21 from undocumented live schema; sparsely populated as of reconciliation.';
comment on column exercises.variant_label is
  'Human-readable label distinguishing a variant within its family_id group (e.g. "Wide Grip", "Single-Arm"). Reconciled 2026-08-21.';

alter table user_routine_exercises
  add column if not exists exercise_id uuid references exercises(id);

comment on column user_routine_exercises.exercise_id is
  'FK to exercises.id — the ID-based replacement for name-string exercise matching. Reconciled 2026-08-21 from undocumented live schema; unpopulated as of reconciliation (0 rows). This is the column the 2026-08-21 revamp''s Phase 2 (coaching engine redesign) builds its exercise_id-based matching on.';

-- Intentionally not touched: equipment_instances table (exists live, empty, schema not
-- reconciled here) and exercise_weight_override.equipment_instance_id/equipment_instance
-- (confirmed NOT present live despite the redesign branch's roadmap implying otherwise —
-- no action needed, there is nothing to reconcile for these).
