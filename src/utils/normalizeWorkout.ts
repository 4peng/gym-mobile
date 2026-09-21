import type { WorkoutSession, WorkoutSet } from "@/types";
import { normalizeSetForTrackingMode, normalizeTrackingMode } from "@/utils/exerciseTracking";
import { generateId } from "@/utils/id";
import { USER_ID } from "@/constants/user";

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/** Defensive normalizer for any persisted/raw session shape (legacy shards, store rehydrate). */
export function normalizePersistedWorkoutSession(raw: any): WorkoutSession | null {
  if (!raw || typeof raw !== "object" || !raw._id) return null;

  const exercises = Array.isArray(raw.exercises)
    ? raw.exercises.map((ex: any) => {
        const trackingMode = normalizeTrackingMode(ex?.trackingMode);
        return {
          id: ex?.id ? String(ex.id) : generateId(),
          programExerciseId: str(ex?.programExerciseId),
          exerciseDefinitionId: str(ex?.exerciseDefinitionId),
          trackingMode,
          name: str(ex?.name) ?? "",
          restSeconds: num(ex?.restSeconds) ?? 90,
          notes: str(ex?.notes) ?? "",
          sets: Array.isArray(ex?.sets)
            ? ex.sets.map((s: any): WorkoutSet =>
                normalizeSetForTrackingMode(
                  {
                    id: s?.id ? String(s.id) : generateId(),
                    weight: num(s?.weight),
                    reps: num(s?.reps),
                    durationSeconds: num(s?.durationSeconds),
                    distance: num(s?.distance),
                    type: s?.type === "warmup" || s?.type === "dropset" ? s.type : "working",
                    completedAt: str(s?.completedAt),
                  },
                  trackingMode,
                ),
              )
            : [],
          weightUnit: ex?.weightUnit === "lbs" ? ("lbs" as const) : ("kg" as const),
          muscles: Array.isArray(ex?.muscles) ? ex.muscles : [],
          isBodyweight: typeof ex?.isBodyweight === "boolean" ? ex.isBodyweight : false,
          timerStartedAt: str(ex?.timerStartedAt),
        };
      })
    : [];

  return {
    _id: String(raw._id),
    userId: str(raw.userId) ?? USER_ID,
    programId: raw.programId ? String(raw.programId) : undefined,
    startedAt: str(raw.startedAt) ?? new Date().toISOString(),
    completedAt: str(raw.completedAt),
    updatedAt: num(raw.updatedAt) ?? Date.now(),
    notes: str(raw.notes) ?? "",
    exercises,
    cumulativeRestSeconds: num(raw.cumulativeRestSeconds) ?? 0,
  };
}
