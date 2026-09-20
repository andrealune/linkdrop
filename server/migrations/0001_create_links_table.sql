-- 0001_create_links_table.sql
--
-- Creates the `links` table: the core entity of the application (a saved
-- URL with an optional title, free-form tags and a creation timestamp).
--
-- Locking behaviour: the table does not exist yet, so CREATE TABLE and the
-- two CREATE INDEX statements acquire no lock on any pre-existing object.
-- On an already-initialised database the IF NOT EXISTS guards make this
-- file safe to re-run; a normal run against an empty database completes
-- instantly regardless of row counts elsewhere, since nothing here scans
-- an existing table.
--
-- Rollback path: this system runs migrations forward-only (`migrate:up`).
-- To revert before any dependent migration exists, run manually:
--     DROP TABLE IF EXISTS links;
-- and delete the corresponding row from schema_migrations. Once later
-- migrations or application data depend on `links`, write a new
-- hand-reviewed migration to change course instead of rolling this back.
--
-- Data impact: none — this creates a new, empty table and indexes.

CREATE TABLE IF NOT EXISTS links (
    id BIGSERIAL PRIMARY KEY,
    url TEXT NOT NULL CHECK (btrim(url) <> ''),
    title TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supports the default "most recent links first" listing query.
CREATE INDEX IF NOT EXISTS idx_links_created_at ON links (created_at DESC);

-- Supports filtering links by tag (tags @> ARRAY['some-tag']).
CREATE INDEX IF NOT EXISTS idx_links_tags ON links USING GIN (tags);
