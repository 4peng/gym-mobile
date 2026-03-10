import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";

export const useActiveSession = () =>
  useWorkoutSessionStore((state) => state.activeSession);

export const useActiveRestTimer = () =>
  useWorkoutSessionStore((state) => state.activeRestTimer);

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
