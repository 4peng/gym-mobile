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

  // Select dirty programs by per-item tracking (dirtyProgramIds) rather than a
  // monotonic updatedAt-vs-lastSyncedAt watermark. The watermark approach
  // silently dropped edits made DURING an in-flight sync (their updatedAt lands
  // below the post-sync watermark, so they were never re-detected as dirty).
  const dirtyIdSet = new Set(store.dirtyProgramIds);
  const dirtyPrograms = store.programs.filter(
    (p) => dirtyIdSet.has(p._id) && !p.deletedAt
  );

  // Capture BEFORE the network push: any edit that lands during the await gets
  // updatedAt > pushStartedAt, so clearDirtyPrograms keeps it dirty for the
  // next round instead of clearing it against the version we actually pushed.
  const pushStartedAt = Date.now();
  let pushedPrograms = [] as typeof dirtyPrograms;
  if (dirtyPrograms.length > 0) {
    const result = await batchUpsertPrograms(dirtyPrograms);
    if (!result) return false;
    pushedPrograms = result;
    useProgramStore
      .getState()
      .clearDirtyPrograms(dirtyPrograms.map((p) => p._id), pushStartedAt);
  }

  // Use Math.max(1, ...) rather than 0 so a computed "since" of 0 is never
  // sent — fetchPrograms/fetchWorkouts treat `since` truthiness inconsistently
  // downstream, and a since=0 would be silently dropped by the programs path.
  const since = store.lastSyncedAt ? Math.max(1, store.lastSyncedAt - 10000) : undefined;
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

  const since = store.lastSyncedAt ? Math.max(1, store.lastSyncedAt - 10000) : undefined;
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

let _syncPromise: Promise<boolean> | null = null;

export async function runFullSync(): Promise<boolean> {
  if (_syncing) {
    _pendingSync = true;
    // A sync is already in flight — piggyback on its result instead of
    // falsely reporting success, so callers (e.g. pull-to-refresh) see the
    // real outcome.
    return _syncPromise ?? false;
  }
  _syncing = true;

  _syncPromise = (async () => {
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
      _syncPromise = null;
    }
  })();

  return _syncPromise;
}

export function isSyncing(): boolean {
  return _syncing;
}
