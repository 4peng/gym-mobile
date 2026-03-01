import type { WorkoutSession, WorkoutSet } from "@/types";

/**
 * Placeholder values to show in the UI for a set whose weight/reps are null.
 * `null` means no placeholder is available (render empty).
 */
export interface SetPlaceholder {
  weight: number | null;
  reps: number | null;
}

/**
 * Resolve visual placeholders for every set in an exercise, based on the
 * most recent completed workout AND the current session's progress (fill-forward).
 *
 * Rules:
 * 1. Start with the most recent record from history (positional mapping).
 * 2. If the user has entered a value for any set in the CURRENT session,
 *    that value "fills forward" and overrides history for all SUBSEQUENT sets
 *    that haven't been filled yet.
 */
export function resolveExercisePlaceholders(
  exerciseName: string,
  currentSets: WorkoutSet[],
  history: WorkoutSession[]
): SetPlaceholder[] {
  const previous = findMostRecentExercise(exerciseName, history);
  const currentSetCount = currentSets.length;

  // 1. Initial pass: use history
  const placeholders: SetPlaceholder[] = Array.from({ length: currentSetCount }, (_, i) => {
    if (!previous || previous.length === 0) return { weight: null, reps: null };
    const source = i < previous.length ? previous[i] : previous[previous.length - 1];
    return {
      weight: source.weight,
      reps: source.reps,
    };
  });

  // 2. Fill-forward pass: current entries override history for subsequent sets
  let lastWeight: number | null = null;
  let lastReps: number | null = null;

  for (let i = 0; i < currentSetCount; i++) {
    const current = currentSets[i];
    
    // If this set has a value, it becomes the new "fill-forward" value for the next sets.
    if (current.weight !== null) {
      lastWeight = current.weight;
    } else if (lastWeight !== null) {
      // If current is empty but we have a previous value, override the placeholder.
      placeholders[i].weight = lastWeight;
    }

    if (current.reps !== null) {
      lastReps = current.reps;
    } else if (lastReps !== null) {
      placeholders[i].reps = lastReps;
    }
  }

  return placeholders;
}

/**
 * When the user taps "Add Set" during a workout, the new set's placeholder
 * should mirror the immediately preceding set in the *current* exercise
 * (not from history). If there is no preceding set, returns nulls.
 */
export function resolveAddSetPlaceholder(
  currentSets: WorkoutSet[]
): SetPlaceholder {
  if (currentSets.length === 0) {
    return { weight: null, reps: null };
  }
  const last = currentSets[currentSets.length - 1];
  return {
    weight: last.weight,
    reps: last.reps,
  };
}

/**
 * When the user completes a set without editing, we must resolve the
 * placeholder into a concrete value. Returns the resolved weight/reps
 * pair; the caller should write them to the store before marking complete.
 */
export function resolveSetOnComplete(
  currentSet: WorkoutSet,
  placeholder: SetPlaceholder
): { weight: number; reps: number } {
  return {
    weight: currentSet.weight ?? placeholder.weight ?? 0,
    reps: currentSet.reps ?? placeholder.reps ?? 0,
  };
}

// ──────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────

/**
 * Walk through completed history (already sorted newest-first) and return
 * the sets array from the first matching exercise name.
 */
function findMostRecentExercise(
  name: string,
  history: WorkoutSession[]
): WorkoutSet[] | null {
  for (const session of history) {
    if (!session.completedAt) continue; // skip incomplete
    const match = session.exercises.find(
      (e) => e.name.toLowerCase() === name.toLowerCase()
    );
    if (match) return match.sets;
  }
  return null;
}
