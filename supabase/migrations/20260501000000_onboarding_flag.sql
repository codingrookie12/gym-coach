-- GYM-39: Add onboarding_completed flag to users
-- Backfill existing users as completed so they skip onboarding.
-- New sign-ups get FALSE via the column default.

ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users SET onboarding_completed = TRUE;
