export const PRIMARY_MUSCLE_GROUPS: readonly [
  "chest",
  "shoulder",
  "back",
  "core",
  "arms",
  "glutes",
  "hamstrings",
  "quads",
  "calves",
  "mobility",
];

export const DETAILED_MUSCLE_GROUPS: readonly [
  "upper_back",
  "lats",
  "lower_back",
  "front_delts",
  "side_delts",
  "rear_delts",
  "biceps",
  "triceps",
  "forearms",
];

export type PrimaryMuscleGroup = (typeof PRIMARY_MUSCLE_GROUPS)[number];
export type DetailedMuscleGroup = (typeof DETAILED_MUSCLE_GROUPS)[number];
export type MuscleGroup = PrimaryMuscleGroup | DetailedMuscleGroup;

export const PRIMARY_TO_DETAILED_MAP: Readonly<Record<PrimaryMuscleGroup, readonly MuscleGroup[]>>;
export const DETAILED_TO_PRIMARY_MAP: Readonly<Record<DetailedMuscleGroup, PrimaryMuscleGroup>>;
export const MUSCLE_GROUPS: typeof PRIMARY_MUSCLE_GROUPS;
export const DETAILED_MODE_MUSCLE_GROUPS: readonly MuscleGroup[];
export const MUSCLE_LABELS: Readonly<Record<MuscleGroup, string>>;

export function expandPrimaryMusclesForDetailedMode(muscles: MuscleGroup[]): MuscleGroup[];
export function collapseDetailedMusclesToPrimary(muscles: MuscleGroup[]): MuscleGroup[];
