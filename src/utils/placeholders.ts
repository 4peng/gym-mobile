import type { WorkoutSet, WorkoutExercise } from "@/types";
import { convertWeight } from "./conversions";

/** Ghost values shown for a set whose weight/reps are still null. */
export interface SetPlaceholder {
  weight: number | null;
  reps: number | null;
}

/**
 * Placeholders for every set of an exercise:
 * 1. start from the most recent stored occurrence of the exercise (positional),
 * 2. then a value typed into an earlier set in this session fills forward into
 *    later, still-empty sets.
 */
export function resolveExercisePlaceholders(
  currentSets: WorkoutSet[],
  previous: WorkoutExercise | null,
  targetUnit: "kg" | "lbs" = "kg",
): SetPlaceholder[] {
  const previousSets = previous?.sets ?? [];
  const previousUnit = previous?.weightUnit || "kg";

  const placeholders: SetPlaceholder[] = currentSets.map((_, i) => {
    if (previousSets.length === 0) return { weight: null, reps: null };
    const source = previousSets[Math.min(i, previousSets.length - 1)];
    return { weight: convertWeight(source.weight, previousUnit, targetUnit), reps: source.reps };
  });

  let lastWeight: number | null = null;
  let lastReps: number | null = null;
  currentSets.forEach((current, i) => {
    if (current.weight !== null) lastWeight = current.weight;
    else if (lastWeight !== null) placeholders[i].weight = lastWeight;

    if (current.reps !== null) lastReps = current.reps;
    else if (lastReps !== null) placeholders[i].reps = lastReps;
  });

  return placeholders;
}

/** Concrete values to write when a set is completed without being edited. */
export function resolveSetOnComplete(
  currentSet: WorkoutSet,
  placeholder: SetPlaceholder,
): { weight: number; reps: number } {
  return {
    weight: currentSet.weight ?? placeholder.weight ?? 0,
    reps: currentSet.reps ?? placeholder.reps ?? 0,
  };
}
