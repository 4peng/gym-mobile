import { apiRequest } from "./client";
import type { ProgramServer } from "./serverTypes";
import type { Program } from "@/types";
import { mapProgramToBackend, mapProgramFromBackend } from "./converters";
import { USER_ID } from "@/constants/user";

/** Every program in the cloud for this user. */
export async function fetchPrograms(): Promise<Program[] | null> {
  const res = await apiRequest<ProgramServer[]>(`/programs?userId=${USER_ID}`);
  if (!res.ok || !res.data) return null;
  return res.data.map(mapProgramFromBackend);
}

/** Batch upsert (max 50). Returns the server copies. */
export async function batchUpsertPrograms(programs: Program[]): Promise<Program[] | null> {
  const res = await apiRequest<ProgramServer[]>("/programs/batch", {
    method: "PUT",
    body: JSON.stringify({ programs: programs.map(mapProgramToBackend) }),
  });
  if (!res.ok || !res.data) return null;
  return res.data.map(mapProgramFromBackend);
}

/** Batch delete by id. */
export async function batchDeletePrograms(ids: string[]): Promise<boolean> {
  const res = await apiRequest("/programs/batch", {
    method: "DELETE",
    body: JSON.stringify({ ids }),
  });
  return res.ok;
}
