// ──────────────────────────────────────────────
// Workouts API endpoints
// ──────────────────────────────────────────────

import { apiRequest } from "./client";
import type { WorkoutServer } from "./serverTypes";
import type { WorkoutSession } from "@/types";
import { mapWorkoutToBackend, mapWorkoutFromBackend } from "./converters";
import { USER_ID } from "@/constants/user";

/**
 * Fetch all completed workouts for the current user from the backend (with pagination).
 * Supports Delta Sync via 'since' parameter.
 */
export async function fetchWorkouts(
  limit?: number,
  skip?: number,
  since?: number
): Promise<WorkoutSession[] | null> {
  const queryParams = new URLSearchParams();
  queryParams.append("userId", USER_ID);
  if (limit !== undefined) queryParams.append("limit", limit.toString());
  if (skip !== undefined) queryParams.append("skip", skip.toString());
  if (since !== undefined) queryParams.append("since", since.toString());

  const res = await apiRequest<WorkoutServer[]>(
    `/workouts?${queryParams.toString()}`
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

/**
 * Delete a workout on the backend by _id.
 */
export async function deleteRemoteWorkout(
  workoutId: string
): Promise<boolean> {
  const res = await apiRequest(`/workouts/${workoutId}`, {
    method: "DELETE",
  });
  return res.ok;
}
