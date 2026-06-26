-- SQLite <3.35 does not support DROP COLUMN.
-- The phase column is nullable with DEFAULT NULL and is backward-compatible to leave in place.
-- No destructive action is required for rollback.
SELECT 1;
