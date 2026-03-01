// ──────────────────────────────────────────────
// Sync Engine
// ──────────────────────────────────────────────
// Implements the offline-first sync strategy:
//   1. Push dirty local data to backend.
//   2. Fetch remote data.
//   3. Merge using last-write-wins (updatedAt).
//   4. Mark stores clean.
//
// Concurrency: an internal `syncing` flag prevents overlapping runs.
// The active workout session is NEVER synced or overwritten.

import { useProgramStore } from "@/stores/programStore";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { batchUpsertPrograms, fetchPrograms, deleteRemoteProgram } from "./programs";
import { batchUpsertWorkouts, fetchWorkouts } from "./workouts";
import type { Program, WorkoutSession } from "@/types";

let _syncing = false;

// ──────────────────────────────────────────────
// Program sync
// ──────────────────────────────────────────────

export async function syncPrograms(): Promise<boolean> {
  const store = useProgramStore.getState();
  const syncStartTime = Date.now();

  // 0. Handle pending deletions
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

  // 1. Push dirty local programs.
  // A program is dirty if its updatedAt is strictly greater than lastSyncedAt.
  const dirtyPrograms = store.programs.filter(
    (p) => p.updatedAt > (store.lastSyncedAt || 0)
  );
  
  if (dirtyPrograms.length > 0) {
    const result = await batchUpsertPrograms(dirtyPrograms);
    if (!result) return false; // Network failure — abort.
  }

  // 2. Fetch all backend programs.
  const remote = await fetchPrograms();
  if (!remote) return false;

  // 3 & 4. Merge inside the state lock to prevent race conditions.
  useProgramStore.getState().applySyncMerge(remote, syncStartTime);

  return true;
}

// ──────────────────────────────────────────────
// Workout sync
// ──────────────────────────────────────────────

export async function syncWorkouts(): Promise<boolean> {
  const store = useWorkoutSessionStore.getState();
  const syncStartTime = Date.now();

  // Only sync completed workouts. Never touch activeSession.
  const completedLocal = store.history.filter((w) => !!w.completedAt);
  const dirtyWorkouts = completedLocal.filter(
    (w) => w.updatedAt > (store.lastSyncedAt || 0)
  );

  // 1. Push un-synced completed workouts.
  if (dirtyWorkouts.length > 0) {
    const result = await batchUpsertWorkouts(dirtyWorkouts);
    if (!result) return false;
  }

  // 2. Fetch backend workouts.
  const remote = await fetchWorkouts();
  if (!remote) return false;

  // 3 & 4. Merge inside the state lock to prevent race conditions.
  useWorkoutSessionStore.getState().applySyncMerge(remote, syncStartTime);

  return true;
}

// ──────────────────────────────────────────────
// Full sync (public entry point)
// ──────────────────────────────────────────────

/**
 * Run a full sync cycle for both programs and workouts.
 * Returns `true` if both succeeded, `false` if either failed.
 * Prevents concurrent runs via an internal flag.
 */
export async function runFullSync(): Promise<boolean> {
  if (_syncing) return false;
  _syncing = true;

  try {
    const [programsOk, workoutsOk] = await Promise.all([
      syncPrograms(),
      syncWorkouts(),
    ]);
    return programsOk && workoutsOk;
  } finally {
    _syncing = false;
  }
}

/** Check if a sync is currently in progress. */
export function isSyncing(): boolean {
  return _syncing;
}
