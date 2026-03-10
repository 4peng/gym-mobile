import { useProgramStore } from "./programStore";
import { useWorkoutSessionStore } from "./workoutSessionStore";
import { useSyncStore } from "./syncStore";

const SYNC_DEBOUNCE_MS = 750;
let _cleanupSyncEffect: (() => void) | null = null;

/**
 * Initializes listeners that trigger background syncs when local data changes.
 * This avoids circular dependencies by using a one-way subscription.
 */
export function initSyncEffect() {
  // Idempotent init to avoid duplicate subscriptions across remounts/hot reload.
  if (_cleanupSyncEffect) return _cleanupSyncEffect;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleBackgroundSync = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void useSyncStore.getState().backgroundSync();
    }, SYNC_DEBOUNCE_MS);
  };

  const unsubscribePrograms = useProgramStore.subscribe((state, prevState) => {
    const justBecameDirty = state.isDirty && !prevState.isDirty;
    const changedWhileDirty = state.isDirty && (
      state.programs !== prevState.programs ||
      state.deletedProgramIds !== prevState.deletedProgramIds
    );

    if (justBecameDirty || changedWhileDirty) {
      scheduleBackgroundSync();
    }
  });

  const unsubscribeWorkouts = useWorkoutSessionStore.subscribe((state, prevState) => {
    const justBecameDirty = state.isDirty && !prevState.isDirty;
    const changedWhileDirty = state.isDirty && (
      state.history !== prevState.history ||
      state.deletedWorkoutIds !== prevState.deletedWorkoutIds
    );

    if (justBecameDirty || changedWhileDirty) {
      scheduleBackgroundSync();
    }
  });

  _cleanupSyncEffect = () => {
    unsubscribePrograms();
    unsubscribeWorkouts();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    _cleanupSyncEffect = null;
  };

  return _cleanupSyncEffect;
}
