ALTER TABLE workouts ADD COLUMN finished_at TIMESTAMPTZ;

-- Backfill started_at and finished_at from sets timestamps for existing workouts
UPDATE workouts w
SET
  started_at = s.first_set,
  finished_at = s.last_set
FROM (
  SELECT workout_id, MIN(created_at) AS first_set, MAX(created_at) AS last_set
  FROM sets
  GROUP BY workout_id
) s
WHERE w.id = s.workout_id
  AND w.started_at IS NULL;
