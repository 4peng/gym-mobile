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
import { batchUpsertPrograms, fetchPrograms, deleteRemoteProgram } from "./programs";
import { batchUpsertWorkouts, fetchWorkouts, deleteRemoteWorkout } from "./workouts";
import type { Program, WorkoutSession } from "@/types";

let _syncing = false;

// ──────────────────────────────────────────────
// Program sync
// ──────────────────────────────────────────────

export async function syncPrograms(): Promise<boolean> {
  const store = useProgramStore.getState();
  const syncStartTime = Date.now();

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
    (p) => p.updatedAt >= (store.lastSyncedAt || 0) && !p.deletedAt
  );
  
  if (dirtyPrograms.length > 0) {
    const result = await batchUpsertPrograms(dirtyPrograms);
    if (!result) return false;
  }

  const since = store.lastSyncedAt ? Math.max(0, store.lastSyncedAt - 10000) : undefined;
  const remote = await fetchPrograms(since);
  if (!remote) return false;

  useProgramStore.getState().applySyncMerge(remote, syncStartTime);
  return true;
}

// ──────────────────────────────────────────────
// Workout sync
// ──────────────────────────────────────────────

export async function syncWorkouts(): Promise<boolean> {
  const store = useWorkoutSessionStore.getState();
  const syncStartTime = Date.now();

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

  const completedLocal = store.history.filter((w) => !!w.completedAt);
  const dirtyWorkouts = completedLocal.filter(
    (w) => w.updatedAt >= (store.lastSyncedAt || 0) && !w.deletedAt
  );

  if (dirtyWorkouts.length > 0) {
    const result = await batchUpsertWorkouts(dirtyWorkouts);
    if (!result) return false;
  }

  const since = store.lastSyncedAt ? Math.max(0, store.lastSyncedAt - 10000) : undefined;
  const remote = await fetchWorkouts(undefined, undefined, since);
  if (!remote) return false;

  useWorkoutSessionStore.getState().applySyncMerge(remote, syncStartTime);
  return true;
}

// ──────────────────────────────────────────────
// Root Orchestrator
// ──────────────────────────────────────────────

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

export function isSyncing(): boolean {
  return _syncing;
}
