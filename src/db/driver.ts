/**
 * Minimal synchronous SQL surface. The app binds it to expo-sqlite; tests bind
 * it to Node's built-in `node:sqlite`, so the repository SQL runs for real in Jest.
 */
export type SqlParam = string | number | null;

export interface SqlDriver {
  all<T>(sql: string, params?: SqlParam[]): T[];
  first<T>(sql: string, params?: SqlParam[]): T | null;
  run(sql: string, params?: SqlParam[]): void;
  exec(sql: string): void;
  transaction(fn: () => void): void;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY,
  program_id TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  cumulative_rest_seconds INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_workouts_completed ON workouts(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_workouts_program ON workouts(program_id);
CREATE TABLE IF NOT EXISTS workout_exercises (
  workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  identity_key TEXT NOT NULL,
  json TEXT NOT NULL,
  PRIMARY KEY (workout_id, position)
);
CREATE INDEX IF NOT EXISTS idx_exercises_identity ON workout_exercises(identity_key);
`;

/** Idempotent: creates tables and indexes, enables cascading deletes. */
export function applySchema(db: SqlDriver): void {
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
}
