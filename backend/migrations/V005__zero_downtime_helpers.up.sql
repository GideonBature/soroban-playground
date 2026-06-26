-- Adds phase tracking to _schema_migrations for expand-and-contract deployment pattern.
-- @phase: expand
-- Safe: nullable column with DEFAULT, no table lock required in SQLite.
ALTER TABLE _schema_migrations ADD COLUMN phase TEXT DEFAULT NULL;
