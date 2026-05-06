-- GYM-79: Custom Program Builder — Phase 1 (additive schema)
--
-- Strategy: delete-first. Every program becomes a `user_programs` row.
-- Curated programs (PPL, 5/3/1, etc.) are code-level templates that get
-- cloned into the user's account at selection time.
--
-- This migration is purely additive: new tables + new nullable columns.
-- Backfill of existing rows + drops of legacy columns/tables happen in
-- follow-up migrations once the application layer can read both shapes.

-- ─────────────────────────────────────────────
-- 1. user_programs
-- ─────────────────────────────────────────────
CREATE TABLE user_programs (
  id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                TEXT         NOT NULL CHECK (char_length(name) BETWEEN 3 AND 60),
  source_template_id  TEXT,        -- 'ppl-default' / 'wendler-531' / NULL for fully-custom
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE TRIGGER trg_user_programs_updated_at
  BEFORE UPDATE ON user_programs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_user_programs_user_id ON user_programs(user_id);

-- ─────────────────────────────────────────────
-- 2. user_program_splits
-- ─────────────────────────────────────────────
CREATE TABLE user_program_splits (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_program_id UUID         NOT NULL REFERENCES user_programs(id) ON DELETE CASCADE,
  name            TEXT         NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  sort_order      SMALLINT     NOT NULL,
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_program_id, name),
  UNIQUE (user_program_id, sort_order)
);

CREATE INDEX idx_user_program_splits_program ON user_program_splits(user_program_id);

-- ─────────────────────────────────────────────
-- 3. Add user_program_split_id to user_routine_exercises (nullable)
--    Add program_note for curated metadata (5/3/1 wave info, etc.)
-- ─────────────────────────────────────────────
ALTER TABLE user_routine_exercises
  ADD COLUMN user_program_split_id UUID REFERENCES user_program_splits(id) ON DELETE CASCADE,
  ADD COLUMN program_note          TEXT;

CREATE INDEX idx_ure_user_split
  ON user_routine_exercises(user_id, user_program_split_id)
  WHERE user_program_split_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- 4. Add user_program_split_id to workouts (nullable)
--    ON DELETE RESTRICT preserves history when splits are archived
-- ─────────────────────────────────────────────
ALTER TABLE workouts
  ADD COLUMN user_program_split_id UUID REFERENCES user_program_splits(id) ON DELETE RESTRICT;

CREATE INDEX idx_workouts_user_split_date
  ON workouts(user_id, user_program_split_id, date DESC)
  WHERE user_program_split_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- 5. Add active_user_program_id to users (nullable)
--    Coexists with active_program_id during transition
-- ─────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN active_user_program_id UUID REFERENCES user_programs(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────
-- 6. Row Level Security
-- ─────────────────────────────────────────────
ALTER TABLE user_programs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_program_splits  ENABLE ROW LEVEL SECURITY;

-- user_programs: full CRUD on own rows
CREATE POLICY "user_programs_select_own"
  ON user_programs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_programs_insert_own"
  ON user_programs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_programs_update_own"
  ON user_programs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_programs_delete_own"
  ON user_programs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- user_program_splits: ownership delegated through parent user_program
CREATE POLICY "user_program_splits_select_own"
  ON user_program_splits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_programs up WHERE up.id = user_program_id AND up.user_id = auth.uid()));
CREATE POLICY "user_program_splits_insert_own"
  ON user_program_splits FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_programs up WHERE up.id = user_program_id AND up.user_id = auth.uid()));
CREATE POLICY "user_program_splits_update_own"
  ON user_program_splits FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_programs up WHERE up.id = user_program_id AND up.user_id = auth.uid()));
CREATE POLICY "user_program_splits_delete_own"
  ON user_program_splits FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_programs up WHERE up.id = user_program_id AND up.user_id = auth.uid()));
