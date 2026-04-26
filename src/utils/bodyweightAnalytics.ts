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

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isBodyweightStrengthExercise(exercise: ExerciseIdentityLike): boolean {
  if (exercise.isBodyweight) return true;

  const identityKey = normalizeExerciseIdentityKey(
    exercise.exerciseDefinitionId || exercise.name
  );
  if (!identityKey) return false;
  if (BODYWEIGHT_EXERCISE_IDS.has(identityKey)) return true;
  return BODYWEIGHT_NAME_PATTERNS.some((pattern) => pattern.test(identityKey));
}

export function resolveEffectiveStrengthLoad(
  exercise: ExerciseIdentityLike,
  loggedWeight: number | null,
  loggedWeightUnit: WeightUnit,
  targetUnit: WeightUnit,
  analyticsBodyweight: number | null,
  analyticsBodyweightUnit: WeightUnit
): number | null {
  if (!isBodyweightStrengthExercise(exercise)) {
    return isFiniteNumber(loggedWeight)
      ? convertWeight(loggedWeight, loggedWeightUnit, targetUnit)
      : loggedWeight;
  }

  const extraLoad = isFiniteNumber(loggedWeight)
    ? convertWeight(loggedWeight, loggedWeightUnit, targetUnit) ?? loggedWeight
    : 0;

  if (!isFiniteNumber(analyticsBodyweight)) {
    return extraLoad;
  }

  const convertedBodyweight =
    convertWeight(analyticsBodyweight, analyticsBodyweightUnit, targetUnit) ??
    analyticsBodyweight;

  return convertedBodyweight + extraLoad;
}
