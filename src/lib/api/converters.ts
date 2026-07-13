// ID Conversion Boundary
// All ObjectId <-> string conversions live here.
// No other file should import or mention ObjectId.

import type { Program, WorkoutSession, ProgramSetTemplate } from "@/types";
import type { ProgramServer, WorkoutServer } from "./serverTypes";
import type { MuscleGroup } from "@/constants/muscles";
import { normalizeTrackingMode } from "@/utils/exerciseTracking";

// Program: Client -> Server

export function mapProgramToBackend(program: Program): ProgramServer {
  return {
    _id: program._id, // backend will treat as ObjectId if valid, else upsert
    userId: program.userId,
    name: program.name,
    exercises: program.exercises.map((e) => ({
      id: e.id,
      exerciseDefinitionId: e.exerciseDefinitionId,
      trackingMode: e.trackingMode,
      name: e.name,
      // Send the full set-type template array (warmup/working/dropset) so
      // set-type markers survive the sync round-trip instead of being
      // collapsed to a bare count.
      defaultSets: e.defaultSets,
      restSeconds: e.restSeconds,
      notes: e.notes,
      weightUnit: e.weightUnit,
      initialWeight: e.initialWeight,
      muscles: e.muscles,
      isBodyweight: e.isBodyweight,
    })),
    createdAt: program.createdAt,
    updatedAt: program.updatedAt,
    deletedAt: program.deletedAt,
  };
}

// Program: Server -> Client

export function mapProgramFromBackend(server: ProgramServer): Program {
  return {
    _id: String(server._id),
    userId: server.userId,
    name: server.name,
    exercises: server.exercises.map((e) => {
      // Handle server returning either a number or (future) array
      let defaultSets: ProgramSetTemplate[] = [];
      if (typeof e.defaultSets === "number") {
        defaultSets = Array.from({ length: e.defaultSets }, () => ({ type: "working" }));
      } else if (Array.isArray(e.defaultSets)) {
        defaultSets = (e.defaultSets as any[]).map(s => ({
          type: s?.type === "warmup" || s?.type === "dropset" ? s.type : "working"
        }));
      } else {
        defaultSets = [{ type: "working" }, { type: "working" }, { type: "working" }];
      }

      return {
        id: e.id,
        exerciseDefinitionId: e.exerciseDefinitionId,
        trackingMode: normalizeTrackingMode(e.trackingMode),
        name: e.name,
        defaultSets,
        restSeconds: e.restSeconds,
        notes: e.notes,
        weightUnit: e.weightUnit as "kg" | "lbs" | undefined,
        initialWeight: typeof e.initialWeight === "number" ? e.initialWeight : null,
        muscles: (e.muscles || []) as MuscleGroup[],
        isBodyweight: e.isBodyweight,
      };
    }),
    createdAt: server.createdAt,
    updatedAt: server.updatedAt,
    deletedAt: server.deletedAt,
  };
}

// Workout: Client -> Server

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
    notes: session.notes,
    exercises: session.exercises.map((ex) => ({
      id: ex.id,
      exerciseDefinitionId: ex.exerciseDefinitionId,
      trackingMode: ex.trackingMode,
      name: ex.name,
      restSeconds: ex.restSeconds,
      notes: ex.notes,
      weightUnit: ex.weightUnit,
      muscles: ex.muscles,
      isBodyweight: ex.isBodyweight,
      sets: ex.sets.map((s) => ({
        id: s.id,
        weight: s.weight,
        reps: s.reps,
        type: s.type,
        durationSeconds: s.durationSeconds,
        distance: s.distance,
        completedAt: s.completedAt,
      })),
    })),
  };
}

// Workout: Server -> Client

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
    notes: server.notes ?? "",
    exercises: server.exercises.map((ex) => ({
      id: ex.id,
      exerciseDefinitionId: ex.exerciseDefinitionId,
      trackingMode: normalizeTrackingMode(ex.trackingMode),
      name: ex.name,
      restSeconds: ex.restSeconds,
      notes: ex.notes,
      weightUnit: ex.weightUnit as "kg" | "lbs" | undefined,
      muscles: (ex.muscles || []) as MuscleGroup[],
      isBodyweight: ex.isBodyweight,
      sets: ex.sets.map((s) => ({
        id: s.id,
        weight: s.weight,
        reps: s.reps,
        type: s.type as "working" | "warmup" | "dropset" | undefined,
        durationSeconds:
          typeof s.durationSeconds === "number" ? s.durationSeconds : null,
        distance: typeof s.distance === "number" ? s.distance : null,
        completedAt: s.completedAt,
      })),
    })),
  };
}
