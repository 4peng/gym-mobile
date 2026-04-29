export type WeightUnit = "kg" | "lbs";
export type ExerciseTrackingMode = "strength" | "timed" | "cardio";
export type SetType = "working" | "warmup" | "dropset";

export interface ProgramSetTemplate {
  type: SetType;
}

export interface RoutineExerciseDraft<TMuscle extends string = string> {
  id: string;
  exerciseDefinitionId: string;
  trackingMode: ExerciseTrackingMode;
  name: string;
  defaultSets: ProgramSetTemplate[];
  restSeconds: number;
  notes: string;
  weightUnit: WeightUnit;
  initialWeight: number | null;
  muscles: TMuscle[];
}

export interface RoutineDraft<TMuscle extends string = string> {
  name: string;
  exercises: RoutineExerciseDraft<TMuscle>[];
}

export const DEFAULT_EXERCISE_SETS: ProgramSetTemplate[];
export const DEFAULT_EXERCISE_REST_SECONDS: 90;
export const DEFAULT_WEIGHT_UNIT: "kg";
export const DEFAULT_TRACKING_MODE: "strength";

export function createEmptyExercise<TMuscle extends string = string>(
  createId: () => string
): RoutineExerciseDraft<TMuscle>;

export function normalizeExercise<TMuscle extends string = string>(
  exercise?: Partial<RoutineExerciseDraft<TMuscle>> | null,
  createId?: (() => string) | undefined
): RoutineExerciseDraft<TMuscle>;

export function normalizeExercises<TMuscle extends string = string>(
  exercises?: Array<Partial<RoutineExerciseDraft<TMuscle>> | null> | null,
  createId?: (() => string) | undefined
): RoutineExerciseDraft<TMuscle>[];

export function copyExercises<TMuscle extends string = string>(
  exercises?: Array<Partial<RoutineExerciseDraft<TMuscle>> | null> | null,
  createId?: (() => string) | undefined
): RoutineExerciseDraft<TMuscle>[];

export function buildRoutineDraft<TMuscle extends string = string>(
  name: string,
  exercises?: Array<Partial<RoutineExerciseDraft<TMuscle>> | null> | null,
  createId?: (() => string) | undefined
): RoutineDraft<TMuscle>;

export function createRoutineSnapshot<TMuscle extends string = string>(
  name: string,
  exercises?: Array<Partial<RoutineExerciseDraft<TMuscle>> | null> | null
): string;

export function validateRoutineDraft<TMuscle extends string = string>(
  name: string,
  exercises?: Array<Partial<RoutineExerciseDraft<TMuscle>> | null> | null
): string | null;

export function createEmptyRoutine<TMuscle extends string = string>(
  createId: () => string
): RoutineDraft<TMuscle>;
