import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutSession } from '@/src/types';

const WORKOUT_PREFIX = 'workout_';

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
      return data ? JSON.parse(data) : null;
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
        .map(([_, value]) => value ? JSON.parse(value) : null)
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
