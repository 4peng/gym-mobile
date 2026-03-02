// ──────────────────────────────────────────────
// Client-side types (string IDs, no ObjectId)
// ──────────────────────────────────────────────

/** A single exercise definition inside a Program template. */
export interface ProgramExercise {
  id: string;
  name: string;
  defaultSets: number;
  restSeconds: number;
  notes: string;
  weightUnit?: "kg" | "lbs";
}

/** A saved program / template. */
export interface Program {
  _id: string; // UUID on client, ObjectId string from backend
  userId: string;
  name: string;
  exercises: ProgramExercise[];
  pinned?: boolean;
  createdAt: string; // ISO-8601
  updatedAt: number; // epoch-ms, required for last-write-wins sync
  deletedAt?: number | null; // epoch-ms, presence means the item is a tombstone
}

// ──────────────────────────────────────────────

/** A single logged set inside a workout exercise. */
export interface WorkoutSet {
  id: string;
  weight: number | null; // null = untouched / placeholder state
  reps: number | null; // null = untouched / placeholder state
  completedAt?: string; // ISO-8601
}

/** A single exercise inside an active or completed workout session. */
export interface WorkoutExercise {
  id: string;
  name: string;
  restSeconds: number;
  timerStartedAt?: string; // ISO-8601, for future expo-notifications
  notes: string;
  sets: WorkoutSet[];
  weightUnit?: "kg" | "lbs";
}

/** A workout session document. */
export interface WorkoutSession {
  _id: string; // UUID on client
  userId: string;
  programId?: string; // string, not ObjectId
  startedAt: string; // ISO-8601
  completedAt?: string; // ISO-8601
  updatedAt: number; // epoch-ms, required for last-write-wins sync
  deletedAt?: number | null; // epoch-ms, presence means the item is a tombstone
  exercises: WorkoutExercise[];
}

// ──────────────────────────────────────────────
// Backend ↔ Client conversion helpers
// ──────────────────────────────────────────────
// The canonical conversion boundary now lives in lib/api/converters.ts.
// The helpers below are kept for backward compatibility but delegate to
// the same logic: stringify _id / programId.

export function toClientSession(raw: Record<string, unknown>): WorkoutSession {
  return {
    ...raw,
    _id: String(raw._id),
    programId: raw.programId ? String(raw.programId) : undefined,
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  } as WorkoutSession;
}

export function toClientProgram(raw: Record<string, unknown>): Program {
  return {
    ...raw,
    _id: String(raw._id),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  } as Program;
}
