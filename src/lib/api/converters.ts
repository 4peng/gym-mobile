// ──────────────────────────────────────────────
// ID Conversion Boundary
// ──────────────────────────────────────────────
// All ObjectId ↔ string conversions live here.
// No other file should import or mention ObjectId.

import type { Program, WorkoutSession } from "@/types";
import type { ProgramServer, WorkoutServer } from "./serverTypes";
import type { MuscleGroup } from "@/constants/muscles";

// ──────────────────────────────────────────────
// Program: Client → Server
// ──────────────────────────────────────────────

export function mapProgramToBackend(program: Program): ProgramServer {
  return {
    _id: program._id, // backend will treat as ObjectId if valid, else upsert
    userId: program.userId,
    name: program.name,
    exercises: program.exercises.map((e) => ({
      id: e.id,
      name: e.name,
      defaultSets: e.defaultSets,
      restSeconds: e.restSeconds,
      notes: e.notes,
      weightUnit: e.weightUnit,
      muscles: e.muscles,
    })),
    createdAt: program.createdAt,
    updatedAt: program.updatedAt,
    deletedAt: program.deletedAt,
  };
}

// ──────────────────────────────────────────────
// Program: Server → Client
// ──────────────────────────────────────────────

export function mapProgramFromBackend(server: ProgramServer): Program {
  return {
    _id: String(server._id),
    userId: server.userId,
    name: server.name,
    exercises: server.exercises.map((e) => ({
      id: e.id,
      name: e.name,
      defaultSets: e.defaultSets,
      restSeconds: e.restSeconds,
      notes: e.notes,
      weightUnit: e.weightUnit as "kg" | "lbs" | undefined,
      muscles: (e.muscles || []) as MuscleGroup[],
    })),
    createdAt: server.createdAt,
    updatedAt: server.updatedAt,
    deletedAt: server.deletedAt,
  };
}

// ──────────────────────────────────────────────
// Workout: Client → Server
// ──────────────────────────────────────────────

export function mapWorkoutToBackend(
  session: WorkoutSession
): WorkoutServer {
  return {
    _id: session._id,
    userId: session.userId,
    programId: session.programId ?? undefined,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    updatedAt: session.updatedAt,
    deletedAt: session.deletedAt,
    exercises: session.exercises.map((ex) => ({
      id: ex.id,
      name: ex.name,
      restSeconds: ex.restSeconds,
      notes: ex.notes,
      weightUnit: ex.weightUnit,
      muscles: ex.muscles,
      sets: ex.sets.map((s) => ({
        id: s.id,
        weight: s.weight,
        reps: s.reps,
        completedAt: s.completedAt,
      })),
    })),
  };
}

// ──────────────────────────────────────────────
// Workout: Server → Client
// ──────────────────────────────────────────────

export function mapWorkoutFromBackend(
  server: WorkoutServer
): WorkoutSession {
  return {
    _id: String(server._id),
    userId: server.userId,
    programId: server.programId ? String(server.programId) : undefined,
    startedAt: server.startedAt,
    completedAt: server.completedAt,
    updatedAt: server.updatedAt,
    deletedAt: server.deletedAt,
    exercises: server.exercises.map((ex) => ({
      id: ex.id,
      name: ex.name,
      restSeconds: ex.restSeconds,
      notes: ex.notes,
      weightUnit: ex.weightUnit as "kg" | "lbs" | undefined,
      muscles: (ex.muscles || []) as MuscleGroup[],
      sets: ex.sets.map((s) => ({
        id: s.id,
        weight: s.weight,
        reps: s.reps,
        completedAt: s.completedAt,
      })),
    })),
  };
}
