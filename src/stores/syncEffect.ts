import { useProgramStore } from "./programStore";
import { useWorkoutSessionStore } from "./workoutSessionStore";
import { useSyncStore } from "./syncStore";

/**
 * Initializes listeners that trigger background syncs when local data changes.
 * This avoids circular dependencies by using a one-way subscription.
 */
export function initSyncEffect() {
  // Listen for program changes
  useProgramStore.subscribe((state, prevState) => {
    // Trigger sync if it's dirty and EITHER:
    // 1. It just transitioned from clean to dirty
    // 2. Something changed (programs or deletions) while already dirty
    const justBecameDirty = state.isDirty && !prevState.isDirty;
    const changedWhileDirty = state.isDirty && (
      state.programs !== prevState.programs || 
      state.deletedProgramIds !== prevState.deletedProgramIds
    );

    if (justBecameDirty || changedWhileDirty) {
      useSyncStore.getState().runFullSync();
    }
  });

  // Listen for workout history changes
  useWorkoutSessionStore.subscribe((state, prevState) => {
    const justBecameDirty = state.isDirty && !prevState.isDirty;
    const changedWhileDirty = state.isDirty && (
      state.history !== prevState.history
    );

    if (justBecameDirty || changedWhileDirty) {
      useSyncStore.getState().runFullSync();
    }
  });
}
