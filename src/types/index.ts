// Client-side types (string IDs, no ObjectId)

import { MuscleGroup } from "@/src/constants/muscles";

export type ExerciseTrackingMode = "strength" | "timed" | "cardio";

export interface ExerciseDefinition {
  id: string;
  name: string;
  muscles: MuscleGroup[];
  aliases?: string[];
  isCustom?: boolean;
}

/** A template for a set inside a Program exercise. */
export interface ProgramSetTemplate {
  type: "working" | "warmup" | "dropset";
}

/** A single exercise definition inside a Program template. */
export interface ProgramExercise {
  id: string;
  exerciseDefinitionId?: string;
  trackingMode: ExerciseTrackingMode;
  name: string;
  /** Array of set templates defining the structure (warmup, working, etc.) */
  defaultSets: ProgramSetTemplate[];
  restSeconds: number;
  notes: string;
  weightUnit?: "kg" | "lbs";
  initialWeight?: number | null;
  muscles: MuscleGroup[];
  isBodyweight?: boolean;
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

/** A single logged set inside a workout exercise. */
export interface WorkoutSet {
  id: string;
  weight: number | null; // null = untouched / placeholder state
  reps: number | null; // null = untouched / placeholder state
  type?: "working" | "warmup" | "dropset";
  durationSeconds?: number | null;
  distance?: number | null;
  completedAt?: string; // ISO-8601
}

/** A single exercise inside an active or completed workout session. */
export interface WorkoutExercise {
  id: string;
  programExerciseId?: string;
  exerciseDefinitionId?: string;
  trackingMode: ExerciseTrackingMode;
  name: string;
  restSeconds: number;
  timerStartedAt?: string; // ISO-8601, for future expo-notifications
  notes: string;
  sets: WorkoutSet[];
  weightUnit?: "kg" | "lbs";
  muscles: MuscleGroup[];
  isBodyweight?: boolean;
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
  notes: string;
  exercises: WorkoutExercise[];
  cumulativeRestSeconds?: number; // Total seconds spent resting
}
