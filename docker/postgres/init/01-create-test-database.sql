-- Integration tests run against a real, separate database (AGENTS.md: never mock the database).
-- This only runs when the data volume is first created. After changing it, run `pnpm db:reset`.
CREATE DATABASE inventory_test;
