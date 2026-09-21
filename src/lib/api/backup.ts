// ──────────────────────────────────────────────
// Cloud backup for a single device
// ──────────────────────────────────────────────
// Local data is the source of truth. The server is a mirror used to restore
// after a reinstall, so there is no merging: push what changed, pull everything
// when local is empty.

import { useProgramStore } from "@/stores/programStore";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { workoutRepo } from "@/db";
import type { WorkoutSession } from "@/types";
import { batchDeletePrograms, batchUpsertPrograms, fetchPrograms } from "./programs";
import { batchDeleteWorkouts, batchUpsertWorkouts, fetchWorkouts } from "./workouts";

/** Server-side batch limit. */
const CHUNK = 50;
/** Page size when pulling the full history. */
const PAGE = 200;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Pushes pending deletes and edits. Returns false if any request failed. */
export async function pushPending(): Promise<boolean> {
  const programs = useProgramStore.getState();
  const workouts = useWorkoutSessionStore.getState();
  let ok = true;

  if (programs.deletedProgramIds.length > 0) {
    if (await batchDeletePrograms(programs.deletedProgramIds))
      programs.clearDeletedPrograms(programs.deletedProgramIds);
    else ok = false;
  }
  if (workouts.deletedWorkoutIds.length > 0) {
    if (await batchDeleteWorkouts(workouts.deletedWorkoutIds))
      workouts.clearDeletedWorkouts(workouts.deletedWorkoutIds);
    else ok = false;
  }

  // Captured before the network calls: anything edited during the await keeps
  // an updatedAt newer than this and stays dirty for the next push.
  const pushedAt = Date.now();

  const dirtyPrograms = programs.programs.filter((p) => programs.dirtyProgramIds.includes(p._id));
  for (const chunk of chunks(dirtyPrograms, CHUNK)) {
    if (!(await batchUpsertPrograms(chunk))) return false;
    programs.clearDirtyPrograms(
      chunk.map((p) => p._id),
      pushedAt,
    );
  }

  const dirtyWorkouts = workoutRepo.getMany(workouts.dirtyWorkoutIds);
  for (const chunk of chunks(dirtyWorkouts, CHUNK)) {
    if (!(await batchUpsertWorkouts(chunk))) return false;
    workouts.clearDirtyWorkouts(
      chunk.map((w) => w._id),
      pushedAt,
    );
  }
  // Dirty ids whose session no longer exists locally have nothing to push.
  const missing = workouts.dirtyWorkoutIds.filter((id) => !dirtyWorkouts.some((w) => w._id === id));
  if (missing.length > 0) workouts.clearDirtyWorkouts(missing, pushedAt);

  return ok;
}

/** Pushes every program and session, then pending deletes. For a manual "back up everything". */
export async function backupEverything(): Promise<boolean> {
  if (!(await pushPending())) return false;

  for (const chunk of chunks(useProgramStore.getState().programs, CHUNK)) {
    if (!(await batchUpsertPrograms(chunk))) return false;
  }
  for (let offset = 0; ; offset += PAGE) {
    const page = workoutRepo.list(PAGE, offset);
    for (const chunk of chunks(page, CHUNK)) {
      if (!(await batchUpsertWorkouts(chunk))) return false;
    }
    if (page.length < PAGE) break;
  }
  return true;
}

/** Replaces all local programs and sessions with the cloud copy. */
export async function restoreFromCloud(): Promise<boolean> {
  const programs = await fetchPrograms();
  if (!programs) return false;

  const sessions: WorkoutSession[] = [];
  for (let skip = 0; ; skip += PAGE) {
    const page = await fetchWorkouts(PAGE, skip);
    if (!page) return false;
    sessions.push(...page);
    if (page.length < PAGE) break;
  }

  useProgramStore.getState().importPrograms(programs);
  workoutRepo.clear();
  useWorkoutSessionStore.setState({ dirtyWorkoutIds: [], deletedWorkoutIds: [] });
  useWorkoutSessionStore.getState().importWorkouts(sessions, false);
  return true;
}

/** True when nothing has ever been stored locally (fresh install). */
export function isLocalEmpty(): boolean {
  return workoutRepo.count() === 0 && useProgramStore.getState().programs.length === 0;
}
