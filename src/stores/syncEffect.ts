import { useProgramStore } from "./programStore";
import { useWorkoutSessionStore } from "./workoutSessionStore";
import { useSyncStore } from "./syncStore";

const DEBOUNCE_MS = 750;
let cleanup: (() => void) | null = null;

/** Pushes pending changes to the cloud shortly after anything becomes pending. Idempotent. */
export function initSyncEffect() {
  if (cleanup) return cleanup;

  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void useSyncStore.getState().pushPending();
    }, DEBOUNCE_MS);
  };

  const unsubPrograms = useProgramStore.subscribe((s, prev) => {
    if (
      s.dirtyProgramIds !== prev.dirtyProgramIds ||
      s.deletedProgramIds !== prev.deletedProgramIds
    ) {
      if (s.dirtyProgramIds.length + s.deletedProgramIds.length > 0) schedule();
    }
  });
  const unsubWorkouts = useWorkoutSessionStore.subscribe((s, prev) => {
    if (
      s.dirtyWorkoutIds !== prev.dirtyWorkoutIds ||
      s.deletedWorkoutIds !== prev.deletedWorkoutIds
    ) {
      if (s.dirtyWorkoutIds.length + s.deletedWorkoutIds.length > 0) schedule();
    }
  });

  cleanup = () => {
    unsubPrograms();
    unsubWorkouts();
    if (timer) clearTimeout(timer);
    cleanup = null;
  };
  return cleanup;
}
