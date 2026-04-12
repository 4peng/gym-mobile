// Server-side types (MongoDB document shapes)
// These mirror the MongoDB collection schemas.
// ObjectId is represented as `string` here because the API boundary
// serializes everything as JSON - actual ObjectId wrapping happens
// only in the fetch body via `converters.ts`.

export interface ProgramExerciseServer {
  id: string;
  exerciseDefinitionId?: string;
  trackingMode?: string;
  name: string;
  defaultSets: number;
  restSeconds: number;
  notes: string;
  weightUnit?: string;
  initialWeight?: number | null;
  muscles: string[];
}

export interface ProgramServer {
  _id: string; // ObjectId string from Mongo
  userId: string;
  name: string;
  exercises: ProgramExerciseServer[];
  createdAt: string; // ISO-8601
  updatedAt: number; // epoch-ms
  deletedAt?: number | null;
}

export interface WorkoutSetServer {
  id: string;
  weight: number | null;
  reps: number | null;
  durationSeconds?: number | null;
  distance?: number | null;
  completedAt?: string;
}

export interface WorkoutExerciseServer {
  id: string;
  exerciseDefinitionId?: string;
  trackingMode?: string;
  name: string;
  restSeconds: number;
  notes: string;
  sets: WorkoutSetServer[];
  weightUnit?: string;
  muscles: string[];
}

export interface WorkoutServer {
  _id: string; // ObjectId string from Mongo
  userId: string;
  programId?: string;
  startedAt: string;
  completedAt?: string;
  updatedAt: number; // epoch-ms
  deletedAt?: number | null;
  notes: string;
  exercises: WorkoutExerciseServer[];
}
