export const DEFAULT_EXERCISE_SETS = 3;
export const DEFAULT_EXERCISE_REST_SECONDS = 90;
export const DEFAULT_WEIGHT_UNIT = "kg";
export const DEFAULT_TRACKING_MODE = "strength";

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

function normalizeMuscles(muscles) {
  if (!Array.isArray(muscles)) {
    return [];
  }

  return Array.from(
    new Set(muscles.filter((muscle) => typeof muscle === "string" && muscle.length > 0))
  );
}

function normalizeTrackingMode(value) {
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
    defaultSets: DEFAULT_EXERCISE_SETS,
    restSeconds: DEFAULT_EXERCISE_REST_SECONDS,
    notes: "",
    weightUnit: DEFAULT_WEIGHT_UNIT,
    initialWeight: null,
    muscles: [],
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
    defaultSets: normalizeWholeNumber(exercise?.defaultSets, DEFAULT_EXERCISE_SETS, 1),
    restSeconds: normalizeWholeNumber(exercise?.restSeconds, DEFAULT_EXERCISE_REST_SECONDS, 0),
    notes: normalizeName(exercise?.notes),
    weightUnit: exercise?.weightUnit === "lbs" ? "lbs" : DEFAULT_WEIGHT_UNIT,
    initialWeight: normalizeOptionalWeight(exercise?.initialWeight),
    muscles: normalizeMuscles(exercise?.muscles),
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
      createId
    )
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

export function createEmptyRoutine(createId) {
  return {
    name: "",
    exercises: [createEmptyExercise(createId)],
  };
}
