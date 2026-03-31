// ──────────────────────────────────────────────
// Sync Engine
// ──────────────────────────────────────────────
// Implements the offline-first sync strategy:
//   1. Push dirty local data to backend.
//   2. Fetch remote data (Delta Sync).
//   3. Handle soft-deletes (Tombstones).
//   4. Merge with Last-Write-Wins.

import { useProgramStore } from "@/stores/programStore";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { workoutStorage } from "@/storage/workoutStorage";
import type { WorkoutSession } from "@/types";
import { batchUpsertPrograms, fetchPrograms, deleteRemoteProgram } from "./programs";
import { batchUpsertWorkouts, fetchWorkouts, deleteRemoteWorkout } from "./workouts";

let _syncing = false;
let _pendingSync = false;

// ──────────────────────────────────────────────
// Program sync
// ──────────────────────────────────────────────

export async function syncPrograms(): Promise<boolean> {
  const store = useProgramStore.getState();

  if (store.deletedProgramIds.length > 0) {
    const deletedSuccessfully = [];
    for (const id of store.deletedProgramIds) {
      const ok = await deleteRemoteProgram(id);
      if (ok) deletedSuccessfully.push(id);
    }
    if (deletedSuccessfully.length > 0) {
      useProgramStore.getState().clearDeletedPrograms(deletedSuccessfully);
    }
  }

  // Find programs that were updated since or at the last sync time
  const dirtyPrograms = store.programs.filter(
    (p) => p.updatedAt > (store.lastSyncedAt || 0) && !p.deletedAt
  );

  let pushedPrograms = [] as typeof dirtyPrograms;
  if (dirtyPrograms.length > 0) {
    const result = await batchUpsertPrograms(dirtyPrograms);
    if (!result) return false;
    pushedPrograms = result;
  }

  const since = store.lastSyncedAt ? Math.max(0, store.lastSyncedAt - 10000) : undefined;
  const remote = await fetchPrograms(since);
  if (!remote) return false;

  const mergedById = new Map([...pushedPrograms, ...remote].map((program) => [program._id, program]));
  const merged = Array.from(mergedById.values());
  const syncWatermark = Math.max(
    Date.now(),
    ...merged.map((program) => program.updatedAt)
  );

  useProgramStore.getState().applySyncMerge(merged, syncWatermark);
  return true;
}

// ──────────────────────────────────────────────
// Workout sync
// ──────────────────────────────────────────────

export async function syncWorkouts(): Promise<boolean> {
  const store = useWorkoutSessionStore.getState();

  if (store.deletedWorkoutIds.length > 0) {
    const deletedSuccessfully = [];
    for (const id of store.deletedWorkoutIds) {
      const ok = await deleteRemoteWorkout(id);
      if (ok) deletedSuccessfully.push(id);
    }
    if (deletedSuccessfully.length > 0) {
      useWorkoutSessionStore.getState().clearDeletedWorkouts(deletedSuccessfully);
    }
  }

  const dirtyIdSet = new Set(store.dirtyWorkoutIds);
  const inMemoryById = new Map(store.history.map((workout) => [workout._id, workout]));
  const dirtyWorkoutsById = new Map<string, WorkoutSession>();
  const shardLoadIds: string[] = [];

  for (const workoutId of dirtyIdSet) {
    const inMemory = inMemoryById.get(workoutId);
    if (inMemory) {
      if (inMemory.completedAt && !inMemory.deletedAt) {
        dirtyWorkoutsById.set(workoutId, inMemory);
      }
      continue;
    }
    shardLoadIds.push(workoutId);
  }

  if (shardLoadIds.length > 0) {
    const fromShards = await workoutStorage.getBatch(shardLoadIds);
    fromShards.forEach((workout) => {
      if (workout.completedAt && !workout.deletedAt) {
        dirtyWorkoutsById.set(workout._id, workout);
      }
    });
  }

  const dirtyWorkouts = Array.from(dirtyWorkoutsById.values());

  let pushedWorkouts: WorkoutSession[] = [];
  if (dirtyWorkouts.length > 0) {
    const result = await batchUpsertWorkouts(dirtyWorkouts);
    if (!result) return false;
    pushedWorkouts = result;
    useWorkoutSessionStore
      .getState()
      .clearDirtyWorkouts(dirtyWorkouts.map((workout) => workout._id));
  }

  const since = store.lastSyncedAt ? Math.max(0, store.lastSyncedAt - 10000) : undefined;
  const remote = await fetchWorkouts(undefined, undefined, since);
  if (!remote) return false;

  const mergedById = new Map([...pushedWorkouts, ...remote].map((workout) => [workout._id, workout]));
  const merged = Array.from(mergedById.values());
  const syncWatermark = Math.max(
    Date.now(),
    ...merged.map((workout) => workout.updatedAt)
  );

  useWorkoutSessionStore.getState().applySyncMerge(merged, syncWatermark);
  return true;
}

// ──────────────────────────────────────────────
// Root Orchestrator
// ──────────────────────────────────────────────

export async function runFullSync(): Promise<boolean> {
  if (_syncing) {
    _pendingSync = true;
    return true;
  }
  _syncing = true;
  let allSuccessful = true;

  try {
    do {
      _pendingSync = false;
      const [programsOk, workoutsOk] = await Promise.all([
        syncPrograms(),
        syncWorkouts(),
      ]);
      allSuccessful = allSuccessful && programsOk && workoutsOk;
    } while (_pendingSync);

    return allSuccessful;
  } finally {
    _syncing = false;
  }
}

export function isSyncing(): boolean {
  return _syncing;
}
