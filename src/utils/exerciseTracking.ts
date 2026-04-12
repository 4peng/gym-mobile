import type { ExerciseDefinition, ExerciseTrackingMode, WorkoutSet } from "@/types";
import { formatSecondsToMMSS } from "@/utils/conversions";

export const EXERCISE_TRACKING_OPTIONS: ExerciseTrackingMode[] = [
  "strength",
  "timed",
  "cardio",
];

const TRACKING_MODE_LABELS: Record<ExerciseTrackingMode, string> = {
  strength: "Strength",
  timed: "Timed",
  cardio: "Cardio",
};

const TIMED_EXERCISE_IDS = new Set([
  "timed-exercise",
  "plank",
  "side-plank",
  "hollow-body-hold",
  "dead-hang",
]);

const CARDIO_EXERCISE_IDS = new Set([
  "cardio",
  "run",
  "treadmill-run",
  "walk",
  "incline-walk",
  "bike",
  "air-bike",
  "row",
  "ski-erg",
  "stair-climber",
  "elliptical",
  "jump-rope",
  "swim",
  "farmer-carry",
]);

export function normalizeTrackingMode(value: unknown): ExerciseTrackingMode {
  return value === "timed" || value === "cardio" ? value : "strength";
}

export function getTrackingModeLabel(mode: ExerciseTrackingMode): string {
  return TRACKING_MODE_LABELS[mode];
}

export function inferTrackingModeFromExerciseDefinition(
  definition?: Pick<ExerciseDefinition, "id"> | null
): ExerciseTrackingMode {
  const id = typeof definition?.id === "string" ? definition.id.trim() : "";
  if (!id) return "strength";
  if (CARDIO_EXERCISE_IDS.has(id)) return "cardio";
  if (TIMED_EXERCISE_IDS.has(id)) return "timed";
  return "strength";
}

export function normalizeSetForTrackingMode(
  set: WorkoutSet,
  trackingMode: ExerciseTrackingMode,
  initialWeight: number | null = null
): WorkoutSet {
  const nextMode = normalizeTrackingMode(trackingMode);

  if (nextMode === "timed") {
    return {
      ...set,
      weight: null,
      reps: null,
      durationSeconds: typeof set.durationSeconds === "number" ? set.durationSeconds : null,
      distance: null,
    };
  }

  if (nextMode === "cardio") {
    return {
      ...set,
      weight: null,
      reps: null,
      durationSeconds: typeof set.durationSeconds === "number" ? set.durationSeconds : null,
      distance: typeof set.distance === "number" ? set.distance : null,
    };
  }

  return {
    ...set,
    weight: typeof set.weight === "number" ? set.weight : initialWeight,
    reps: typeof set.reps === "number" ? set.reps : null,
    durationSeconds: null,
    distance: null,
  };
}

export function formatDistance(distance: number | null | undefined): string {
  if (typeof distance !== "number" || !Number.isFinite(distance)) {
    return "—";
  }

  const rounded = distance >= 10 ? distance.toFixed(1) : distance.toFixed(2);
  return rounded.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

export function formatExerciseSetSummary(
  set: WorkoutSet,
  trackingMode: ExerciseTrackingMode
): string {
  const mode = normalizeTrackingMode(trackingMode);

  if (mode === "timed") {
    const seconds =
      typeof set.durationSeconds === "number" && Number.isFinite(set.durationSeconds)
        ? Math.max(0, Math.round(set.durationSeconds))
        : null;
    return seconds === null ? "—" : formatSecondsToMMSS(seconds);
  }

  if (mode === "cardio") {
    const seconds =
      typeof set.durationSeconds === "number" && Number.isFinite(set.durationSeconds)
        ? Math.max(0, Math.round(set.durationSeconds))
        : null;
    const durationText = seconds === null ? "—" : formatSecondsToMMSS(seconds);
    const distanceText = formatDistance(set.distance);
    return `${durationText} • ${distanceText}`;
  }

  const weightText =
    typeof set.weight === "number" && Number.isFinite(set.weight) ? String(set.weight) : "—";
  const repsText =
    typeof set.reps === "number" && Number.isFinite(set.reps) ? String(set.reps) : "—";
  return `${weightText} × ${repsText}`;
}
