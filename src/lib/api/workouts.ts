import { apiRequest } from "./client";
import type { WorkoutServer } from "./serverTypes";
import type { WorkoutSession } from "@/types";
import { mapWorkoutToBackend, mapWorkoutFromBackend } from "./converters";
import { USER_ID } from "@/constants/user";

/** A page of completed sessions, newest first. */
export async function fetchWorkouts(limit: number, skip: number): Promise<WorkoutSession[] | null> {
  const params = new URLSearchParams({ userId: USER_ID, limit: String(limit), skip: String(skip) });
  const res = await apiRequest<WorkoutServer[]>(`/workouts?${params}`);
  if (!res.ok || !res.data) return null;
  return res.data.map(mapWorkoutFromBackend);
}

/** Batch upsert (max 50). Returns the server copies. */
export async function batchUpsertWorkouts(
  workouts: WorkoutSession[],
): Promise<WorkoutSession[] | null> {
  const res = await apiRequest<WorkoutServer[]>("/workouts/batch", {
    method: "PUT",
    body: JSON.stringify({ workouts: workouts.map(mapWorkoutToBackend) }),
  });
  if (!res.ok || !res.data) return null;
  return res.data.map(mapWorkoutFromBackend);
}

/** Batch delete by id. */
export async function batchDeleteWorkouts(ids: string[]): Promise<boolean> {
  const res = await apiRequest("/workouts/batch", {
    method: "DELETE",
    body: JSON.stringify({ ids }),
  });
  return res.ok;
}
