// ──────────────────────────────────────────────
// TEST-013: Factory helpers for test objects
// ──────────────────────────────────────────────
// Minimal factories that return valid typed objects
// for use across multiple test files.

import type {
  WorkoutSession,
  WorkoutExercise,
  WorkoutSet,
  Program,
  ProgramExercise,
  ExerciseDefinition,
} from "@/types";

export function testSession(overrides?: Partial<WorkoutSession>): WorkoutSession {
  return {
    _id: "test-session-1",
    userId: "test-user",
    startedAt: "2026-06-01T10:00:00.000Z",
    completedAt: "2026-06-01T11:00:00.000Z",
    updatedAt: 200,
    notes: "factory session",
    exercises: [testExercise()],
    ...overrides,
  };
}

export function testSet(overrides?: Partial<WorkoutSet>): WorkoutSet {
  return {
    id: "test-set-1",
    weight: 100,
    reps: 10,
    type: "working",
    ...overrides,
  };
}

export function testExercise(overrides?: Partial<WorkoutExercise>): WorkoutExercise {
  return {
    id: "test-ex-1",
    exerciseDefinitionId: "bench-press",
    trackingMode: "strength",
    name: "Bench Press",
    restSeconds: 90,
    notes: "",
    sets: [testSet()],
    weightUnit: "kg",
    muscles: ["chest"],
    ...overrides,
  };
}

export function testProgram(overrides?: Partial<Program>): Program {
  return {
    _id: "test-prog-1",
    userId: "test-user",
    name: "Test Program",
    exercises: [testProgramExercise()],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: 100,
    ...overrides,
  };
}

export function testProgramExercise(overrides?: Partial<ProgramExercise>): ProgramExercise {
  return {
    id: "test-pe-1",
    exerciseDefinitionId: "bench-press",
    trackingMode: "strength",
    name: "Bench Press",
    defaultSets: [{ type: "working" }, { type: "working" }, { type: "working" }],
    restSeconds: 90,
    notes: "",
    weightUnit: "kg",
    initialWeight: 60,
    muscles: ["chest"],
    ...overrides,
  };
}

export function testExerciseDef(overrides?: Partial<ExerciseDefinition>): ExerciseDefinition {
  return {
    id: "bench-press",
    name: "Bench Press",
    muscles: ["chest"],
    ...overrides,
  };
}
