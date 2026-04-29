import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { useShallow } from "zustand/react/shallow";

export const useActiveSession = () =>
  useWorkoutSessionStore((state) => state.activeSession);

export const useActiveRestTimer = () =>
  useWorkoutSessionStore((state) => state.activeRestTimer);

// --- Session Instrumentation Selectors ---

/** Returns IDs of all exercises in the current session */
export const useSessionExerciseIds = () =>
  useWorkoutSessionStore(useShallow((s) => s.activeSession?.exercises.map(e => e.id) || []));

/** Returns Names of all exercises in the current session */
export const useSessionExerciseNames = () =>
  useWorkoutSessionStore(useShallow((s) => s.activeSession?.exercises.map(e => e.name) || []));

/** Returns completion progress (0-1) for every exercise in the session */
export const useSessionExerciseProgress = () =>
  useWorkoutSessionStore(useShallow((s) => s.activeSession?.exercises.map(e => {
    const total = e.sets.length;
    const comp = e.sets.filter(st => !!st.completedAt).length;
    return total > 0 ? comp / total : 0;
  }) || []));

/** Returns total session-wide progress metrics */
export const useSessionProgress = () =>
  useWorkoutSessionStore(useShallow((s) => {
    if (!s.activeSession) return { progress: 0, completed: 0, total: 0 };
    let totalSets = 0, completedSets = 0;
    for (const ex of s.activeSession.exercises) {
      totalSets += ex.sets.length;
      for (const st of ex.sets) if (st.completedAt) completedSets++;
    }
    return { 
      progress: totalSets > 0 ? completedSets / totalSets : 0, 
      completed: completedSets, 
      total: totalSets 
    };
  }));

/** Returns total session-wide volume (weight * reps) */
export const useSessionVolume = () =>
  useWorkoutSessionStore(useShallow((s) => {
    if (!s.activeSession) return 0;
    let totalVolume = 0;
    for (const ex of s.activeSession.exercises) {
      if (ex.trackingMode === 'strength') {
        for (const st of ex.sets) {
          if (st.completedAt && st.weight && st.reps) {
            totalVolume += st.weight * st.reps;
          }
        }
      }
    }
    return totalVolume;
  }));

// --- Session Actions ---

export const useStartQuickSession = () =>
  useWorkoutSessionStore((state) => state.startQuickSession);

export const useStartFromProgram = () =>
  useWorkoutSessionStore((state) => state.startFromProgram);

export const useCompleteSession = () =>
  useWorkoutSessionStore((state) => state.completeSession);

export const useDiscardSession = () =>
  useWorkoutSessionStore((state) => state.discardSession);

export const useAddExercise = () =>
  useWorkoutSessionStore((state) => state.addExercise);

export const useRemoveExercise = () =>
  useWorkoutSessionStore((state) => state.removeExercise);

export const useUpdateExerciseField = () =>
  useWorkoutSessionStore((state) => state.updateExerciseField);

export const useToggleExerciseUnit = () =>
  useWorkoutSessionStore((state) => state.toggleExerciseUnit);

export const useAddSet = () => useWorkoutSessionStore((state) => state.addSet);

export const useRemoveSet = () =>
  useWorkoutSessionStore((state) => state.removeSet);

export const useUpdateSet = () =>
  useWorkoutSessionStore((state) => state.updateSet);

export const useToggleSetCompletion = () =>
  useWorkoutSessionStore((state) => state.toggleSetCompletion);

export const useStartRestTimer = () =>
  useWorkoutSessionStore((state) => state.startRestTimer);

export const useCancelRestTimer = () =>
  useWorkoutSessionStore((state) => state.cancelRestTimer);

export const useClearExpiredTimer = () =>
  useWorkoutSessionStore((state) => state.clearExpiredTimer);
