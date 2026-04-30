-- GYM-45: Per-user routine storage and multi-program support

-- ─────────────────────────────────────────────
-- 1. Add active_program_id to users
-- ─────────────────────────────────────────────
ALTER TABLE users ADD COLUMN active_program_id TEXT NOT NULL DEFAULT 'ppl-default';

-- ─────────────────────────────────────────────
-- 2. Expand training_modes with new split names
-- ─────────────────────────────────────────────
INSERT INTO training_modes (name, description) VALUES
  -- 5/3/1
  ('OHP Day',      'Overhead press main lift + push/pull assistance'),
  ('Deadlift Day', 'Deadlift main lift + posterior chain assistance'),
  ('Bench Day',    'Bench press main lift + push/pull assistance'),
  ('Squat Day',    'Squat main lift + leg assistance'),
  -- Upper/Lower
  ('Upper A', 'Upper body — horizontal push/pull emphasis'),
  ('Lower A', 'Lower body — squat dominant'),
  ('Upper B', 'Upper body — vertical push/pull emphasis'),
  ('Lower B', 'Lower body — hinge dominant'),
  -- Full Body 3x
  ('Full Body A', 'Full body — squat, bench, row emphasis'),
  ('Full Body B', 'Full body — deadlift, press, pulldown emphasis'),
  ('Full Body C', 'Full body — hack squat, incline, cable emphasis'),
  -- StrongLifts 5x5
  ('Day A', 'StrongLifts workout A — squat / bench / row'),
  ('Day B', 'StrongLifts workout B — squat / press / deadlift')
ON CONFLICT (name) DO NOTHING;

-- ─────────────────────────────────────────────
-- 3. user_routine_exercises
-- ─────────────────────────────────────────────
CREATE TABLE user_routine_exercises (
  id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  training_mode_id  UUID         NOT NULL REFERENCES training_modes(id) ON DELETE RESTRICT,
  exercise_name     TEXT         NOT NULL,
  notion_name       TEXT         NOT NULL,
  sets              SMALLINT     NOT NULL DEFAULT 3,
  rep_range_min     SMALLINT     NOT NULL DEFAULT 8,
  rep_range_max     SMALLINT     NOT NULL DEFAULT 12,
  backup_name       TEXT,
  weight_unit       TEXT         NOT NULL DEFAULT 'lbs' CHECK (weight_unit IN ('lbs', 'pins')),
  weight_convention TEXT,
  sort_order        SMALLINT     NOT NULL DEFAULT 0,
  equipment         TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, training_mode_id, exercise_name)
);

-- updated_at trigger
CREATE TRIGGER trg_user_routine_exercises_updated_at
  BEFORE UPDATE ON user_routine_exercises
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────
-- 4. Indexes
-- ─────────────────────────────────────────────
CREATE INDEX idx_ure_user_mode ON user_routine_exercises(user_id, training_mode_id);

-- ─────────────────────────────────────────────
-- 5. Row Level Security
-- ─────────────────────────────────────────────
ALTER TABLE user_routine_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ure_select_own"
  ON user_routine_exercises FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "ure_insert_own"
  ON user_routine_exercises FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ure_update_own"
  ON user_routine_exercises FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "ure_delete_own"
  ON user_routine_exercises FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
