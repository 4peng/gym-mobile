import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { useShallow } from "zustand/react/shallow";

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

// --- Session Actions ---

export const useCompleteSession = () =>
  useWorkoutSessionStore((state) => state.completeSession);

export const useDiscardSession = () =>
  useWorkoutSessionStore((state) => state.discardSession);

export const useAddExercise = () =>
  useWorkoutSessionStore((state) => state.addExercise);

export const useClearExpiredTimer = () =>
  useWorkoutSessionStore((state) => state.clearExpiredTimer);
