export interface ExerciseIdentityLike {
  exerciseDefinitionId?: string | null;
  name: string;
}

export function normalizeExerciseIdentityKey(value?: string | null): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function getExerciseIdentityKey(exercise: ExerciseIdentityLike): string {
  return (
    normalizeExerciseIdentityKey(exercise.exerciseDefinitionId) ||
    normalizeExerciseIdentityKey(exercise.name)
  );
}

export function matchesExerciseIdentity(
  exercise: ExerciseIdentityLike,
  identityKey: string
): boolean {
  return getExerciseIdentityKey(exercise) === normalizeExerciseIdentityKey(identityKey);
}
