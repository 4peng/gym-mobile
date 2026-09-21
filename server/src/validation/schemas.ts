import { z } from "zod";

// ──────────────────────────────────────────────
// Validation schemas for API request bodies
// ──────────────────────────────────────────────

const exerciseSet = z.object({
  type: z.enum(["working", "warmup", "dropset"]).optional(),
});

const programExerciseSchema = z.object({
  id: z.string(),
  exerciseDefinitionId: z.string().optional(),
  trackingMode: z.enum(["strength", "timed", "cardio"]).optional(),
  name: z.string(),
  defaultSets: z.union([z.number(), z.array(exerciseSet)]),
  restSeconds: z.number(),
  notes: z.string().optional(),
  weightUnit: z.enum(["kg", "lbs"]).optional(),
  initialWeight: z.number().nullable().optional(),
  muscles: z.array(z.string()).optional(),
  isBodyweight: z.boolean().optional(),
});

export const programSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  name: z.string().max(200),
  exercises: z.array(programExerciseSchema),
  createdAt: z.string().optional(),
  updatedAt: z.number().optional(),
  deletedAt: z.number().nullable().optional(),
});

const workoutSetSchema = z.object({
  id: z.string(),
  weight: z.number().nullable(),
  reps: z.number().nullable(),
  type: z.enum(["working", "warmup", "dropset"]).optional(),
  durationSeconds: z.number().nullable().optional(),
  distance: z.number().nullable().optional(),
  completedAt: z.string().optional(),
});

const workoutExerciseSchema = z.object({
  id: z.string(),
  exerciseDefinitionId: z.string().optional(),
  trackingMode: z.enum(["strength", "timed", "cardio"]).optional(),
  name: z.string(),
  restSeconds: z.number(),
  timerStartedAt: z.string().optional(),
  notes: z.string().optional(),
  sets: z.array(workoutSetSchema),
  weightUnit: z.enum(["kg", "lbs"]).optional(),
  muscles: z.array(z.string()).optional(),
  isBodyweight: z.boolean().optional(),
});

export const workoutSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  programId: z.string().optional(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  notes: z.string().optional(),
  exercises: z.array(workoutExerciseSchema),
  updatedAt: z.number().optional(),
  deletedAt: z.number().nullable().optional(),
});

export const batchProgramSchema = z.object({
  programs: z.array(programSchema).max(50),
});

export const batchWorkoutSchema = z.object({
  workouts: z.array(workoutSchema).max(50),
});

export const deleteBatchSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(50),
});

export type ValidationResult<T> = { success: true; data: T } | { success: false; error: string };

export function validateOrError<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: result.error.errors
        .map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`)
        .join("; "),
    };
  }
  return { success: true, data: result.data };
}
