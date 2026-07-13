import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";

export const useWorkoutHistory = () =>
  useWorkoutSessionStore((state) => state.history);

export const useHasMoreWorkoutHistory = () =>
  useWorkoutSessionStore((state) => state.hasMoreHistory);

export const useFetchMoreWorkoutHistory = () =>
  useWorkoutSessionStore((state) => state.fetchMoreHistory);

export const useDeleteHistorySession = () =>
  useWorkoutSessionStore((state) => state.deleteHistorySession);

export const useUpdateHistorySet = () =>
  useWorkoutSessionStore((state) => state.updateHistorySet);

export const useUpdateSessionDate = () =>
  useWorkoutSessionStore((state) => state.updateSessionDate);
