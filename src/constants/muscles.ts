export const PRIMARY_MUSCLE_GROUPS = [
  "chest",
  "shoulder",
  "back",
  "core",
  "arms",
  "glutes",
  "hamstrings",
  "quads",
  "calves",
] as const;

export const DETAILED_MUSCLE_GROUPS = [
  "upper_back",
  "lats",
  "lower_back",
  "front_delts",
  "side_delts",
  "rear_delts",
  "biceps",
  "triceps",
  "forearms",
] as const;

export const PRIMARY_TO_DETAILED_MAP = {
  shoulder: ["front_delts", "side_delts", "rear_delts"],
  back: ["upper_back", "lats", "lower_back"],
  arms: ["biceps", "triceps", "forearms"],
} as const;

export const DETAILED_TO_PRIMARY_MAP = {
  front_delts: "shoulder",
  side_delts: "shoulder",
  rear_delts: "shoulder",
  upper_back: "back",
  lats: "back",
  lower_back: "back",
  biceps: "arms",
  triceps: "arms",
  forearms: "arms",
} as const;

export const MUSCLE_GROUPS = PRIMARY_MUSCLE_GROUPS;

export const ALL_MUSCLE_GROUPS = [
  ...PRIMARY_MUSCLE_GROUPS,
  ...DETAILED_MUSCLE_GROUPS,
] as const;

export type PrimaryMuscleGroup = (typeof PRIMARY_MUSCLE_GROUPS)[number];
export type DetailedMuscleGroup = (typeof DETAILED_MUSCLE_GROUPS)[number];
export type MuscleGroup = PrimaryMuscleGroup | DetailedMuscleGroup;

export const DETAILED_MODE_MUSCLE_GROUPS: readonly MuscleGroup[] =
  PRIMARY_MUSCLE_GROUPS.flatMap((muscle) => {
    const mapped =
      PRIMARY_TO_DETAILED_MAP[
        muscle as keyof typeof PRIMARY_TO_DETAILED_MAP
      ];
    return mapped ? [...mapped] : [muscle];
  });

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  shoulder: "Shoulder",
  back: "Back",
  core: "Core",
  arms: "Arms",
  glutes: "Glutes",
  hamstrings: "Hamstrings",
  quads: "Quads",
  calves: "Calves",
  upper_back: "Upper Back",
  lats: "Lats",
  lower_back: "Lower Back",
  front_delts: "Front Delts",
  side_delts: "Side Delts",
  rear_delts: "Rear Delts",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
};

export function expandPrimaryMusclesForDetailedMode(
  muscles: MuscleGroup[]
): MuscleGroup[] {
  const expanded = muscles.flatMap((muscle) => {
    const mapped = PRIMARY_TO_DETAILED_MAP[muscle as keyof typeof PRIMARY_TO_DETAILED_MAP];
    return mapped ? [...mapped] : [muscle];
  });
  return Array.from(new Set(expanded)) as MuscleGroup[];
}

export function collapseDetailedMusclesToPrimary(
  muscles: MuscleGroup[]
): MuscleGroup[] {
  const collapsed = muscles.map((muscle) => {
    const mapped =
      DETAILED_TO_PRIMARY_MAP[
        muscle as keyof typeof DETAILED_TO_PRIMARY_MAP
      ];
    return mapped ?? muscle;
  });
  return Array.from(new Set(collapsed)) as MuscleGroup[];
}
