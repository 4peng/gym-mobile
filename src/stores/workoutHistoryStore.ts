import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";

export const useWorkoutHistory = () =>
  useWorkoutSessionStore((state) => state.history);

export const useWorkoutHistoryIndex = () =>
  useWorkoutSessionStore((state) => state.historyIndex);

export const useHasMoreWorkoutHistory = () =>
  useWorkoutSessionStore((state) => state.hasMoreHistory);

export const usePinnedExerciseNames = () =>
  useWorkoutSessionStore((state) => state.pinnedExerciseNames || []);

export const useDeletedWorkoutIds = () =>
  useWorkoutSessionStore((state) => state.deletedWorkoutIds);

export const useFetchMoreWorkoutHistory = () =>
  useWorkoutSessionStore((state) => state.fetchMoreHistory);

export const useDeleteHistorySession = () =>
  useWorkoutSessionStore((state) => state.deleteHistorySession);

export const useUpdateHistorySet = () =>
  useWorkoutSessionStore((state) => state.updateHistorySet);

export const useUpdateSessionDate = () =>
  useWorkoutSessionStore((state) => state.updateSessionDate);

export const useTogglePinExercise = () =>
  useWorkoutSessionStore((state) => state.togglePinExercise);

export const useUpdateMusclesInHistory = () =>
  useWorkoutSessionStore((state) => state.updateMusclesInHistory);
