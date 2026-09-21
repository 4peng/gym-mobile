import type { ExerciseIdentityLike } from "@/utils/exerciseIdentity";
import { normalizeExerciseIdentityKey } from "@/utils/exerciseIdentity";
import { convertWeight } from "@/utils/conversions";

export type WeightUnit = "kg" | "lbs";

const BODYWEIGHT_EXERCISE_IDS = new Set([
  "push-up",
  "weighted-push-up",
  "push-up-plus",
  "dip",
  "weighted-dip",
  "bench-dip",
  "pull-up",
  "pull-ups",
  "chin-up",
  "chin-ups",
  "hanging-leg-raise",
  "captains-chair-leg-raise",
]);

const BODYWEIGHT_NAME_PATTERNS = [
  /push[\s-]?up/,
  /pull[\s-]?up/,
  /chin[\s-]?up/,
  /(^|\s)dip(s)?($|\s)/,
  /bench[\s-]?dip/,
  /hanging leg raise/,
  /captain'?s chair leg raise/,
];

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function isBodyweightStrengthExercise(exercise: ExerciseIdentityLike): boolean {
  if (exercise.isBodyweight) return true;

  const identityKey = normalizeExerciseIdentityKey(exercise.exerciseDefinitionId || exercise.name);
  if (!identityKey) return false;
  if (BODYWEIGHT_EXERCISE_IDS.has(identityKey)) return true;
  return BODYWEIGHT_NAME_PATTERNS.some((pattern) => pattern.test(identityKey));
}

/**
 * Builds a per-exercise load resolver: the identity/bodyweight lookup and the
 * bodyweight conversion depend only on the exercise, so they run once here
 * instead of once per set. Bodyweight exercises add the analytics bodyweight
 * to any logged extra load; everything else just converts the logged weight.
 */
export function makeLoadResolver(
  exercise: ExerciseIdentityLike & { weightUnit?: WeightUnit },
  targetUnit: WeightUnit,
  analyticsBodyweight: number | null,
  analyticsBodyweightUnit: WeightUnit,
  loggedWeightUnit: WeightUnit = exercise.weightUnit ?? "kg",
) {
  const isBW = isBodyweightStrengthExercise(exercise);
  const bodyweight =
    isBW && isFiniteNumber(analyticsBodyweight)
      ? (convertWeight(analyticsBodyweight, analyticsBodyweightUnit, targetUnit) ??
        analyticsBodyweight)
      : null;

  return (loggedWeight: number | null): number | null => {
    if (!isBW) {
      return isFiniteNumber(loggedWeight)
        ? convertWeight(loggedWeight, loggedWeightUnit, targetUnit)
        : loggedWeight;
    }
    const extraLoad = isFiniteNumber(loggedWeight)
      ? (convertWeight(loggedWeight, loggedWeightUnit, targetUnit) ?? loggedWeight)
      : 0;
    return bodyweight === null ? extraLoad : bodyweight + extraLoad;
  };
}

/** Single-set convenience over makeLoadResolver. */
export function resolveEffectiveStrengthLoad(
  exercise: ExerciseIdentityLike,
  loggedWeight: number | null,
  loggedWeightUnit: WeightUnit,
  targetUnit: WeightUnit,
  analyticsBodyweight: number | null,
  analyticsBodyweightUnit: WeightUnit,
): number | null {
  return makeLoadResolver(
    exercise,
    targetUnit,
    analyticsBodyweight,
    analyticsBodyweightUnit,
    loggedWeightUnit,
  )(loggedWeight);
}
