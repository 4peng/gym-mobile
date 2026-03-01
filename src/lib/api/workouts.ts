// ──────────────────────────────────────────────
// Workouts API endpoints
// ──────────────────────────────────────────────

import { apiRequest } from "./client";
import type { WorkoutServer } from "./serverTypes";
import type { WorkoutSession } from "@/types";
import { mapWorkoutToBackend, mapWorkoutFromBackend } from "./converters";
import { USER_ID } from "@/constants/user";

/**
 * Fetch all completed workouts for the current user from the backend.
 */
export async function fetchWorkouts(): Promise<WorkoutSession[] | null> {
  const res = await apiRequest<WorkoutServer[]>(
    `/workouts?userId=${USER_ID}`
  );
  if (!res.ok || !res.data) return null;
  return res.data.map(mapWorkoutFromBackend);
}

/**
 * Push a single completed workout to the backend (upsert by _id).
 */
export async function upsertWorkout(
  workout: WorkoutSession
): Promise<WorkoutSession | null> {
  const body = mapWorkoutToBackend(workout);
  const res = await apiRequest<WorkoutServer>("/workouts", {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.data) return null;
  return mapWorkoutFromBackend(res.data);
}

/**
 * Push multiple completed workouts at once (batch upsert).
 */
export async function batchUpsertWorkouts(
  workouts: WorkoutSession[]
): Promise<WorkoutSession[] | null> {
  const bodies = workouts.map(mapWorkoutToBackend);
  const res = await apiRequest<WorkoutServer[]>("/workouts/batch", {
    method: "PUT",
    body: JSON.stringify({ workouts: bodies }),
  });
  if (!res.ok || !res.data) return null;
  return res.data.map(mapWorkoutFromBackend);
}
