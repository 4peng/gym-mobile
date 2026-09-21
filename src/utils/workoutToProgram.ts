import type { ProgramExercise, WorkoutExercise } from "@/types";

export function sessionExercisesToProgramExercises(
  exercises: WorkoutExercise[],
): ProgramExercise[] {
  return exercises.map((ex): ProgramExercise => ({
    id: ex.id,
    exerciseDefinitionId: ex.exerciseDefinitionId || "",
    trackingMode: ex.trackingMode,
    name: ex.name,
    defaultSets: ex.sets.map((s) => ({ type: s.type || "working" })),
    restSeconds: ex.restSeconds,
    notes: ex.notes,
    weightUnit: ex.weightUnit,
    initialWeight: ex.sets[0]?.weight ?? null,
    muscles: ex.muscles,
    isBodyweight: ex.isBodyweight,
  }));
}
