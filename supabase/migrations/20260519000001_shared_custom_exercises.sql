-- GYM-68: Move cable_curl_low_pulley and seated_cable_fly from exercises.json
-- (static, read-only) into Supabase as shared custom exercises
-- (is_custom=true, created_by=NULL, metadata_complete=false).
-- Any authenticated user can complete, edit, or delete shared exercises.

UPDATE exercises
SET is_custom = true, metadata_complete = false
WHERE name IN ('Cable Curl (Low Pulley)', 'Seated Cable Fly');

-- Expand SELECT: shared custom exercises visible to all authenticated users
DROP POLICY IF EXISTS exercises_select ON exercises;
CREATE POLICY exercises_select ON exercises FOR SELECT USING (
  (NOT is_custom)
  OR (created_by = auth.uid())
  OR (is_custom AND created_by IS NULL)
);

-- Expand UPDATE: any auth user can edit shared exercises (created_by IS NULL)
DROP POLICY IF EXISTS exercises_update_own ON exercises;
CREATE POLICY exercises_update_own ON exercises FOR UPDATE USING (
  (auth.uid() = created_by)
  OR (is_custom = true AND created_by IS NULL)
);

-- Expand DELETE: any auth user can delete shared exercises (created_by IS NULL)
DROP POLICY IF EXISTS exercises_delete_own ON exercises;
CREATE POLICY exercises_delete_own ON exercises FOR DELETE USING (
  (auth.uid() = created_by)
  OR (is_custom = true AND created_by IS NULL)
);
