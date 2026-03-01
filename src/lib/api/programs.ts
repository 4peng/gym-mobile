// ──────────────────────────────────────────────
// Programs API endpoints
// ──────────────────────────────────────────────

import { apiRequest } from "./client";
import type { ProgramServer } from "./serverTypes";
import type { Program } from "@/types";
import { mapProgramToBackend, mapProgramFromBackend } from "./converters";
import { USER_ID } from "@/constants/user";

/**
 * Fetch all programs for the current user from the backend.
 * Supports Delta Sync via 'since' parameter.
 */
export async function fetchPrograms(since?: number): Promise<Program[] | null> {
  let path = `/programs?userId=${USER_ID}`;
  if (since) {
    path += `&since=${since}`;
  }
  
  const res = await apiRequest<ProgramServer[]>(path);
  if (!res.ok || !res.data) return null;
  return res.data.map(mapProgramFromBackend);
}

/**
 * Push a single program to the backend (upsert by _id).
 * Returns the server version of the program on success.
 */
export async function upsertProgram(
  program: Program
): Promise<Program | null> {
  const body = mapProgramToBackend(program);
  const res = await apiRequest<ProgramServer>("/programs", {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.data) return null;
  return mapProgramFromBackend(res.data);
}

/**
 * Delete a program on the backend by _id.
 */
export async function deleteRemoteProgram(
  programId: string
): Promise<boolean> {
  const res = await apiRequest(`/programs/${programId}`, {
    method: "DELETE",
  });
  return res.ok;
}

/**
 * Push multiple programs at once (batch upsert).
 * Returns the list of successfully synced programs from the server.
 */
export async function batchUpsertPrograms(
  programs: Program[]
): Promise<Program[] | null> {
  const bodies = programs.map(mapProgramToBackend);
  const res = await apiRequest<ProgramServer[]>("/programs/batch", {
    method: "PUT",
    body: JSON.stringify({ programs: bodies }),
  });
  if (!res.ok || !res.data) return null;
  return res.data.map(mapProgramFromBackend);
}
