-- GYM-68: persist `split` on custom exercises.
-- Canonical exercises continue to source `split` from lib/exercises.json (static catalog);
-- this column is populated only for is_custom = true rows, set when the user completes metadata.
ALTER TABLE exercises ADD COLUMN split TEXT;
