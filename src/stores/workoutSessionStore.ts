import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { zustandAsyncStorage } from "@/storage/asyncStorage";
import { workoutRepo } from "@/db";
import { USER_ID } from "@/constants/user";
import { generateId } from "@/utils/id";
import { MuscleGroup } from "@/constants/muscles";
import type {
  ExerciseDefinition,
  Program,
  WorkoutSession,
  WorkoutExercise,
  WorkoutSet,
} from "@/types";
import { getExerciseIdentityKey, normalizeExerciseIdentityKey } from "@/utils/exerciseIdentity";
import {
  inferTrackingModeFromExerciseDefinition,
  normalizeSetForTrackingMode,
  normalizeTrackingMode,
} from "@/utils/exerciseTracking";
import {
  scheduleRestCompleteNotification,
  cancelScheduledNotification,
} from "@/utils/notifications";
import {
  buildActiveRestTimerLiveActivityProps,
  buildRestTimerLiveActivityProps,
  endRestTimerLiveActivity,
  startRestTimerLiveActivity,
  updateRestTimerLiveActivity,
} from "@/utils/restTimerLiveActivity";
import { useExerciseLibraryStore } from "@/stores/exerciseLibraryStore";
import { useUiPreferencesStore } from "@/stores/uiPreferencesStore";
import { normalizePersistedWorkoutSession } from "@/utils/normalizeWorkout";
import { NEXT_SET_TYPE } from "@/shared/programs.js";

const STORE_VERSION = 6;

export interface ActiveRestTimer {
  /** Absolute epoch-ms when the rest period ends. */
  endTime: number;
  /** Absolute epoch-ms when the rest period started. */
  startTime: number;
  exerciseId: string;
  exerciseName: string;
  /** Identifier returned by expo-notifications. */
  notificationId: string;
}

/**
 * Live-session state plus backup bookkeeping. Completed sessions live in SQLite
 * (`workoutRepo`); this store only tracks which of them still need pushing.
 */
interface WorkoutSessionState {
  activeSession: WorkoutSession | null;
  activeRestTimer: ActiveRestTimer | null;
  /** Identity keys pinned to the top of the stats list. */
  pinnedExerciseNames: string[];
  /** Focused exercise in the single-exercise workout view. */
  activeExerciseId: string | null;
  /** Completed sessions changed locally and not yet backed up. */
  dirtyWorkoutIds: string[];
  /** Sessions deleted locally and not yet deleted in the cloud. */
  deletedWorkoutIds: string[];
}

type EditableSetField = keyof Pick<WorkoutSet, "weight" | "reps" | "durationSeconds" | "distance">;

interface WorkoutSessionActions {
  startQuickSession: () => void;
  startFromProgram: (program: Program) => void;
  updateWorkoutNotes: (notes: string) => void;
  /** Stores the session (completed sets only). Returns false when nothing was completed. */
  completeSession: () => boolean;
  discardSession: () => void;
  deleteHistorySession: (sessionId: string) => void;
  updateSessionDate: (sessionId: string, completedAtIso: string) => void;

  setActiveExerciseId: (id: string | null) => void;
  addExercise: (exerciseDefinition?: ExerciseDefinition | null) => void;
  reorderExercises: (exerciseIds: string[]) => void;
  removeExercise: (exerciseId: string) => void;
  selectExerciseDefinition: (exerciseId: string, exerciseDefinition: ExerciseDefinition) => void;
  updateExerciseField: <F extends UpdatableExerciseField>(
    exerciseId: string,
    field: F,
    value: ExerciseFieldValue<F>,
  ) => void;
  toggleExerciseUnit: (exerciseId: string) => void;
  toggleExerciseBodyweight: (exerciseId: string) => void;

  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  updateSet: (
    exerciseId: string,
    setId: string,
    field: EditableSetField,
    value: number | null,
  ) => void;
  updateHistorySet: (
    sessionId: string,
    exerciseId: string,
    setId: string,
    field: EditableSetField,
    value: number | null,
  ) => void;
  toggleSetCompletion: (exerciseId: string, setId: string) => void;
  toggleSetType: (exerciseId: string, setId: string) => void;

  startRestTimer: (exerciseId: string, restSeconds: number, exerciseName: string) => Promise<void>;
  cancelRestTimer: () => Promise<void>;
  clearExpiredTimer: () => void;

  togglePinExercise: (identityKey: string) => void;

  updateMusclesInHistory: (exerciseIdentityKey: string, muscles: MuscleGroup[]) => void;
  renameExerciseDefinitionReferences: (exerciseDefinitionId: string, nextName: string) => void;
  removeExerciseDefinitionReferences: (exerciseDefinitionId: string) => void;

  /** Stores completed sessions (restore / import). `markDirty` queues them for backup. */
  importWorkouts: (sessions: WorkoutSession[], markDirty: boolean) => void;
  clearDeletedWorkouts: (ids: string[]) => void;
  /** Clears push bookkeeping, keeping any id edited after `pushedAt`. */
  clearDirtyWorkouts: (ids: string[], pushedAt: number) => void;
}

// ── Helpers ────────────────────────────────────

function createEmptySet(
  trackingMode: WorkoutExercise["trackingMode"] = "strength",
  initialWeight: number | null = null,
  type: WorkoutSet["type"] = "working",
): WorkoutSet {
  return normalizeSetForTrackingMode(
    {
      id: generateId(),
      weight: initialWeight,
      reps: null,
      durationSeconds: null,
      distance: null,
      type,
    },
    trackingMode,
    initialWeight,
  );
}

function createEmptySetsFromTemplates(
  templates: { type: WorkoutSet["type"] }[],
  trackingMode: WorkoutExercise["trackingMode"] = "strength",
  initialWeight: number | null = null,
): WorkoutSet[] {
  return templates.map((t) => createEmptySet(trackingMode, initialWeight, t.type));
}

type UpdatableExerciseField = keyof Pick<
  WorkoutExercise,
  | "name"
  | "exerciseDefinitionId"
  | "trackingMode"
  | "restSeconds"
  | "notes"
  | "weightUnit"
  | "muscles"
  | "isBodyweight"
>;

type ExerciseFieldValue<F extends UpdatableExerciseField> = F extends "restSeconds"
  ? number
  : F extends "isBodyweight"
    ? boolean
    : F extends "weightUnit"
      ? "kg" | "lbs"
      : F extends "muscles"
        ? MuscleGroup[]
        : F extends "trackingMode"
          ? WorkoutExercise["trackingMode"]
          : string;

/** Most recent stored occurrence of an exercise, used to seed new exercises. */
function latestOccurrence(
  exercise: ExerciseDefinition | WorkoutExercise | null,
): WorkoutExercise | null {
  if (!exercise) return null;
  const key = getExerciseIdentityKey(exercise);
  return key ? workoutRepo.latestExercise(key) : null;
}

function inferTrackingMode(
  exercise: ExerciseDefinition | WorkoutExercise | null,
): WorkoutExercise["trackingMode"] {
  return (
    latestOccurrence(exercise)?.trackingMode ?? inferTrackingModeFromExerciseDefinition(exercise)
  );
}

function inferWeightUnit(exercise: ExerciseDefinition | WorkoutExercise | null): "kg" | "lbs" {
  return (
    latestOccurrence(exercise)?.weightUnit ??
    useUiPreferencesStore.getState().preferredWeightUnit ??
    "kg"
  );
}

/** Keeps only completed sets, and only exercises that still have one. */
function buildCompletedSession(session: WorkoutSession): WorkoutSession {
  return {
    ...session,
    exercises: session.exercises
      .map((exercise) => ({ ...exercise, sets: exercise.sets.filter((set) => !!set.completedAt) }))
      .filter((exercise) => exercise.sets.length > 0),
  };
}

const addUnique = (list: string[], id: string) => {
  if (!list.includes(id)) list.push(id);
};

type StoreSet = (recipe: (state: WorkoutSessionState) => void) => void;

/**
 * Applies `mutate` to every stored exercise (via the repo) and to the active
 * session; marks changed stored sessions dirty. `mutate` returns true on change.
 */
function propagateExerciseEdit(
  set: StoreSet,
  mutate: (exercise: WorkoutExercise) => boolean,
): void {
  const changed = workoutRepo.rewriteExercises(mutate);
  set((state) => {
    changed.forEach((id) => addUnique(state.dirtyWorkoutIds, id));
    if (!state.activeSession) return;
    let touched = false;
    state.activeSession.exercises.forEach((ex) => {
      if (mutate(ex)) touched = true;
    });
    if (touched) state.activeSession.updatedAt = Date.now();
  });
}

function normalizePersistedState(
  state: Partial<WorkoutSessionState> | undefined,
): WorkoutSessionState {
  const activeSession = normalizePersistedWorkoutSession(state?.activeSession);
  const ids = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  const timer = state?.activeRestTimer;
  return {
    activeSession,
    activeRestTimer:
      timer &&
      typeof timer.endTime === "number" &&
      typeof timer.startTime === "number" &&
      typeof timer.exerciseId === "string" &&
      typeof timer.exerciseName === "string" &&
      typeof timer.notificationId === "string"
        ? timer
        : null,
    pinnedExerciseNames: ids(state?.pinnedExerciseNames).map((n) => n.toLowerCase()),
    activeExerciseId:
      typeof state?.activeExerciseId === "string"
        ? state.activeExerciseId
        : (activeSession?.exercises[0]?.id ?? null),
    dirtyWorkoutIds: ids(state?.dirtyWorkoutIds),
    deletedWorkoutIds: ids(state?.deletedWorkoutIds),
  };
}

// ── Store ──────────────────────────────────────

export const useWorkoutSessionStore = create<WorkoutSessionState & WorkoutSessionActions>()(
  persist(
    immer((set, get) => {
      const withActive = (recipe: (session: WorkoutSession, state: WorkoutSessionState) => void) =>
        set((state) => {
          if (!state.activeSession) return;
          recipe(state.activeSession, state);
          state.activeSession.updatedAt = Date.now();
        });

      const withExercise = (
        exerciseId: string,
        recipe: (ex: WorkoutExercise, state: WorkoutSessionState) => void,
      ) =>
        withActive((session, state) => {
          const ex = session.exercises.find((e) => e.id === exerciseId);
          if (ex) recipe(ex, state);
        });

      const endTimerSideEffects = (timer: ActiveRestTimer) => {
        void cancelScheduledNotification(timer.notificationId);
        void endRestTimerLiveActivity(
          buildActiveRestTimerLiveActivityProps(get().activeSession, timer),
        );
      };

      /** Adds the time the timer has run (until `until`) to the session's rest total and clears it. */
      const bankRestTime = (timer: ActiveRestTimer, until: number) => {
        const elapsed = Math.max(0, Math.floor((until - timer.startTime) / 1000));
        set((state) => {
          if (state.activeSession) {
            state.activeSession.cumulativeRestSeconds =
              (state.activeSession.cumulativeRestSeconds || 0) + elapsed;
          }
          state.activeRestTimer = null;
        });
      };

      return {
        activeSession: null,
        activeRestTimer: null,
        pinnedExerciseNames: [],
        activeExerciseId: null,
        dirtyWorkoutIds: [],
        deletedWorkoutIds: [],

        // ── Session lifecycle ──

        startQuickSession: () => {
          set((state) => {
            state.activeSession = {
              _id: generateId(),
              userId: USER_ID,
              startedAt: new Date().toISOString(),
              updatedAt: Date.now(),
              notes: "",
              exercises: [],
              cumulativeRestSeconds: 0,
            };
            state.activeExerciseId = null;
          });
        },

        startFromProgram: (program) => {
          const exercises: WorkoutExercise[] = (program.exercises || []).map((pe) => {
            const trackingMode = normalizeTrackingMode(pe.trackingMode);
            return {
              id: generateId(),
              programExerciseId: pe.id,
              exerciseDefinitionId: pe.exerciseDefinitionId,
              trackingMode,
              name: pe.name,
              restSeconds: pe.restSeconds,
              notes: pe.notes,
              sets: createEmptySetsFromTemplates(
                pe.defaultSets,
                trackingMode,
                pe.initialWeight ?? null,
              ),
              weightUnit: pe.weightUnit || "kg",
              muscles: pe.muscles || [],
              isBodyweight: pe.isBodyweight,
            };
          });
          set((state) => {
            state.activeSession = {
              _id: generateId(),
              userId: USER_ID,
              programId: program._id,
              startedAt: new Date().toISOString(),
              updatedAt: Date.now(),
              notes: "",
              exercises,
              cumulativeRestSeconds: 0,
            };
            state.activeExerciseId = exercises[0]?.id ?? null;
          });
        },

        updateWorkoutNotes: (notes) =>
          withActive((session) => {
            session.notes = notes;
          }),

        completeSession: () => {
          const { activeSession, activeRestTimer } = get();
          if (!activeSession) return false;
          if (activeRestTimer) endTimerSideEffects(activeRestTimer);

          const finalSession = {
            ...buildCompletedSession(activeSession),
            completedAt: new Date().toISOString(),
            updatedAt: Date.now(),
          };
          const stored = finalSession.exercises.length > 0;
          if (stored) workoutRepo.upsertMany([finalSession]);

          set((state) => {
            state.activeSession = null;
            state.activeRestTimer = null;
            state.activeExerciseId = null;
            if (stored) addUnique(state.dirtyWorkoutIds, finalSession._id);
          });
          return stored;
        },

        discardSession: () => {
          const timer = get().activeRestTimer;
          if (timer) endTimerSideEffects(timer);
          set((state) => {
            state.activeSession = null;
            state.activeRestTimer = null;
            state.activeExerciseId = null;
          });
        },

        deleteHistorySession: (sessionId) => {
          workoutRepo.deleteMany([sessionId]);
          set((state) => {
            addUnique(state.deletedWorkoutIds, sessionId);
            state.dirtyWorkoutIds = state.dirtyWorkoutIds.filter((id) => id !== sessionId);
          });
        },

        updateSessionDate: (sessionId, completedAtIso) => {
          if (!workoutRepo.updateDate(sessionId, completedAtIso)) return;
          set((state) => addUnique(state.dirtyWorkoutIds, sessionId));
        },

        // ── Exercise mutations ──

        setActiveExerciseId: (id) =>
          set((state) => {
            state.activeExerciseId = id;
          }),

        addExercise: (exerciseDefinition = null) => {
          const trackingMode = inferTrackingMode(exerciseDefinition);
          const weightUnit = inferWeightUnit(exerciseDefinition);
          const exercise: WorkoutExercise = {
            id: generateId(),
            exerciseDefinitionId: exerciseDefinition?.id,
            trackingMode,
            name: exerciseDefinition?.name || "",
            restSeconds: 90,
            notes: "",
            sets: createEmptySetsFromTemplates(
              [{ type: "working" }, { type: "working" }, { type: "working" }],
              trackingMode,
            ),
            weightUnit,
            muscles: exerciseDefinition?.muscles || [],
          };
          withActive((session, state) => {
            session.exercises.push(exercise);
            state.activeExerciseId = exercise.id;
          });
        },

        reorderExercises: (exerciseIds) =>
          withActive((session) => {
            const byId = new Map(session.exercises.map((e) => [e.id, e]));
            const reordered = exerciseIds
              .map((id) => byId.get(id))
              .filter((e): e is WorkoutExercise => !!e);
            if (reordered.length === session.exercises.length) session.exercises = reordered;
          }),

        removeExercise: (exerciseId) =>
          withActive((session, state) => {
            session.exercises = session.exercises.filter((e) => e.id !== exerciseId);
            if (state.activeExerciseId === exerciseId)
              state.activeExerciseId = session.exercises[0]?.id ?? null;
          }),

        selectExerciseDefinition: (exerciseId, definition) => {
          const weightUnit = inferWeightUnit(definition);
          const trackingMode = inferTrackingMode(definition);
          withExercise(exerciseId, (ex, state) => {
            ex.exerciseDefinitionId = definition.id;
            ex.name = definition.name;
            ex.muscles = [...definition.muscles];
            ex.weightUnit = weightUnit;
            ex.trackingMode = trackingMode;
            ex.sets = ex.sets.map((s) => normalizeSetForTrackingMode(s, trackingMode));
            if (state.activeRestTimer?.exerciseId === exerciseId)
              state.activeRestTimer.exerciseName = definition.name;
          });
        },

        updateExerciseField: (exerciseId, field, value) => {
          const before = get().activeSession?.exercises.find((e) => e.id === exerciseId);
          const oldRestSeconds = field === "restSeconds" ? (before?.restSeconds ?? null) : null;
          const next =
            field === "exerciseDefinitionId" && typeof value === "string"
              ? value.trim()
              : field === "trackingMode"
                ? normalizeTrackingMode(value)
                : value;

          withExercise(exerciseId, (ex, state) => {
            switch (field) {
              case "trackingMode": {
                const mode = next as WorkoutExercise["trackingMode"];
                ex.trackingMode = mode;
                ex.sets = ex.sets.map((s) => normalizeSetForTrackingMode(s, mode));
                break;
              }
              case "muscles":
                ex.muscles = next as MuscleGroup[];
                if (ex.exerciseDefinitionId?.startsWith("custom-")) {
                  useExerciseLibraryStore
                    .getState()
                    .updateCustomExerciseMuscles(ex.exerciseDefinitionId, ex.muscles);
                }
                break;
              case "name":
                ex.name = next as string;
                if (state.activeRestTimer?.exerciseId === exerciseId)
                  state.activeRestTimer.exerciseName = ex.name;
                break;
              default:
                (ex as unknown as Record<string, unknown>)[field] = next;
            }
          });

          const timer = get().activeRestTimer;
          if (timer?.exerciseId !== exerciseId) return;

          if (field === "name") {
            void updateRestTimerLiveActivity(
              buildActiveRestTimerLiveActivityProps(get().activeSession, timer),
            );
          }
          if (
            field === "restSeconds" &&
            typeof oldRestSeconds === "number" &&
            typeof next === "number"
          ) {
            // Shift the running timer by the change in rest length.
            const remaining =
              Math.ceil((timer.endTime - Date.now()) / 1000) + (next - oldRestSeconds);
            if (remaining <= 0) void get().cancelRestTimer();
            else
              void get().startRestTimer(exerciseId, remaining, before?.name || timer.exerciseName);
          }
        },

        toggleExerciseUnit: (exerciseId) =>
          withExercise(exerciseId, (ex) => {
            ex.weightUnit = ex.weightUnit === "lbs" ? "kg" : "lbs";
          }),

        toggleExerciseBodyweight: (exerciseId) =>
          withExercise(exerciseId, (ex) => {
            ex.isBodyweight = !ex.isBodyweight;
          }),

        // ── Set mutations ──

        addSet: (exerciseId) =>
          withExercise(exerciseId, (ex) => {
            ex.sets.push(createEmptySet(ex.trackingMode));
          }),

        removeSet: (exerciseId, setId) =>
          withExercise(exerciseId, (ex) => {
            ex.sets = ex.sets.filter((s) => s.id !== setId);
          }),

        updateSet: (exerciseId, setId, field, value) =>
          withExercise(exerciseId, (ex) => {
            const s = ex.sets.find((x) => x.id === setId);
            if (s) s[field] = value;
          }),

        updateHistorySet: (sessionId, exerciseId, setId, field, value) => {
          if (!workoutRepo.updateSet(sessionId, exerciseId, setId, field, value)) return;
          set((state) => addUnique(state.dirtyWorkoutIds, sessionId));
        },

        toggleSetCompletion: (exerciseId, setId) =>
          withExercise(exerciseId, (ex) => {
            const s = ex.sets.find((x) => x.id === setId);
            if (s) s.completedAt = s.completedAt ? undefined : new Date().toISOString();
          }),

        toggleSetType: (exerciseId, setId) =>
          withExercise(exerciseId, (ex) => {
            const s = ex.sets.find((x) => x.id === setId);
            if (s) s.type = NEXT_SET_TYPE[s.type ?? "working"];
          }),

        // ── Rest timer ──

        startRestTimer: async (exerciseId, restSeconds, exerciseName) => {
          const current = get().activeRestTimer;
          if (current) {
            const props = buildActiveRestTimerLiveActivityProps(get().activeSession, current);
            bankRestTime(current, Date.now());
            await cancelScheduledNotification(current.notificationId);
            void endRestTimerLiveActivity(props);
          }

          const now = Date.now();
          const endTime = now + restSeconds * 1000;
          const notificationId = await scheduleRestCompleteNotification(exerciseName, restSeconds);
          set((state) => {
            state.activeRestTimer = {
              endTime,
              startTime: now,
              exerciseId,
              exerciseName,
              notificationId,
            };
          });
          void startRestTimerLiveActivity(
            buildRestTimerLiveActivityProps(
              get().activeSession,
              exerciseName,
              now,
              endTime,
              restSeconds,
            ),
          );
        },

        cancelRestTimer: async () => {
          const current = get().activeRestTimer;
          if (!current) return;
          const props = buildActiveRestTimerLiveActivityProps(get().activeSession, current);
          bankRestTime(current, Date.now());
          await cancelScheduledNotification(current.notificationId);
          void endRestTimerLiveActivity(props);
        },

        clearExpiredTimer: () => {
          const timer = get().activeRestTimer;
          if (!timer || timer.endTime > Date.now()) return;
          const props = buildActiveRestTimerLiveActivityProps(get().activeSession, timer);
          bankRestTime(timer, timer.endTime);
          void endRestTimerLiveActivity(props);
        },

        // ── Stats ──

        togglePinExercise: (identityKey) => {
          const key = normalizeExerciseIdentityKey(identityKey);
          if (!key) return;
          set((state) => {
            state.pinnedExerciseNames = state.pinnedExerciseNames.includes(key)
              ? state.pinnedExerciseNames.filter((n) => n !== key)
              : [...state.pinnedExerciseNames, key];
          });
        },

        // ── Exercise-definition propagation ──

        updateMusclesInHistory: (exerciseIdentityKey, muscles) => {
          const key = normalizeExerciseIdentityKey(exerciseIdentityKey);
          if (!key) return;
          // Custom ids ("custom-<id>") are read off the raw exerciseDefinitionId: the
          // normalized key strips the hyphen, so it can never match the prefix itself.
          const customIds = new Set<string>();
          propagateExerciseEdit(set, (ex) => {
            if (getExerciseIdentityKey(ex) !== key) return false;
            ex.muscles = [...muscles];
            if (ex.exerciseDefinitionId?.startsWith("custom-"))
              customIds.add(ex.exerciseDefinitionId);
            return true;
          });
          customIds.forEach((id) =>
            useExerciseLibraryStore.getState().updateCustomExerciseMuscles(id, muscles),
          );
        },

        renameExerciseDefinitionReferences: (exerciseDefinitionId, nextName) => {
          const defId = String(exerciseDefinitionId).trim();
          const name = String(nextName).trim();
          if (!defId || !name) return;
          propagateExerciseEdit(set, (ex) => {
            if (ex.exerciseDefinitionId !== defId || ex.name === name) return false;
            ex.name = name;
            return true;
          });
          set((state) => {
            const timer = state.activeRestTimer;
            const timerEx =
              timer && state.activeSession?.exercises.find((ex) => ex.id === timer.exerciseId);
            if (timer && timerEx?.exerciseDefinitionId === defId) timer.exerciseName = name;
          });
        },

        removeExerciseDefinitionReferences: (exerciseDefinitionId) => {
          const defId = String(exerciseDefinitionId).trim();
          if (!defId) return;
          propagateExerciseEdit(set, (ex) => {
            if (ex.exerciseDefinitionId !== defId) return false;
            ex.exerciseDefinitionId = "";
            return true;
          });
        },

        // ── Backup bookkeeping ──

        importWorkouts: (sessions, markDirty) => {
          const completed = sessions.filter((s) => !!s.completedAt);
          workoutRepo.upsertMany(completed);
          if (!markDirty) return;
          set((state) => completed.forEach((s) => addUnique(state.dirtyWorkoutIds, s._id)));
        },

        clearDeletedWorkouts: (ids) =>
          set((state) => {
            state.deletedWorkoutIds = state.deletedWorkoutIds.filter((id) => !ids.includes(id));
          }),

        clearDirtyWorkouts: (ids, pushedAt) => {
          if (ids.length === 0) return;
          const updatedAt = workoutRepo.updatedAtOf(ids);
          set((state) => {
            state.dirtyWorkoutIds = state.dirtyWorkoutIds.filter(
              (id) => !ids.includes(id) || (updatedAt.get(id) ?? 0) > pushedAt,
            );
          });
        },
      };
    }),
    {
      name: "workout-session-store",
      storage: createJSONStorage(() => zustandAsyncStorage),
      version: STORE_VERSION,
      // v6 moved completed sessions out of this store into SQLite; the migration
      // in src/db/migrateFromAsyncStorage.ts imports the old shards on startup.
      migrate: (persisted) =>
        normalizePersistedState(persisted as Partial<WorkoutSessionState> | undefined),
      partialize: (state) => ({
        activeSession: state.activeSession,
        activeRestTimer: state.activeRestTimer,
        pinnedExerciseNames: state.pinnedExerciseNames,
        activeExerciseId: state.activeExerciseId,
        dirtyWorkoutIds: state.dirtyWorkoutIds,
        deletedWorkoutIds: state.deletedWorkoutIds,
      }),
    },
  ),
);
