-- GYM-79: Drop legacy training_modes-era schema after the unified path is live.
-- Safe ONLY after Steps 1–7 have shipped and the app reads via user_program_split_id.

-- 1. Make new FKs required
ALTER TABLE user_routine_exercises ALTER COLUMN user_program_split_id SET NOT NULL;
ALTER TABLE workouts                ALTER COLUMN user_program_split_id SET NOT NULL;

-- 2. New unique indexes (replacing legacy uniques tied to training_mode_id)
CREATE UNIQUE INDEX ure_uniq      ON user_routine_exercises (user_id, user_program_split_id, exercise_name);
CREATE UNIQUE INDEX workouts_uniq ON workouts (user_id, date, user_program_split_id);

-- 3. Drop legacy columns and constraints
ALTER TABLE user_routine_exercises
  DROP CONSTRAINT IF EXISTS user_routine_exercises_user_id_training_mode_id_exercise_n_key,
  DROP COLUMN training_mode_id;
ALTER TABLE workouts
  DROP CONSTRAINT IF EXISTS workouts_user_id_date_training_mode_id_key,
  DROP COLUMN training_mode_id;

-- 4. Drop legacy text active_program_id
ALTER TABLE users DROP COLUMN active_program_id;

-- 5. Drop training_modes (and its FK from exercises)
ALTER TABLE exercises DROP COLUMN training_mode_id;
DROP TABLE training_modes;
