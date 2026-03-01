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
    // If it became dirty, or a new program was added, trigger sync
    if (state.isDirty && !prevState.isDirty) {
      useSyncStore.getState().runFullSync();
    }
    
    // If a deletion occurred
    if (state.deletedProgramIds.length > prevState.deletedProgramIds.length) {
      useSyncStore.getState().runFullSync();
    }
  });

  // Listen for workout history changes
  useWorkoutSessionStore.subscribe((state, prevState) => {
    if (state.isDirty && !prevState.isDirty) {
      useSyncStore.getState().runFullSync();
    }
  });
}
