// ──────────────────────────────────────────────
// Workouts API endpoints
// ──────────────────────────────────────────────

import { apiRequest } from "./client";
import type { WorkoutServer } from "./serverTypes";
import type { WorkoutSession } from "@/types";
import { mapWorkoutToBackend, mapWorkoutFromBackend } from "./converters";
import { USER_ID } from "@/constants/user";

/** Fetch completed workouts (paginated). `since` (epoch-ms) enables delta sync. */
export async function fetchWorkouts(
  limit?: number,
  skip?: number,
  since?: number,
): Promise<WorkoutSession[] | null> {
  const params = new URLSearchParams({ userId: USER_ID });
  if (limit !== undefined) params.append("limit", String(limit));
  if (skip !== undefined) params.append("skip", String(skip));
  if (since !== undefined) params.append("since", String(since));

  const res = await apiRequest<WorkoutServer[]>(`/workouts?${params}`);
  if (!res.ok || !res.data) return null;
  return res.data.map(mapWorkoutFromBackend);
}

/** Batch upsert. Returns the server copies of every pushed workout. */
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

/** Batch soft-delete (tombstone) by id. */
export async function batchDeleteWorkouts(ids: string[]): Promise<boolean> {
  const res = await apiRequest("/workouts/batch", {
    method: "DELETE",
    body: JSON.stringify({ ids }),
  });
  return res.ok;
}
