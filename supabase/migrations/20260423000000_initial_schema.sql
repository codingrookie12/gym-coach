-- GYM-24: Full Supabase schema
-- Dependency: run only after GYM-23 Notion snapshot is committed to main.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- 1. training_modes
-- ─────────────────────────────────────────────
CREATE TABLE training_modes (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO training_modes (name, description) VALUES
  ('Push', 'Chest, shoulders, triceps'),
  ('Pull', 'Back, biceps, rear delts'),
  ('Legs', 'Quads, hamstrings, glutes, calves');

-- ─────────────────────────────────────────────
-- 2. users
-- ─────────────────────────────────────────────
CREATE TABLE users (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 3. exercises
-- ─────────────────────────────────────────────
CREATE TABLE exercises (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT        NOT NULL UNIQUE,
  training_mode_id  UUID        REFERENCES training_modes(id) ON DELETE SET NULL,
  equipment         TEXT,
  primary_muscles   TEXT[],
  secondary_muscles TEXT[],
  instructions      TEXT[],
  images            TEXT[],     -- Supabase Storage paths: ['exercise-images/<id>/0.jpg', '…/1.jpg']
  force             TEXT,       -- 'pull' | 'push' | 'static' | null
  level             TEXT,       -- 'beginner' | 'intermediate' | 'expert'
  mechanic          TEXT,       -- 'compound' | 'isolation' | null
  category          TEXT,       -- 'strength' | 'cardio' | 'stretching' | etc.
  is_custom         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by        UUID        REFERENCES users(id) ON DELETE SET NULL,
  metadata_complete BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 4. exercise_availability  (sparse — presence = unavailable)
-- ─────────────────────────────────────────────
CREATE TABLE exercise_availability (
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id UUID        NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, exercise_id)
);

-- ─────────────────────────────────────────────
-- 5. workouts
-- ─────────────────────────────────────────────
CREATE TABLE workouts (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  training_mode_id UUID        NOT NULL REFERENCES training_modes(id) ON DELETE RESTRICT,
  date             DATE        NOT NULL,
  started_at       TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date, training_mode_id)
);

-- ─────────────────────────────────────────────
-- 6. sets
-- ─────────────────────────────────────────────
CREATE TABLE sets (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_id  UUID        NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id UUID        NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  set_number  SMALLINT    NOT NULL CHECK (set_number > 0),
  weight      NUMERIC(6,2),
  reps        SMALLINT    CHECK (reps > 0),
  unit        TEXT        NOT NULL DEFAULT 'Lbs' CHECK (unit IN ('Lbs', 'Kg', 'Pins')),
  completed   BOOLEAN     NOT NULL DEFAULT TRUE,
  skipped     BOOLEAN     NOT NULL DEFAULT FALSE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 7. exercise_weight_override
-- ─────────────────────────────────────────────
CREATE TABLE exercise_weight_override (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id     UUID        NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  override_weight NUMERIC(6,2) NOT NULL,
  unit            TEXT        NOT NULL DEFAULT 'Lbs' CHECK (unit IN ('Lbs', 'Kg', 'Pins')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, exercise_id)
);

-- ─────────────────────────────────────────────
-- 8. failed_syncs
-- ─────────────────────────────────────────────
CREATE TABLE failed_syncs (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID        REFERENCES users(id) ON DELETE SET NULL,
  payload           JSONB       NOT NULL,
  error_message     TEXT,
  retry_count       INTEGER     NOT NULL DEFAULT 0,
  last_attempted_at TIMESTAMPTZ,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- updated_at trigger
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workouts_updated_at
  BEFORE UPDATE ON workouts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sets_updated_at
  BEFORE UPDATE ON sets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_exercise_weight_override_updated_at
  BEFORE UPDATE ON exercise_weight_override
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_exercise_availability_updated_at
  BEFORE UPDATE ON exercise_availability
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────
CREATE INDEX idx_workouts_user_id        ON workouts(user_id);
CREATE INDEX idx_workouts_user_date_mode ON workouts(user_id, training_mode_id, date DESC);
CREATE INDEX idx_sets_workout_id         ON sets(workout_id);
CREATE INDEX idx_sets_exercise_id        ON sets(exercise_id);
CREATE INDEX idx_availability_user_id    ON exercise_availability(user_id);
CREATE INDEX idx_override_user_exercise  ON exercise_weight_override(user_id, exercise_id);
CREATE INDEX idx_failed_syncs_user_id    ON failed_syncs(user_id);

-- ─────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────
ALTER TABLE training_modes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises              ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_availability  ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE sets                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_weight_override ENABLE ROW LEVEL SECURITY;
ALTER TABLE failed_syncs           ENABLE ROW LEVEL SECURITY;

-- training_modes: readable by all authenticated users
CREATE POLICY "training_modes_select"
  ON training_modes FOR SELECT TO authenticated USING (true);

-- users: own row only
CREATE POLICY "users_select_own"
  ON users FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "users_update_own"
  ON users FOR UPDATE TO authenticated USING (auth.uid() = id);

-- exercises: canonical = public; custom = private to creator
CREATE POLICY "exercises_select"
  ON exercises FOR SELECT TO authenticated
  USING (NOT is_custom OR created_by = auth.uid());
CREATE POLICY "exercises_insert_custom"
  ON exercises FOR INSERT TO authenticated
  WITH CHECK (is_custom = TRUE AND auth.uid() = created_by);
CREATE POLICY "exercises_update_own"
  ON exercises FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);
CREATE POLICY "exercises_delete_own"
  ON exercises FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- exercise_availability: own rows only
CREATE POLICY "availability_select_own"
  ON exercise_availability FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "availability_insert_own"
  ON exercise_availability FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "availability_update_own"
  ON exercise_availability FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "availability_delete_own"
  ON exercise_availability FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- workouts: own rows only
CREATE POLICY "workouts_select_own"
  ON workouts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "workouts_insert_own"
  ON workouts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "workouts_update_own"
  ON workouts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "workouts_delete_own"
  ON workouts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- sets: scoped through workout ownership
CREATE POLICY "sets_select_own"
  ON sets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_id AND w.user_id = auth.uid()));
CREATE POLICY "sets_insert_own"
  ON sets FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_id AND w.user_id = auth.uid()));
CREATE POLICY "sets_update_own"
  ON sets FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_id AND w.user_id = auth.uid()));
CREATE POLICY "sets_delete_own"
  ON sets FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_id AND w.user_id = auth.uid()));

-- exercise_weight_override: own rows only
CREATE POLICY "override_select_own"
  ON exercise_weight_override FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "override_insert_own"
  ON exercise_weight_override FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "override_update_own"
  ON exercise_weight_override FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "override_delete_own"
  ON exercise_weight_override FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- failed_syncs: users can view their own; service_role manages writes
CREATE POLICY "failed_syncs_select_own"
  ON failed_syncs FOR SELECT TO authenticated USING (auth.uid() = user_id);
