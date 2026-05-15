-- GYM-84: Future-proof for Supabase's Oct 30, 2026 Data API change.
--
-- After Oct 30, 2026, new tables created in `public` will NOT be auto-exposed
-- to the Data API (supabase-js / PostgREST / GraphQL) — explicit GRANTs are
-- required, otherwise the client returns a 42501 error.
--
-- ALTER DEFAULT PRIVILEGES applies grants automatically to objects created
-- AFTER this migration runs, by the same role that runs it (Supabase migrations
-- run as `postgres`, which is the right owner). Existing tables are unaffected
-- and keep their current grants.

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT                         ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL                            ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT                  ON SEQUENCES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE                        ON FUNCTIONS TO authenticated, service_role;
