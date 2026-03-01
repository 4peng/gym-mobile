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

  // 0. Handle local pending hard-deletes (legacy support)
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

  // 1. Push un-synced programs.
  const dirtyPrograms = store.programs.filter(
    (p) => p.updatedAt > (store.lastSyncedAt || 0)
  );
  if (dirtyPrograms.length > 0) {
    const result = await batchUpsertPrograms(dirtyPrograms);
    if (!result) return false;
  }

  // 2. Fetch remote data (Delta Sync using 'since')
  // We use lastSyncedAt - 10 seconds to account for slight clock drifts.
  const since = store.lastSyncedAt ? Math.max(0, store.lastSyncedAt - 10000) : undefined;
  const remote = await fetchPrograms(since);
  if (!remote) return false;

  // 3 & 4. Merge logic (applySyncMerge handles tombstones via deletedAt)
  useProgramStore.getState().applySyncMerge(remote, syncStartTime);

  return true;
}

// ──────────────────────────────────────────────
// Workout sync
// ──────────────────────────────────────────────

export async function syncWorkouts(): Promise<boolean> {
  const store = useWorkoutSessionStore.getState();
  const syncStartTime = Date.now();

  // 0. Handle local pending hard-deletes (legacy support)
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

  // 2. Fetch backend workouts (Delta Sync)
  const since = store.lastSyncedAt ? Math.max(0, store.lastSyncedAt - 10000) : undefined;
  const remote = await fetchWorkouts(undefined, undefined, since);
  if (!remote) return false;

  // 3 & 4. Merge inside the state lock.
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

/** Check if a sync is currently in progress. */
export function isSyncing(): boolean {
  return _syncing;
}
