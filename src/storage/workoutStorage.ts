import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WorkoutSession, WorkoutSet } from "@/types";
import { normalizeSetForTrackingMode, normalizeTrackingMode } from "@/utils/exerciseTracking";
import { generateId } from "@/utils/id";
import { USER_ID } from "@/constants/user";

const WORKOUT_PREFIX = 'workout_';

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/** Defensive normalizer for any persisted/raw session shape (shards, store rehydrate). */
export function normalizePersistedWorkoutSession(raw: any): WorkoutSession | null {
  if (!raw || typeof raw !== "object" || !raw._id) return null;

  const exercises = Array.isArray(raw.exercises)
    ? raw.exercises.map((ex: any) => {
        const trackingMode = normalizeTrackingMode(ex?.trackingMode);
        return {
          id: ex?.id ? String(ex.id) : generateId(),
          programExerciseId: str(ex?.programExerciseId),
          exerciseDefinitionId: str(ex?.exerciseDefinitionId),
          trackingMode,
          name: str(ex?.name) ?? "",
          restSeconds: num(ex?.restSeconds) ?? 90,
          notes: str(ex?.notes) ?? "",
          sets: Array.isArray(ex?.sets)
            ? ex.sets.map((s: any): WorkoutSet =>
                normalizeSetForTrackingMode(
                  {
                    id: s?.id ? String(s.id) : generateId(),
                    weight: num(s?.weight),
                    reps: num(s?.reps),
                    durationSeconds: num(s?.durationSeconds),
                    distance: num(s?.distance),
                    type: s?.type === "warmup" || s?.type === "dropset" ? s.type : "working",
                    completedAt: str(s?.completedAt),
                  },
                  trackingMode,
                ),
              )
            : [],
          weightUnit: ex?.weightUnit === "lbs" ? ("lbs" as const) : ("kg" as const),
          muscles: Array.isArray(ex?.muscles) ? ex.muscles : [],
          isBodyweight: typeof ex?.isBodyweight === "boolean" ? ex.isBodyweight : false,
          timerStartedAt: str(ex?.timerStartedAt),
        };
      })
    : [];

  return {
    _id: String(raw._id),
    userId: str(raw.userId) ?? USER_ID,
    programId: raw.programId ? String(raw.programId) : undefined,
    startedAt: str(raw.startedAt) ?? new Date().toISOString(),
    completedAt: str(raw.completedAt),
    updatedAt: num(raw.updatedAt) ?? Date.now(),
    deletedAt: typeof raw.deletedAt === "number" || raw.deletedAt === null ? raw.deletedAt : undefined,
    notes: str(raw.notes) ?? "",
    exercises,
    cumulativeRestSeconds: num(raw.cumulativeRestSeconds) ?? 0,
  };
}

/**
 * High-performance sharded storage for workouts.
 * Stores individual sessions in their own keys to avoid massive JSON blobs.
 */
export const workoutStorage = {
  /** Save a workout session to its own shard */
  save: async (workout: WorkoutSession): Promise<void> => {
    try {
      const key = `${WORKOUT_PREFIX}${workout._id}`;
      await AsyncStorage.setItem(key, JSON.stringify(workout));
    } catch (err) {
      console.error('Failed to shard workout:', err);
    }
  },

  /** Batch save multiple workouts */
  saveBatch: async (workouts: WorkoutSession[]): Promise<void> => {
    try {
      const pairs: [string, string][] = workouts.map(w => [
        `${WORKOUT_PREFIX}${w._id}`,
        JSON.stringify(w)
      ]);
      await AsyncStorage.multiSet(pairs);
    } catch (err) {
      console.error('Failed to batch shard workouts:', err);
    }
  },

  /** Load a single workout from its shard */
  get: async (id: string): Promise<WorkoutSession | null> => {
    try {
      const data = await AsyncStorage.getItem(`${WORKOUT_PREFIX}${id}`);
      return normalizePersistedWorkoutSession(data ? JSON.parse(data) : null);
    } catch (err) {
      console.error(`Failed to load shard ${id}:`, err);
      return null;
    }
  },

  /** Batch load multiple workouts */
  getBatch: async (ids: string[]): Promise<WorkoutSession[]> => {
    try {
      const keys = ids.map(id => `${WORKOUT_PREFIX}${id}`);
      const results = await AsyncStorage.multiGet(keys);
      return results
        .map(([_, value]) => normalizePersistedWorkoutSession(value ? JSON.parse(value) : null))
        .filter((v): v is WorkoutSession => v !== null);
    } catch (err) {
      console.error('Failed to batch load shards:', err);
      return [];
    }
  },

  /** Remove a workout shard */
  remove: async (id: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(`${WORKOUT_PREFIX}${id}`);
    } catch (err) {
      console.error(`Failed to remove shard ${id}:`, err);
    }
  },

  /** Batch remove workout shards */
  removeBatch: async (ids: string[]): Promise<void> => {
    try {
      const keys = ids.map(id => `${WORKOUT_PREFIX}${id}`);
      await AsyncStorage.multiRemove(keys);
    } catch (err) {
      console.error('Failed to batch remove shards:', err);
    }
  }
};
