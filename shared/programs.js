/**
 * Shared program/routine utilities.
 *
 * IMPORTANT: This module is currently client-only (mobile + web). The server
 * has its own independent Mongoose schemas in server/src/models/ for programs
 * and workouts. Both the client normalization here AND the server schemas must
 * be kept in sync — any structural change to exercises, sets, or tracking
 * modes needs a corresponding update in the server models.
 */

export const DEFAULT_EXERCISE_SETS = [
  { type: "working" },
  { type: "working" },
  { type: "working" },
];
export const DEFAULT_EXERCISE_REST_SECONDS = 90;
export const DEFAULT_WEIGHT_UNIT = "kg";
export const DEFAULT_TRACKING_MODE = "strength";

/** Tap-cycle order for set-type markers. */
export const NEXT_SET_TYPE = { working: "warmup", warmup: "dropset", dropset: "working" };

function normalizeName(name) {
  return typeof name === "string" ? name.trim() : "";
}

function normalizeWholeNumber(value, fallback, minimum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  const rounded = Math.round(numeric);
  return rounded < minimum ? minimum : rounded;
}

export function normalizeSets(sets) {
  if (Array.isArray(sets)) {
    return sets.map((s) => ({
      type: s?.type === "warmup" || s?.type === "dropset" ? s.type : "working",
    }));
  }

  // Backward compatibility: convert number to array of working sets
  const count = normalizeWholeNumber(sets, 3, 1);
  return Array.from({ length: count }, () => ({ type: "working" }));
}

function normalizeMuscles(muscles) {
  if (!Array.isArray(muscles)) {
    return [];
  }

  return Array.from(
    new Set(muscles.filter((muscle) => typeof muscle === "string" && muscle.length > 0)),
  );
}

export function normalizeTrackingMode(value) {
  return value === "timed" || value === "cardio" ? value : DEFAULT_TRACKING_MODE;
}

function normalizeOptionalWeight(value) {
  if (value === "" || value == null) {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return numeric;
}

export function createEmptyExercise(createId) {
  return {
    id: typeof createId === "function" ? createId() : "",
    exerciseDefinitionId: "",
    trackingMode: DEFAULT_TRACKING_MODE,
    name: "",
    defaultSets: [...DEFAULT_EXERCISE_SETS],
    restSeconds: DEFAULT_EXERCISE_REST_SECONDS,
    notes: "",
    weightUnit: DEFAULT_WEIGHT_UNIT,
    initialWeight: null,
    muscles: [],
    isBodyweight: false,
  };
}

export function normalizeExercise(exercise, createId) {
  return {
    id:
      typeof exercise?.id === "string" && exercise.id.length > 0
        ? exercise.id
        : typeof createId === "function"
          ? createId()
          : "",
    exerciseDefinitionId:
      typeof exercise?.exerciseDefinitionId === "string"
        ? exercise.exerciseDefinitionId.trim()
        : "",
    trackingMode: normalizeTrackingMode(exercise?.trackingMode),
    name: normalizeName(exercise?.name),
    defaultSets: normalizeSets(exercise?.defaultSets),
    restSeconds: normalizeWholeNumber(exercise?.restSeconds, DEFAULT_EXERCISE_REST_SECONDS, 0),
    notes: normalizeName(exercise?.notes),
    weightUnit: exercise?.weightUnit === "lbs" ? "lbs" : DEFAULT_WEIGHT_UNIT,
    initialWeight: normalizeOptionalWeight(exercise?.initialWeight),
    muscles: normalizeMuscles(exercise?.muscles),
    isBodyweight: typeof exercise?.isBodyweight === "boolean" ? exercise.isBodyweight : false,
  };
}

export function normalizeExercises(exercises, createId) {
  if (!Array.isArray(exercises)) {
    return [];
  }

  return exercises.map((exercise) => normalizeExercise(exercise, createId));
}

export function copyExercises(exercises, createId) {
  if (!Array.isArray(exercises)) {
    return [];
  }

  return exercises.map((exercise) =>
    normalizeExercise(
      {
        ...exercise,
        id: typeof createId === "function" ? createId() : exercise?.id,
      },
      createId,
    ),
  );
}

export function buildRoutineDraft(name, exercises, createId) {
  return {
    name: normalizeName(name),
    exercises: normalizeExercises(exercises, createId),
  };
}

export function createRoutineSnapshot(name, exercises) {
  const draft = buildRoutineDraft(name, exercises);
  return JSON.stringify({
    name: draft.name,
    exercises: draft.exercises.map((exercise) => ({
      ...exercise,
      muscles: [...exercise.muscles].sort(),
    })),
  });
}

export function validateRoutineDraft(name, exercises) {
  const draft = buildRoutineDraft(name, exercises);

  if (!draft.name) {
    return "Please enter a program name.";
  }

  if (draft.exercises.length === 0) {
    return "Add at least one exercise before saving.";
  }

  const emptyNameIdx = draft.exercises.findIndex((exercise) => exercise.name === "");
  if (emptyNameIdx !== -1) {
    return `Exercise ${emptyNameIdx + 1} needs a name.`;
  }

  return null;
}
