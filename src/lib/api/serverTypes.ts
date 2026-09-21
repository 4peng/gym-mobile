// Server-side types (MongoDB document shapes)
// These mirror the MongoDB collection schemas.
// ObjectId is represented as `string` here because the API boundary
// serializes everything as JSON - actual ObjectId wrapping happens
// only in the fetch body via `converters.ts`.

interface ProgramExerciseServer {
  id: string;
  exerciseDefinitionId?: string;
  trackingMode?: string;
  name: string;
  // Legacy docs (pre-template-sync-fix) store a plain set count (number).
  // Current docs store the full set-type template array so warmup/dropset
  // markers survive the sync round-trip. converters.ts tolerantly reads
  // both shapes.
  defaultSets: number | { type: "working" | "warmup" | "dropset" }[];
  restSeconds: number;
  notes: string;
  weightUnit?: string;
  initialWeight?: number | null;
  muscles: string[];
  isBodyweight?: boolean;
}

export interface ProgramServer {
  _id: string; // ObjectId string from Mongo
  userId: string;
  name: string;
  exercises: ProgramExerciseServer[];
  createdAt: string; // ISO-8601
  updatedAt: number; // epoch-ms
}

interface WorkoutSetServer {
  id: string;
  weight: number | null;
  reps: number | null;
  type?: string;
  durationSeconds?: number | null;
  distance?: number | null;
  completedAt?: string;
}

interface WorkoutExerciseServer {
  id: string;
  exerciseDefinitionId?: string;
  trackingMode?: string;
  name: string;
  restSeconds: number;
  notes: string;
  sets: WorkoutSetServer[];
  weightUnit?: string;
  muscles: string[];
  isBodyweight?: boolean;
}

export interface WorkoutServer {
  _id: string; // ObjectId string from Mongo
  userId: string;
  programId?: string;
  startedAt: string;
  completedAt?: string;
  updatedAt: number; // epoch-ms
  notes: string;
  exercises: WorkoutExerciseServer[];
}
