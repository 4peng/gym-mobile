// ──────────────────────────────────────────────
// Programs API endpoints
// ──────────────────────────────────────────────

import { apiRequest } from "./client";
import type { ProgramServer } from "./serverTypes";
import type { Program } from "@/types";
import { mapProgramToBackend, mapProgramFromBackend } from "./converters";
import { USER_ID } from "@/constants/user";

/** Fetch programs for the current user. `since` (epoch-ms) enables delta sync. */
export async function fetchPrograms(since?: number): Promise<Program[] | null> {
  const path = since ? `/programs?userId=${USER_ID}&since=${since}` : `/programs?userId=${USER_ID}`;
  const res = await apiRequest<ProgramServer[]>(path);
  if (!res.ok || !res.data) return null;
  return res.data.map(mapProgramFromBackend);
}

/** Batch upsert. Returns the server copies of every pushed program. */
export async function batchUpsertPrograms(programs: Program[]): Promise<Program[] | null> {
  const res = await apiRequest<ProgramServer[]>("/programs/batch", {
    method: "PUT",
    body: JSON.stringify({ programs: programs.map(mapProgramToBackend) }),
  });
  if (!res.ok || !res.data) return null;
  return res.data.map(mapProgramFromBackend);
}

/** Batch soft-delete (tombstone) by id. */
export async function batchDeletePrograms(ids: string[]): Promise<boolean> {
  const res = await apiRequest("/programs/batch", {
    method: "DELETE",
    body: JSON.stringify({ ids }),
  });
  return res.ok;
}
