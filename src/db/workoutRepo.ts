import type { WorkoutExercise, WorkoutSession } from "@/types";
import { getExerciseIdentityKey } from "@/utils/exerciseIdentity";
import { bumpDbVersion } from "./dbVersion";
import type { SqlDriver } from "./driver";

interface WorkoutRow {
  id: string;
  program_id: string | null;
  started_at: string;
  completed_at: string;
  updated_at: number;
  notes: string;
  cumulative_rest_seconds: number;
}

interface ExerciseJoinRow {
  workout_id: string;
  started_at: string;
  completed_at: string;
  json: string;
}

/** One exercise as it appeared in one completed session. */
export interface ExerciseRow {
  workoutId: string;
  startedAt: string;
  completedAt: string;
  exercise: WorkoutExercise;
}

type EditableSetField = "weight" | "reps" | "durationSeconds" | "distance";

const toSession = (row: WorkoutRow, exercises: WorkoutExercise[]): WorkoutSession => ({
  _id: row.id,
  userId: "",
  programId: row.program_id ?? undefined,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  updatedAt: row.updated_at,
  notes: row.notes,
  exercises,
  cumulativeRestSeconds: row.cumulative_rest_seconds,
});

/**
 * Completed-workout storage. Sessions live in `workouts`, each exercise as a JSON
 * row in `workout_exercises` keyed by identity so per-exercise stats are indexed reads.
 * All methods are synchronous; writers bump the db version so `useDbQuery` re-runs.
 */
export function createWorkoutRepo(db: SqlDriver, userId: string) {
  const withUser = (s: WorkoutSession) => ({ ...s, userId });

  function exercisesFor(ids: string[]): Map<string, WorkoutExercise[]> {
    const map = new Map<string, WorkoutExercise[]>();
    if (ids.length === 0) return map;
    const placeholders = ids.map(() => "?").join(",");
    const rows = db.all<{ workout_id: string; json: string }>(
      `SELECT workout_id, json FROM workout_exercises WHERE workout_id IN (${placeholders}) ORDER BY workout_id, position`,
      ids,
    );
    for (const r of rows) {
      const list = map.get(r.workout_id) ?? [];
      list.push(JSON.parse(r.json));
      map.set(r.workout_id, list);
    }
    return map;
  }

  function hydrate(rows: WorkoutRow[]): WorkoutSession[] {
    const ex = exercisesFor(rows.map((r) => r.id));
    return rows.map((r) => withUser(toSession(r, ex.get(r.id) ?? [])));
  }

  function writeExercises(workoutId: string, exercises: WorkoutExercise[]) {
    db.run("DELETE FROM workout_exercises WHERE workout_id = ?", [workoutId]);
    exercises.forEach((exercise, position) => {
      db.run(
        "INSERT INTO workout_exercises (workout_id, position, identity_key, json) VALUES (?, ?, ?, ?)",
        [workoutId, position, getExerciseIdentityKey(exercise), JSON.stringify(exercise)],
      );
    });
  }

  /** Loads the sessions holding `ids`, applies `edit` in a transaction, re-saves the changed ones. */
  function editSessions(ids: string[], edit: (session: WorkoutSession) => boolean): string[] {
    const changed: string[] = [];
    db.transaction(() => {
      for (const session of getMany(ids)) {
        if (!edit(session)) continue;
        session.updatedAt = Date.now();
        upsertOne(session);
        changed.push(session._id);
      }
    });
    if (changed.length > 0) bumpDbVersion();
    return changed;
  }

  function upsertOne(s: WorkoutSession) {
    if (!s.completedAt) return;
    db.run(
      `INSERT INTO workouts (id, program_id, started_at, completed_at, updated_at, notes, cumulative_rest_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET program_id = excluded.program_id, started_at = excluded.started_at,
         completed_at = excluded.completed_at, updated_at = excluded.updated_at, notes = excluded.notes,
         cumulative_rest_seconds = excluded.cumulative_rest_seconds`,
      [
        s._id,
        s.programId ?? null,
        s.startedAt,
        s.completedAt,
        s.updatedAt,
        s.notes ?? "",
        s.cumulativeRestSeconds ?? 0,
      ],
    );
    writeExercises(s._id, s.exercises);
  }

  function getMany(ids: string[]): WorkoutSession[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(",");
    return hydrate(db.all<WorkoutRow>(`SELECT * FROM workouts WHERE id IN (${placeholders})`, ids));
  }

  return {
    /** Inserts or replaces completed sessions (incomplete ones are skipped). */
    upsertMany(sessions: WorkoutSession[]): void {
      if (sessions.length === 0) return;
      db.transaction(() => sessions.forEach(upsertOne));
      bumpDbVersion();
    },

    deleteMany(ids: string[]): void {
      if (ids.length === 0) return;
      db.transaction(() => ids.forEach((id) => db.run("DELETE FROM workouts WHERE id = ?", [id])));
      bumpDbVersion();
    },

    clear(): void {
      db.exec("DELETE FROM workouts;");
      bumpDbVersion();
    },

    count(): number {
      return db.first<{ n: number }>("SELECT COUNT(*) AS n FROM workouts")?.n ?? 0;
    },

    get(id: string): WorkoutSession | null {
      return getMany([id])[0] ?? null;
    },

    getMany,

    /** Newest first. */
    list(limit: number, offset = 0): WorkoutSession[] {
      return hydrate(
        db.all<WorkoutRow>("SELECT * FROM workouts ORDER BY completed_at DESC LIMIT ? OFFSET ?", [
          limit,
          offset,
        ]),
      );
    },

    /** Start/end timestamps of sessions completed on or after `sinceIso` (dashboard activity). */
    summariesSince(sinceIso: string): { startedAt: string; completedAt: string }[] {
      return db
        .all<{ started_at: string; completed_at: string }>(
          "SELECT started_at, completed_at FROM workouts WHERE completed_at >= ? ORDER BY completed_at DESC",
          [sinceIso],
        )
        .map((r) => ({ startedAt: r.started_at, completedAt: r.completed_at }));
    },

    /** Most recent completion time per program id (epoch ms). */
    lastUsedByProgram(): Map<string, number> {
      const rows = db.all<{ program_id: string; last: string }>(
        "SELECT program_id, MAX(completed_at) AS last FROM workouts WHERE program_id IS NOT NULL GROUP BY program_id",
      );
      return new Map(rows.map((r) => [r.program_id, new Date(r.last).getTime()]));
    },

    /** Every occurrence of one exercise, newest first, optionally only since `sinceIso`. */
    exerciseHistory(identityKey: string, sinceIso?: string): ExerciseRow[] {
      const rows = db.all<ExerciseJoinRow>(
        `SELECT w.id AS workout_id, w.started_at, w.completed_at, e.json
         FROM workout_exercises e JOIN workouts w ON w.id = e.workout_id
         WHERE e.identity_key = ? ${sinceIso ? "AND w.completed_at >= ?" : ""}
         ORDER BY w.completed_at DESC, e.position`,
        sinceIso ? [identityKey, sinceIso] : [identityKey],
      );
      return rows.map((r) => ({
        workoutId: r.workout_id,
        startedAt: r.started_at,
        completedAt: r.completed_at,
        exercise: JSON.parse(r.json),
      }));
    },

    /** The most recent occurrence of one exercise, or null. */
    latestExercise(identityKey: string): WorkoutExercise | null {
      const row = db.first<{ json: string }>(
        `SELECT e.json FROM workout_exercises e JOIN workouts w ON w.id = e.workout_id
         WHERE e.identity_key = ? ORDER BY w.completed_at DESC LIMIT 1`,
        [identityKey],
      );
      return row ? JSON.parse(row.json) : null;
    },

    /** The `perExercise` most recent occurrences of every exercise, newest first within each. */
    recentExercises(perExercise: number): (ExerciseRow & { identityKey: string })[] {
      const rows = db.all<ExerciseJoinRow & { identity_key: string }>(
        `SELECT workout_id, started_at, completed_at, json, identity_key FROM (
           SELECT w.id AS workout_id, w.started_at, w.completed_at, e.json, e.identity_key,
                  ROW_NUMBER() OVER (PARTITION BY e.identity_key ORDER BY w.completed_at DESC) AS rn
           FROM workout_exercises e JOIN workouts w ON w.id = e.workout_id
         ) WHERE rn <= ? ORDER BY identity_key, completed_at DESC`,
        [perExercise],
      );
      return rows.map((r) => ({
        workoutId: r.workout_id,
        startedAt: r.started_at,
        completedAt: r.completed_at,
        identityKey: r.identity_key,
        exercise: JSON.parse(r.json),
      }));
    },

    /** Applies `mutate` to every stored exercise; returns ids of sessions that changed. */
    rewriteExercises(mutate: (exercise: WorkoutExercise) => boolean): string[] {
      const ids = db.all<{ id: string }>("SELECT id FROM workouts").map((r) => r.id);
      return editSessions(ids, (session) => {
        let changed = false;
        session.exercises.forEach((ex) => {
          if (mutate(ex)) changed = true;
        });
        return changed;
      });
    },

    /** Moves a session to a new completion timestamp. Returns true if it existed. */
    updateDate(id: string, completedAtIso: string): boolean {
      return (
        editSessions([id], (s) => {
          s.completedAt = completedAtIso;
          return true;
        }).length > 0
      );
    },

    updateSet(
      workoutId: string,
      exerciseId: string,
      setId: string,
      field: EditableSetField,
      value: number | null,
    ): boolean {
      return (
        editSessions([workoutId], (s) => {
          const set = s.exercises
            .find((e) => e.id === exerciseId)
            ?.sets.find((x) => x.id === setId);
          if (!set) return false;
          set[field] = value;
          return true;
        }).length > 0
      );
    },

    /** updatedAt per id, for the push-clear guard. */
    updatedAtOf(ids: string[]): Map<string, number> {
      if (ids.length === 0) return new Map();
      const rows = db.all<{ id: string; updated_at: number }>(
        `SELECT id, updated_at FROM workouts WHERE id IN (${ids.map(() => "?").join(",")})`,
        ids,
      );
      return new Map(rows.map((r) => [r.id, r.updated_at]));
    },
  };
}

export type WorkoutRepo = ReturnType<typeof createWorkoutRepo>;
