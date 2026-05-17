-- GYM-94: Track provenance of every user_routine_exercises row.
-- Every INSERT must declare its origin so "ghost exercise" reports are
-- one SQL query away from a root cause.

ALTER TABLE user_routine_exercises
  ADD COLUMN added_via TEXT;

-- Backfill: all existing rows were inserted via cloneTemplate or
-- createBlankProgram. Map by source_template_id on the parent program.
UPDATE user_routine_exercises ure
SET added_via = CASE
  WHEN up.source_template_id IS NOT NULL THEN 'template-clone'
  ELSE 'custom-program-create'
END
FROM user_program_splits ups
JOIN user_programs up ON up.id = ups.user_program_id
WHERE ure.user_program_split_id = ups.id
  AND ure.added_via IS NULL;

ALTER TABLE user_routine_exercises
  ALTER COLUMN added_via SET NOT NULL,
  ADD CONSTRAINT user_routine_exercises_added_via_check
    CHECK (added_via IN ('template-clone','custom-program-create','manual-add','manual-swap'));
