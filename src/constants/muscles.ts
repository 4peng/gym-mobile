import { MUSCLE_LABELS, type MuscleGroup } from "../../shared/muscles.js";
export * from "../../shared/muscles.js";

/** "Chest • Arms" style label list; "General" when empty. */
export function formatMuscleLabels(
  muscles: readonly string[] | undefined,
  separator = " • ",
): string {
  if (!muscles?.length) return "General";
  return muscles.map((m) => MUSCLE_LABELS[m as MuscleGroup] ?? m).join(separator);
}
