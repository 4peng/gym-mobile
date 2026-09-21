import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WorkoutSession } from "@/types";
import { normalizePersistedWorkoutSession } from "@/utils/normalizeWorkout";
import type { WorkoutRepo } from "./workoutRepo";

const SHARD_PREFIX = "workout_";
const LEGACY_KEYS = ["workout-stats-index-v1"];

/**
 * One-time import of the pre-SQLite layout: completed sessions were stored one
 * AsyncStorage key per session (`workout_<id>`). Imports every shard into the
 * repo, then removes the shard keys. No-op once no shards remain.
 */
export async function migrateFromAsyncStorage(repo: WorkoutRepo): Promise<number> {
  const keys = (await AsyncStorage.getAllKeys()).filter(
    (k) => k.startsWith(SHARD_PREFIX) || LEGACY_KEYS.includes(k),
  );
  const shardKeys = keys.filter((k) => k.startsWith(SHARD_PREFIX));
  if (keys.length === 0) return 0;

  const sessions: WorkoutSession[] = [];
  if (shardKeys.length > 0) {
    for (const [, value] of await AsyncStorage.multiGet(shardKeys)) {
      if (!value) continue;
      try {
        const session = normalizePersistedWorkoutSession(JSON.parse(value));
        if (session?.completedAt) sessions.push(session);
      } catch {
        // corrupt shard: skip it rather than block startup
      }
    }
    repo.upsertMany(sessions);
  }

  await AsyncStorage.multiRemove(keys);
  return sessions.length;
}
