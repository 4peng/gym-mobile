import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { zustandAsyncStorage } from "@/storage/mmkv";
import { workoutStorage } from "@/storage/workoutStorage";
import { workoutStatsStorage } from "@/storage/workoutStatsStorage";
import { USER_ID } from "@/constants/user";
import { generateId } from "@/utils/id";
import { MuscleGroup } from "@/constants/muscles";
import { safeClone } from "@/utils/clone";
import type {
  ExerciseDefinition,
  Program,
  WorkoutSession,
  WorkoutExercise,
  WorkoutSet,
} from "@/types";
import {
  getExerciseIdentityKey,
  normalizeExerciseIdentityKey,
} from "@/utils/exerciseIdentity";
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

// ──────────────────────────────────────────────
// Constants for Optimization
// ──────────────────────────────────────────────
const MAX_MEMORY_HISTORY = 15; // Limit in-memory history cache size
const WORKOUT_SESSION_STORE_VERSION = 5;

// ──────────────────────────────────────────────
// Rest timer type
// ──────────────────────────────────────────────

export interface ActiveRestTimer {
  /** Absolute epoch-ms when the rest period ends. */
  endTime: number;
  /** Absolute epoch-ms when the rest period started. */
  startTime: number;
  /** The exercise that triggered this rest. */
  exerciseId: string;
  /** Human-readable name, shown in the floating UI. */
  exerciseName: string;
  /** Notification identifier returned by expo-notifications. */
  notificationId: string;
}

// ──────────────────────────────────────────────
// State shape
// ──────────────────────────────────────────────

interface WorkoutSessionState {
  /** Currently active (in-progress) session, if any. */
  activeSession: WorkoutSession | null;
  /** 
   * Recent cached sessions for immediate UI.
   * Stored in persistent main store but limited in size.
   */
  history: WorkoutSession[];
  /** 
   * Full index of all workout IDs available locally.
   * Essential for lazy loading sharded workouts.
   */
  historyIndex: string[];
  /** IDs of sessions deleted locally but not yet synced to the server. */
  deletedWorkoutIds: string[];
  /** IDs of completed sessions changed locally and pending upload. */
  dirtyWorkoutIds: string[];
  /** Whether there are more sessions to fetch from the server. */
  hasMoreHistory: boolean;
  /** Background-safe rest timer (persisted via MMKV). */
  activeRestTimer: ActiveRestTimer | null;
  /** List of exercise names pinned on the insights page. */
  pinnedExerciseNames: string[];
  /** Currently focused exercise ID for the single-exercise view. */
  activeExerciseId: string | null;
  /** True when completed workouts have un-synced changes. */
  isDirty: boolean;
  /** Epoch-ms of the last successful sync. */
  lastSyncedAt: number | null;
}

interface WorkoutSessionActions {
  // ── Session lifecycle ──────────────────────
  startQuickSession: () => void;
  startFromProgram: (program: Program) => void;
  updateWorkoutNotes: (notes: string) => void;
  completeSession: () => void;
  discardSession: () => void;
  deleteHistorySession: (sessionId: string) => void;
  updateSessionDate: (sessionId: string, newDate: string) => void;

  // ── Exercise mutations ─────────────────────
  setActiveExerciseId: (id: string | null) => void;
  addExercise: (exerciseDefinition?: ExerciseDefinition | null) => void;
  reorderExercises: (exerciseIds: string[]) => void;
  removeExercise: (exerciseId: string) => void;
  selectExerciseDefinition: (exerciseId: string, exerciseDefinition: ExerciseDefinition) => void;
  updateExerciseField: <F extends UpdatableExerciseField>(
    exerciseId: string,
    field: F,
    value: ExerciseFieldValue<F>
  ) => void;
  toggleExerciseUnit: (exerciseId: string) => void;
  toggleExerciseBodyweight: (exerciseId: string) => void;

  // ── Set mutations ──────────────────────────
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  updateSet: (
    exerciseId: string,
    setId: string,
    field: keyof Pick<WorkoutSet, "weight" | "reps" | "durationSeconds" | "distance">,
    value: number | null
  ) => void;
  updateHistorySet: (
    sessionId: string,
    exerciseId: string,
    setId: string,
    field: keyof Pick<WorkoutSet, "weight" | "reps" | "durationSeconds" | "distance">,
    value: number | null
  ) => void;
  toggleSetCompletion: (exerciseId: string, setId: string) => void;
  toggleSetType: (exerciseId: string, setId: string) => void;

  // ── Queries ────────────────────────────────
  fetchMoreHistory: () => Promise<void>;

  // ── Rest timer ─────────────────────────────
  startRestTimer: (
    exerciseId: string,
    restSeconds: number,
    exerciseName: string
  ) => Promise<void>;
  cancelRestTimer: () => Promise<void>;
  clearExpiredTimer: () => void;

  // ── Stats ──────────────────────────────────
  togglePinExercise: (identityKey: string) => void;

  // ── Sync metadata ─────────────────────────
  clearDeletedWorkouts: (ids: string[]) => void;
  clearDirtyWorkouts: (ids: string[]) => void;
  updateMusclesInHistory: (exerciseIdentityKey: string, muscles: MuscleGroup[]) => void;
  renameExerciseDefinitionReferences: (exerciseDefinitionId: string, nextName: string) => void;
  removeExerciseDefinitionReferences: (exerciseDefinitionId: string) => void;

  /**
   * Applies remote data using last-write-wins against the current state.
   * Resolves race conditions by merging inside the state lock.
   */
  applySyncMerge: (remote: WorkoutSession[], syncStartTime: number) => void;

  /**
   * Append workouts fetched from backend that are not present locally.
   */
  mergeRemoteWorkouts: (remote: WorkoutSession[]) => void;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function createEmptySet(
  trackingMode: WorkoutExercise["trackingMode"] = "strength",
  initialWeight: number | null = null,
  type: WorkoutSet["type"] = "working"
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
    initialWeight
  );
}

function createEmptySetsFromTemplates(
  templates: { type: WorkoutSet["type"] }[],
  trackingMode: WorkoutExercise["trackingMode"] = "strength",
  initialWeight: number | null = null
): WorkoutSet[] {
  return templates.map((t) => createEmptySet(trackingMode, initialWeight, t.type));
}

function nextLocalUpdatedAt(lastSyncedAt: number | null): number {
  const now = Date.now();
  return typeof lastSyncedAt === "number" ? Math.max(now, lastSyncedAt + 1) : now;
}

// ──────────────────────────────────────────────
// updateExerciseField value typing
// ──────────────────────────────────────────────

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
          : string; // "name" | "exerciseDefinitionId" | "notes"

// ──────────────────────────────────────────────
// Shared history-sort / shard-rewrite helpers
// ──────────────────────────────────────────────

/** Sorts sessions newest-first by completion date (undated sessions sort last). */
function byCompletedAtDesc(a: WorkoutSession, b: WorkoutSession): number {
  const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
  const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
  return bTime - aTime;
}

/**
 * Loads sessions that only exist as on-disk shards (not in the in-RAM cache),
 * applies `mutateExercise` to every exercise, and persists the ones that changed.
 * Returns the sessions that were actually rewritten.
 */
async function rewriteShardOnlySessions(
  shardOnlyIds: string[],
  updatedAt: number,
  mutateExercise: (exercise: WorkoutExercise) => boolean
): Promise<WorkoutSession[]> {
  if (shardOnlyIds.length === 0) return [];

  const shardSessions = await workoutStorage.getBatch(shardOnlyIds);
  const changedShardSessions = shardSessions
    .map((session) => {
      let sessionChanged = false;
      const nextSession = safeClone(session);

      nextSession.exercises.forEach((exercise) => {
        if (mutateExercise(exercise)) sessionChanged = true;
      });

      if (!sessionChanged) return null;

      nextSession.updatedAt = updatedAt;
      return nextSession;
    })
    .filter((session): session is WorkoutSession => session !== null);

  if (changedShardSessions.length > 0) {
    await workoutStorage.saveBatch(changedShardSessions);
  }

  return changedShardSessions;
}

/** Marks freshly-rewritten shard sessions dirty and nudges the history reference. */
function markShardRewriteDirty(
  state: Pick<WorkoutSessionState, "dirtyWorkoutIds" | "isDirty" | "history">,
  sessions: WorkoutSession[]
): void {
  sessions.forEach((session) => {
    if (!state.dirtyWorkoutIds.includes(session._id)) {
      state.dirtyWorkoutIds.push(session._id);
    }
  });
  state.isDirty = true;
  state.history = [...state.history];
}

function hasCompletedSets(exercise: WorkoutExercise): boolean {
  return exercise.sets.some((set) => !!set.completedAt);
}

function inferTrackingMode(
  exercise: ExerciseDefinition | WorkoutExercise | null,
  history: WorkoutSession[]
): WorkoutExercise["trackingMode"] {
  const defaultMode = inferTrackingModeFromExerciseDefinition(exercise);
  if (!exercise) return defaultMode;

  const identityKey = getExerciseIdentityKey(exercise);
  if (!identityKey) return defaultMode;

  // Search history for the most recent occurrence of this exercise
  for (const session of history) {
    if (!session.completedAt) continue;
    const match = session.exercises.find((ex) => getExerciseIdentityKey(ex) === identityKey);
    if (match?.trackingMode) {
      return match.trackingMode;
    }
  }

  return defaultMode;
}

function inferWeightUnit(
  exercise: ExerciseDefinition | WorkoutExercise | null,
  history: WorkoutSession[]
): "kg" | "lbs" {
  const globalPreferred = useUiPreferencesStore.getState().preferredWeightUnit || "kg";
  if (!exercise) return globalPreferred;

  const identityKey = getExerciseIdentityKey(exercise);
  if (!identityKey) return globalPreferred;

  // Search history for the most recent occurrence of this exercise
  for (const session of history) {
    if (!session.completedAt) continue;
    const match = session.exercises.find((ex) => getExerciseIdentityKey(ex) === identityKey);
    if (match?.weightUnit) {
      return match.weightUnit;
    }
  }

  return globalPreferred;
}

function buildCompletedSession(session: WorkoutSession): WorkoutSession {
  return {
    ...session,
    exercises: session.exercises
      .map((exercise) => ({
        ...exercise,
        sets: exercise.sets.filter((set) => !!set.completedAt),
      }))
      .filter((exercise) => exercise.sets.length > 0),
  };
}

function normalizePersistedWorkoutSession(raw: any): WorkoutSession | null {
  if (!raw || typeof raw !== "object") return null;
  const id = raw._id ? String(raw._id) : null;
  if (!id) return null;

  const exercises = Array.isArray(raw.exercises)
    ? raw.exercises.map((ex: any) => ({
        id: ex?.id ? String(ex.id) : generateId(),
        programExerciseId:
          typeof ex?.programExerciseId === "string" ? ex.programExerciseId : undefined,
        exerciseDefinitionId:
          typeof ex?.exerciseDefinitionId === "string" ? ex.exerciseDefinitionId : undefined,
        trackingMode: normalizeTrackingMode(ex?.trackingMode),
        name: typeof ex?.name === "string" ? ex.name : "",
        restSeconds:
          typeof ex?.restSeconds === "number" && Number.isFinite(ex.restSeconds)
            ? ex.restSeconds
            : 90,
        notes: typeof ex?.notes === "string" ? ex.notes : "",
        sets: Array.isArray(ex?.sets)
          ? ex.sets.map((s: any) => ({
              id: s?.id ? String(s.id) : generateId(),
              weight:
                typeof s?.weight === "number" && Number.isFinite(s.weight)
                  ? s.weight
                  : s?.weight == null
                    ? null
                    : null,
              reps:
                typeof s?.reps === "number" && Number.isFinite(s.reps)
                  ? s.reps
                  : s?.reps == null
                    ? null
                    : null,
              durationSeconds:
                typeof s?.durationSeconds === "number" && Number.isFinite(s.durationSeconds)
                  ? s.durationSeconds
                  : s?.durationSeconds == null
                    ? null
                    : null,
              distance:
                typeof s?.distance === "number" && Number.isFinite(s.distance)
                  ? s.distance
                  : s?.distance == null
                    ? null
                    : null,
              completedAt: typeof s?.completedAt === "string" ? s.completedAt : undefined,
            })).map((set: WorkoutSet) => normalizeSetForTrackingMode(set, normalizeTrackingMode(ex?.trackingMode)))
          : [],
        weightUnit: ex?.weightUnit === "lbs" ? "lbs" : "kg",
        muscles: Array.isArray(ex?.muscles) ? ex.muscles : [],
        isBodyweight: typeof ex?.isBodyweight === "boolean" ? ex.isBodyweight : false,
        timerStartedAt:
          typeof ex?.timerStartedAt === "string" ? ex.timerStartedAt : undefined,
      }))
    : [];

  return {
    _id: id,
    userId: typeof raw.userId === "string" ? raw.userId : USER_ID,
    programId: raw.programId ? String(raw.programId) : undefined,
    startedAt:
      typeof raw.startedAt === "string" ? raw.startedAt : new Date().toISOString(),
    completedAt: typeof raw.completedAt === "string" ? raw.completedAt : undefined,
    updatedAt:
      typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt)
        ? raw.updatedAt
        : Date.now(),
    deletedAt:
      typeof raw.deletedAt === "number" || raw.deletedAt === null
        ? raw.deletedAt
        : undefined,
    notes: typeof raw.notes === "string" ? raw.notes : "",
    exercises,
    cumulativeRestSeconds:
      typeof raw.cumulativeRestSeconds === "number" && Number.isFinite(raw.cumulativeRestSeconds)
        ? raw.cumulativeRestSeconds
        : 0,
  };
}

function normalizePersistedWorkoutState(
  state: Partial<WorkoutSessionState> | undefined
): Omit<WorkoutSessionState, "activeSession"> & { activeSession: WorkoutSession | null } {
  const history = Array.isArray(state?.history)
    ? state!.history
        .map(normalizePersistedWorkoutSession)
        .filter((s): s is WorkoutSession => s !== null)
    : [];

  const activeSession = normalizePersistedWorkoutSession(state?.activeSession as any);
  const historyIndex = Array.isArray(state?.historyIndex)
    ? state!.historyIndex.map((id) => String(id))
    : history.map((h) => h._id);

  const dedupedHistoryIndex = Array.from(new Set(historyIndex));

  let activeExerciseId = typeof state?.activeExerciseId === "string" ? state.activeExerciseId : null;

  // Fallback: If there's an active session but no focused exercise ID, default to the first exercise
  if (!activeExerciseId && activeSession && activeSession.exercises.length > 0) {
    activeExerciseId = activeSession.exercises[0].id;
  }

  return {
    activeSession,
    history,
    historyIndex: dedupedHistoryIndex,
    deletedWorkoutIds: Array.isArray(state?.deletedWorkoutIds)
      ? state!.deletedWorkoutIds.map((id) => String(id))
      : [],
    dirtyWorkoutIds: Array.isArray(state?.dirtyWorkoutIds)
      ? state!.dirtyWorkoutIds.map((id) => String(id))
      : [],
    hasMoreHistory: typeof state?.hasMoreHistory === "boolean" ? state.hasMoreHistory : true,
    activeRestTimer:
      state?.activeRestTimer &&
      typeof state.activeRestTimer.endTime === "number" &&
      typeof state.activeRestTimer.startTime === "number" &&
      typeof state.activeRestTimer.exerciseId === "string" &&
      typeof state.activeRestTimer.exerciseName === "string" &&
      typeof state.activeRestTimer.notificationId === "string"
        ? state.activeRestTimer
        : null,
    pinnedExerciseNames: Array.isArray(state?.pinnedExerciseNames)
      ? state!.pinnedExerciseNames.map((name) => String(name).toLowerCase())
      : [],
    activeExerciseId,
    isDirty: !!state?.isDirty,
    lastSyncedAt:
      typeof state?.lastSyncedAt === "number" && Number.isFinite(state.lastSyncedAt)
        ? state.lastSyncedAt
        : null,
  };
}

// ──────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────

export const useWorkoutSessionStore = create<
  WorkoutSessionState & WorkoutSessionActions
>()(
  persist(
    immer((set, get) => ({
      activeSession: null,
      history: [],
      historyIndex: [],
      deletedWorkoutIds: [],
      dirtyWorkoutIds: [],
      hasMoreHistory: true,
      activeRestTimer: null,
      pinnedExerciseNames: [],
      activeExerciseId: null,
      isDirty: false,
      lastSyncedAt: null,

      // ── Session lifecycle ────────────────────

      startQuickSession: () => {
        const session: WorkoutSession = {
          _id: generateId(),
          userId: USER_ID,
          startedAt: new Date().toISOString(),
          updatedAt: Date.now(),
          notes: "",
          exercises: [],
          cumulativeRestSeconds: 0,
        };
        set((state) => {
          state.activeSession = session;
          state.activeExerciseId = null;
        });
      },

      startFromProgram: (program) => {
        // Deep-copy program exercises into an independent session.
        const exercises: WorkoutExercise[] = (program.exercises || []).map((pe) => ({
          id: generateId(),
          programExerciseId: pe.id,
          exerciseDefinitionId: pe.exerciseDefinitionId,
          trackingMode: normalizeTrackingMode(pe.trackingMode),
          name: pe.name,
          restSeconds: pe.restSeconds,
          notes: pe.notes,
          sets: createEmptySetsFromTemplates(
            pe.defaultSets,
            normalizeTrackingMode(pe.trackingMode),
            pe.initialWeight ?? null
          ),
          weightUnit: pe.weightUnit || "kg",
          muscles: pe.muscles || [],
        }));

        const session: WorkoutSession = {
          _id: generateId(),
          userId: USER_ID,
          programId: program._id,
          startedAt: new Date().toISOString(),
          updatedAt: Date.now(),
          notes: "",
          exercises,
          cumulativeRestSeconds: 0,
        };
        set((state) => {
          state.activeSession = session;
          state.activeExerciseId = exercises.length > 0 ? exercises[0].id : null;
        });
      },

      updateWorkoutNotes: (notes) => {
        set((state) => {
          if (!state.activeSession) return;
          state.activeSession.notes = notes;
          state.activeSession.updatedAt = nextLocalUpdatedAt(state.lastSyncedAt);
        });
      },

      completeSession: () => {
        // Cancel any active rest timer when session ends.
        const timer = get().activeRestTimer;
        if (timer) {
          cancelScheduledNotification(timer.notificationId);
          void endRestTimerLiveActivity(
            buildActiveRestTimerLiveActivityProps(get().activeSession, timer)
          );
        }

        const session = get().activeSession;
        if (!session) return;

        const completedAt = new Date().toISOString();
        const updatedAt = nextLocalUpdatedAt(get().lastSyncedAt);
        const finalSession = {
          ...buildCompletedSession(session),
          completedAt,
          updatedAt,
        };

        // Shard the full session to dedicated storage (Async, performance win)
        workoutStorage.save(finalSession);
        void workoutStatsStorage.upsertSession(finalSession);

        set((state) => {
          // Add to index and recent history cache
          if (!state.historyIndex.includes(finalSession._id)) {
            state.historyIndex.unshift(finalSession._id);
          }
          
          state.history.unshift(safeClone(finalSession));
          
          // Partial Persistence: Truncate in-memory history cache
          if (state.history.length > MAX_MEMORY_HISTORY) {
            state.history = state.history.slice(0, MAX_MEMORY_HISTORY);
          }

          state.activeSession = null;
          state.activeRestTimer = null;
          state.activeExerciseId = null;
          if (!state.dirtyWorkoutIds.includes(finalSession._id)) {
            state.dirtyWorkoutIds.push(finalSession._id);
          }
          state.isDirty = true;
        });
      },

      discardSession: () => {
        // Cancel any active rest timer when session is discarded.
        const timer = get().activeRestTimer;
        if (timer) {
          cancelScheduledNotification(timer.notificationId);
          void endRestTimerLiveActivity(
            buildActiveRestTimerLiveActivityProps(get().activeSession, timer)
          );
        }

        set((state) => {
          state.activeSession = null;
          state.activeRestTimer = null;
          state.activeExerciseId = null;
        });
      },

      deleteHistorySession: (sessionId) => {
        // Remove from sharded storage
        workoutStorage.remove(sessionId);
        void workoutStatsStorage.removeSessions([sessionId]);

        set((state) => {
          const workout = state.history.find(s => s._id === sessionId);
          if (workout) {
            workout.deletedAt = Date.now();
            workout.updatedAt = nextLocalUpdatedAt(state.lastSyncedAt);
          }
          
          state.historyIndex = state.historyIndex.filter(id => id !== sessionId);
          
          if (!state.deletedWorkoutIds.includes(sessionId)) {
            state.deletedWorkoutIds.push(sessionId);
          }
          state.dirtyWorkoutIds = state.dirtyWorkoutIds.filter((id) => id !== sessionId);
          state.isDirty = true;
        });
      },

      updateSessionDate: (sessionId, newDate) => {
        const isLoaded = get().history.some((s) => s._id === sessionId);

        if (isLoaded) {
          let updatedSession: WorkoutSession | null = null;
          set((state) => {
            const session = state.history.find(s => s._id === sessionId);
            if (session) {
              session.completedAt = newDate;
              session.updatedAt = nextLocalUpdatedAt(state.lastSyncedAt);
              state.isDirty = true;

              // Re-sort history by completedAt date
              state.history.sort(byCompletedAtDesc);

              updatedSession = safeClone(session);
              if (!state.dirtyWorkoutIds.includes(sessionId)) {
                state.dirtyWorkoutIds.push(sessionId);
              }
            }
          });

          if (updatedSession) {
            workoutStorage.save(updatedSession);
            void workoutStatsStorage.upsertSession(updatedSession);
          }
          return;
        }

        // Not paged into RAM — the session only exists as an on-disk shard.
        void (async () => {
          const session = await workoutStorage.get(sessionId);
          if (!session) return;

          session.completedAt = newDate;
          session.updatedAt = nextLocalUpdatedAt(get().lastSyncedAt);

          await workoutStorage.save(session);
          void workoutStatsStorage.upsertSession(session);

          set((state) => {
            if (!state.dirtyWorkoutIds.includes(sessionId)) {
              state.dirtyWorkoutIds.push(sessionId);
            }
            state.isDirty = true;

            // Keep the RAM copy in sync if it got paged in while we awaited.
            const cached = state.history.find((s) => s._id === sessionId);
            if (cached) {
              cached.completedAt = newDate;
              cached.updatedAt = session.updatedAt;
              state.history.sort(byCompletedAtDesc);
            }
          });
        })();
      },

      setActiveExerciseId: (id) => {
        set((state) => {
          state.activeExerciseId = id;
        });
      },

      addExercise: (exerciseDefinition = null) => {
        set((state) => {
          if (!state.activeSession) return;
          const trackingMode = inferTrackingMode(exerciseDefinition, state.history);
          const weightUnit = inferWeightUnit(exerciseDefinition, state.history);
          
          // Use shared default sets structure
          const defaultSetsTemplates: { type: WorkoutSet["type"] }[] = [
            { type: "working" },
            { type: "working" },
            { type: "working" },
          ];

          const exercise: WorkoutExercise = {
            id: generateId(),
            exerciseDefinitionId: exerciseDefinition?.id,
            trackingMode,
            name: exerciseDefinition?.name || "",
            restSeconds: 90,
            notes: "",
            sets: createEmptySetsFromTemplates(defaultSetsTemplates, trackingMode),
            weightUnit,
            muscles: exerciseDefinition?.muscles || [],
          };
          state.activeSession.exercises.push(exercise);
          state.activeExerciseId = exercise.id; // Auto-focus new exercise
          state.activeSession.updatedAt = nextLocalUpdatedAt(state.lastSyncedAt);
        });
      },

      reorderExercises: (exerciseIds) => {
        set((state) => {
          if (!state.activeSession) return;
          const byId = new Map(
            state.activeSession.exercises.map((exercise) => [exercise.id, exercise])
          );
          const reordered = exerciseIds
            .map((id) => byId.get(id))
            .filter((exercise): exercise is WorkoutExercise => !!exercise);
          if (reordered.length !== state.activeSession.exercises.length) return;
          state.activeSession.exercises = reordered;
          state.activeSession.updatedAt = nextLocalUpdatedAt(state.lastSyncedAt);
        });
      },

      removeExercise: (exerciseId) => {
        set((state) => {
          if (!state.activeSession) return;
          state.activeSession.exercises =
            state.activeSession.exercises.filter((e) => e.id !== exerciseId);
          
          if (state.activeExerciseId === exerciseId) {
            state.activeExerciseId = state.activeSession.exercises.length > 0 
              ? state.activeSession.exercises[0].id 
              : null;
          }
          
          state.activeSession.updatedAt = nextLocalUpdatedAt(state.lastSyncedAt);
        });
      },

      selectExerciseDefinition: (exerciseId, exerciseDefinition) => {
        set((state) => {
          if (!state.activeSession) return;
          const ex = state.activeSession.exercises.find((exercise) => exercise.id === exerciseId);
          if (!ex) return;

          const weightUnit = inferWeightUnit(exerciseDefinition, state.history);
          const trackingMode = inferTrackingMode(exerciseDefinition, state.history);

          ex.exerciseDefinitionId = exerciseDefinition.id;
          ex.name = exerciseDefinition.name;
          ex.muscles = [...exerciseDefinition.muscles];
          ex.weightUnit = weightUnit;
          ex.trackingMode = trackingMode;
          ex.sets = ex.sets.map((set) => normalizeSetForTrackingMode(set, trackingMode));
          state.activeSession.updatedAt = nextLocalUpdatedAt(state.lastSyncedAt);

          if (state.activeRestTimer?.exerciseId === exerciseId) {
            state.activeRestTimer.exerciseName = exerciseDefinition.name;
          }
        });
      },

      updateExerciseField: (exerciseId, field, value) => {
        const currentExercise = get().activeSession?.exercises.find((e) => e.id === exerciseId);
        const oldRestSeconds = field === "restSeconds" ? currentExercise?.restSeconds ?? null : null;
        const normalizedValue =
          field === "exerciseDefinitionId" && typeof value === "string"
            ? value.trim()
            : field === "trackingMode"
              ? normalizeTrackingMode(value)
              : value;

        set((state) => {
          if (!state.activeSession) return;
          const ex = state.activeSession.exercises.find(
            (e) => e.id === exerciseId
          );
          if (!ex) return;
          if (field === "restSeconds") {
            ex.restSeconds = normalizedValue as number;
          } else if (field === "exerciseDefinitionId") {
            ex.exerciseDefinitionId = normalizedValue as string;
          } else if (field === "trackingMode") {
            const nextTrackingMode = normalizedValue as WorkoutExercise["trackingMode"];
            ex.trackingMode = nextTrackingMode;
            ex.sets = ex.sets.map((set) => normalizeSetForTrackingMode(set, nextTrackingMode));
          } else if (field === "weightUnit") {
            ex.weightUnit = normalizedValue as "kg" | "lbs";
          } else if (field === "muscles") {
            ex.muscles = normalizedValue as MuscleGroup[];
            if (typeof ex.exerciseDefinitionId === "string" && ex.exerciseDefinitionId.startsWith("custom-")) {
              useExerciseLibraryStore
                .getState()
                .updateCustomExerciseMuscles(ex.exerciseDefinitionId, normalizedValue as MuscleGroup[]);
            }
          } else if (field === "name") {
            ex.name = normalizedValue as string;
          } else if (field === "notes") {
            ex.notes = normalizedValue as string;
          } else if (field === "isBodyweight") {
            ex.isBodyweight = normalizedValue as boolean;
          }
          state.activeSession.updatedAt = nextLocalUpdatedAt(state.lastSyncedAt);
          if (field === "name" && state.activeRestTimer?.exerciseId === exerciseId) {
            state.activeRestTimer.exerciseName = normalizedValue as string;
          }
        });

        if (field === "name") {
          const timer = get().activeRestTimer;
          if (timer?.exerciseId === exerciseId) {
            void updateRestTimerLiveActivity(
              buildActiveRestTimerLiveActivityProps(get().activeSession, timer)
            );
          }
        }

        if (
          field === "restSeconds" &&
          typeof oldRestSeconds === "number" &&
          Number.isFinite(oldRestSeconds) &&
          typeof normalizedValue === "number" &&
          Number.isFinite(normalizedValue)
        ) {
          const currentTimer = get().activeRestTimer;
          if (currentTimer?.exerciseId === exerciseId) {
            const nextRemainingSeconds =
              Math.ceil((currentTimer.endTime - Date.now()) / 1000) +
              (normalizedValue - oldRestSeconds);

            if (nextRemainingSeconds <= 0) {
              void get().cancelRestTimer();
            } else {
              void get().startRestTimer(
                exerciseId,
                nextRemainingSeconds,
                currentExercise?.name || currentTimer.exerciseName
              );
            }
          }
        }
      },

      toggleExerciseUnit: (exerciseId) => {
        set((state) => {
          if (!state.activeSession) return;
          const ex = state.activeSession.exercises.find(
            (e) => e.id === exerciseId
          );
          if (!ex) return;
          ex.weightUnit = ex.weightUnit === "lbs" ? "kg" : "lbs";
          state.activeSession.updatedAt = nextLocalUpdatedAt(state.lastSyncedAt);
        });
      },

      toggleExerciseBodyweight: (exerciseId) => {
        set((state) => {
          if (!state.activeSession) return;
          const ex = state.activeSession.exercises.find(
            (e) => e.id === exerciseId
          );
          if (!ex) return;
          ex.isBodyweight = !ex.isBodyweight;
          state.activeSession.updatedAt = nextLocalUpdatedAt(state.lastSyncedAt);
        });
      },

      // ── Set mutations ────────────────────────

      addSet: (exerciseId) => {
        set((state) => {
          if (!state.activeSession) return;
          const ex = state.activeSession.exercises.find(
            (e) => e.id === exerciseId
          );
          if (!ex) return;
          ex.sets.push(createEmptySet(ex.trackingMode));
          state.activeSession.updatedAt = nextLocalUpdatedAt(state.lastSyncedAt);
        });
      },

      removeSet: (exerciseId, setId) => {
        set((state) => {
          if (!state.activeSession) return;
          const ex = state.activeSession.exercises.find(
            (e) => e.id === exerciseId
          );
          if (!ex) return;
          ex.sets = ex.sets.filter((s) => s.id !== setId);
          state.activeSession.updatedAt = nextLocalUpdatedAt(state.lastSyncedAt);
        });
      },

      updateSet: (exerciseId, setId, field, value) => {
        set((state) => {
          if (!state.activeSession) return;
          const ex = state.activeSession.exercises.find(
            (e) => e.id === exerciseId
          );
          if (!ex) return;
          const s = ex.sets.find((s) => s.id === setId);
          if (!s) return;
          s[field] = value;
          state.activeSession.updatedAt = nextLocalUpdatedAt(state.lastSyncedAt);
        });
      },

      updateHistorySet: (sessionId, exerciseId, setId, field, value) => {
        const isLoaded = get().history.some((s) => s._id === sessionId);

        if (isLoaded) {
          let updatedSession: WorkoutSession | null = null;
          set((state) => {
            const session = state.history.find((s) => s._id === sessionId);
            if (!session) return;
            const ex = session.exercises.find((e) => e.id === exerciseId);
            if (!ex) return;
            const s = ex.sets.find((s) => s.id === setId);
            if (!s) return;
            s[field] = value;
            session.updatedAt = nextLocalUpdatedAt(state.lastSyncedAt);
            if (!state.dirtyWorkoutIds.includes(sessionId)) {
              state.dirtyWorkoutIds.push(sessionId);
            }
            state.isDirty = true;

            updatedSession = safeClone(session);
          });

          if (updatedSession) {
            workoutStorage.save(updatedSession);
            void workoutStatsStorage.upsertSession(updatedSession);
          }
          return;
        }

        // Not paged into RAM — mutate the on-disk shard directly.
        void (async () => {
          const session = await workoutStorage.get(sessionId);
          if (!session) return;
          const ex = session.exercises.find((e) => e.id === exerciseId);
          if (!ex) return;
          const s = ex.sets.find((s) => s.id === setId);
          if (!s) return;

          s[field] = value;
          session.updatedAt = nextLocalUpdatedAt(get().lastSyncedAt);

          await workoutStorage.save(session);
          void workoutStatsStorage.upsertSession(session);

          set((state) => {
            if (!state.dirtyWorkoutIds.includes(sessionId)) {
              state.dirtyWorkoutIds.push(sessionId);
            }
            state.isDirty = true;

            // Keep the RAM copy in sync if it got paged in while we awaited.
            const cached = state.history.find((s2) => s2._id === sessionId);
            const cachedEx = cached?.exercises.find((e) => e.id === exerciseId);
            const cachedSet = cachedEx?.sets.find((s2) => s2.id === setId);
            if (cached && cachedSet) {
              cachedSet[field] = value;
              cached.updatedAt = session.updatedAt;
            }
          });
        })();
      },

      toggleSetCompletion: (exerciseId, setId) => {
        set((state) => {
          if (!state.activeSession) return;
          const ex = state.activeSession.exercises.find(
            (e) => e.id === exerciseId
          );
          if (!ex) return;
          const s = ex.sets.find((s) => s.id === setId);
          if (!s) return;
          
          if (s.completedAt) {
            s.completedAt = undefined;
          } else {
            s.completedAt = new Date().toISOString();
          }
          state.activeSession.updatedAt = nextLocalUpdatedAt(state.lastSyncedAt);
        });
      },

      toggleSetType: (exerciseId, setId) => {
        set((state) => {
          if (!state.activeSession) return;
          const ex = state.activeSession.exercises.find(
            (e) => e.id === exerciseId
          );
          if (!ex) return;
          const s = ex.sets.find((s) => s.id === setId);
          if (!s) return;

          const currentType = s.type || "working";
          if (currentType === "working") {
            s.type = "warmup";
          } else if (currentType === "warmup") {
            s.type = "dropset";
          } else {
            s.type = "working";
          }
          state.activeSession.updatedAt = nextLocalUpdatedAt(state.lastSyncedAt);
        });
      },

      // ── Queries ──────────────────────────────

      /**
       * Lazy Loading Implementation:
       * 1. Check historyIndex for local IDs not currently in memory cache.
       * 2. If local shards found, load them first (very fast).
       * 3. If local exhausted, fetch from server.
       */
      fetchMoreHistory: async () => {
        const { history, historyIndex } = get();
        const loadedIds = new Set(history.map(h => h._id));
        
        // Find next IDs in index that aren't loaded
        const missingIds = historyIndex.filter(id => !loadedIds.has(id)).slice(0, 20);

        if (missingIds.length > 0) {
          const localShards = await workoutStorage.getBatch(missingIds);
          if (localShards.length > 0) {
            set((state) => {
              state.history.push(...localShards);
              // Maintain sort order
              state.history.sort(byCompletedAtDesc);
            });
            return;
          }
        }

        // Exhausted local shards, fetch from server
        const { fetchWorkouts } = await import("@/lib/api/workouts");
        const currentCount = history.filter(s => !s.deletedAt).length;
        const limit = 20;
        const remote = await fetchWorkouts(limit, currentCount);
        
        if (remote) {
          if (remote.length < limit) {
            set((state) => {
              state.hasMoreHistory = false;
            });
          }
          get().mergeRemoteWorkouts(remote);
        } else {
          set((state) => {
            state.hasMoreHistory = false;
          });
        }
      },

      // ── Rest timer ────────────────────────────

      startRestTimer: async (exerciseId, restSeconds, exerciseName) => {
        const current = get().activeRestTimer;

        // If one is already running, accumulate its progress before replacing it.
        if (current) {
          const elapsed = Math.max(0, Math.floor((Date.now() - current.startTime) / 1000));
          set((state) => {
            if (state.activeSession) {
              state.activeSession.cumulativeRestSeconds = (state.activeSession.cumulativeRestSeconds || 0) + elapsed;
            }
          });
          await cancelScheduledNotification(current.notificationId);
          void endRestTimerLiveActivity(
            buildActiveRestTimerLiveActivityProps(get().activeSession, current)
          );
        }

        const now = Date.now();
        const endTime = now + restSeconds * 1000;
        const notificationId = await scheduleRestCompleteNotification(
          exerciseName,
          restSeconds
        );

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
            restSeconds
          )
        );
      },

      cancelRestTimer: async () => {
        const current = get().activeRestTimer;
        if (current) {
          const elapsed = Math.max(0, Math.floor((Date.now() - current.startTime) / 1000));
          set((state) => {
            if (state.activeSession) {
              state.activeSession.cumulativeRestSeconds = (state.activeSession.cumulativeRestSeconds || 0) + elapsed;
            }
            state.activeRestTimer = null;
          });
          await cancelScheduledNotification(current.notificationId);
          void endRestTimerLiveActivity(
            buildActiveRestTimerLiveActivityProps(get().activeSession, current)
          );
        }
      },

      clearExpiredTimer: () => {
        const timer = get().activeRestTimer;
        if (timer && timer.endTime <= Date.now()) {
          const elapsed = Math.max(0, Math.floor((timer.endTime - timer.startTime) / 1000));
          const liveActivityProps = buildActiveRestTimerLiveActivityProps(
            get().activeSession,
            timer
          );
          set((state) => {
            if (state.activeSession) {
              state.activeSession.cumulativeRestSeconds = (state.activeSession.cumulativeRestSeconds || 0) + elapsed;
            }
            state.activeRestTimer = null;
          });
          void endRestTimerLiveActivity(liveActivityProps);
        }
      },

      // ── Stats ─────────────────────────────────

      togglePinExercise: (identityKey) => {
        set((state) => {
          if (!state.pinnedExerciseNames) {
            state.pinnedExerciseNames = [];
          }
          const normalizedKey = normalizeExerciseIdentityKey(identityKey);
          if (!normalizedKey) return;
          if (state.pinnedExerciseNames.includes(normalizedKey)) {
            state.pinnedExerciseNames = state.pinnedExerciseNames.filter((n) => n !== normalizedKey);
          } else {
            state.pinnedExerciseNames.push(normalizedKey);
          }
        });
      },

      // ── Sync metadata ────────────────────────

      clearDeletedWorkouts: (ids) => {
        set((state) => {
          state.deletedWorkoutIds = state.deletedWorkoutIds.filter(id => !ids.includes(id));
          state.history = state.history.filter(s => !ids.includes(s._id) || !s.deletedAt);
          state.dirtyWorkoutIds = state.dirtyWorkoutIds.filter((id) => !ids.includes(id));
        });
        void workoutStatsStorage.removeSessions(ids);
      },

      clearDirtyWorkouts: (ids) => {
        set((state) => {
          if (ids.length === 0) return;
          state.dirtyWorkoutIds = state.dirtyWorkoutIds.filter((id) => !ids.includes(id));
          state.isDirty = state.deletedWorkoutIds.length > 0 || state.dirtyWorkoutIds.length > 0;
        });
      },

      updateMusclesInHistory: (exerciseIdentityKey, muscles) => {
        const normalizedKey = normalizeExerciseIdentityKey(exerciseIdentityKey);
        if (!normalizedKey) return;
        const normalizedMuscles = [...muscles];
        const loadedHistoryIds = new Set(get().history.map((session) => session._id));
        const shardOnlyIds = get().historyIndex.filter((id) => !loadedHistoryIds.has(id));
        const updatedAt = nextLocalUpdatedAt(get().lastSyncedAt);

        // Custom exercises (ids like "custom-<uuid>") are detected from the raw,
        // un-normalized exerciseDefinitionId of matched exercises — normalizeExerciseIdentityKey
        // strips the hyphen, so "custom-abc" would never match a "custom-" prefix check.
        const matchedCustomExerciseIds = new Set<string>();

        const updatedSessions: WorkoutSession[] = [];
        set((state) => {
          let count = 0;

          state.history.forEach(session => {
            let sessionChanged = false;
            session.exercises.forEach(ex => {
              if (getExerciseIdentityKey(ex) === normalizedKey) {
                ex.muscles = [...normalizedMuscles];
                session.updatedAt = updatedAt;
                count++;
                sessionChanged = true;
                if (typeof ex.exerciseDefinitionId === "string" && ex.exerciseDefinitionId.startsWith("custom-")) {
                  matchedCustomExerciseIds.add(ex.exerciseDefinitionId);
                }
              }
            });
            if (sessionChanged) {
              updatedSessions.push(safeClone(session));
              if (!state.dirtyWorkoutIds.includes(session._id)) {
                state.dirtyWorkoutIds.push(session._id);
              }
            }
          });

          // Also update active session if it contains the exercise
          if (state.activeSession) {
            state.activeSession.exercises.forEach(ex => {
              if (getExerciseIdentityKey(ex) === normalizedKey) {
                ex.muscles = [...normalizedMuscles];
                if (typeof ex.exerciseDefinitionId === "string" && ex.exerciseDefinitionId.startsWith("custom-")) {
                  matchedCustomExerciseIds.add(ex.exerciseDefinitionId);
                }
              }
            });
          }

          if (count > 0) state.isDirty = true;
        });

        if (updatedSessions.length > 0) {
          workoutStorage.saveBatch(updatedSessions);
        }

        matchedCustomExerciseIds.forEach((rawId) => {
          useExerciseLibraryStore.getState().updateCustomExerciseMuscles(rawId, normalizedMuscles);
        });

        if (shardOnlyIds.length > 0) {
          void (async () => {
            const shardCustomExerciseIds = new Set<string>();
            const changedShardSessions = await rewriteShardOnlySessions(
              shardOnlyIds,
              updatedAt,
              (exercise) => {
                if (getExerciseIdentityKey(exercise) !== normalizedKey) return false;
                exercise.muscles = [...normalizedMuscles];
                if (typeof exercise.exerciseDefinitionId === "string" && exercise.exerciseDefinitionId.startsWith("custom-")) {
                  shardCustomExerciseIds.add(exercise.exerciseDefinitionId);
                }
                return true;
              }
            );

            if (changedShardSessions.length === 0) return;

            set((state) => {
              markShardRewriteDirty(state, changedShardSessions);
            });

            shardCustomExerciseIds.forEach((rawId) => {
              useExerciseLibraryStore.getState().updateCustomExerciseMuscles(rawId, normalizedMuscles);
            });
          })();
        }
      },

      renameExerciseDefinitionReferences: (exerciseDefinitionId, nextName) => {
        const normalizedExerciseDefinitionId = String(exerciseDefinitionId).trim();
        const normalizedName = String(nextName).trim();
        if (!normalizedExerciseDefinitionId || !normalizedName) return;

        const loadedHistoryIds = new Set(get().history.map((session) => session._id));
        const shardOnlyIds = get().historyIndex.filter((id) => !loadedHistoryIds.has(id));
        const updatedAt = nextLocalUpdatedAt(get().lastSyncedAt);
        const updatedSessions: WorkoutSession[] = [];

        set((state) => {
          let changed = false;

          state.history.forEach((session) => {
            let sessionChanged = false;
            session.exercises.forEach((exercise) => {
              if (exercise.exerciseDefinitionId !== normalizedExerciseDefinitionId) return;
              if (exercise.name === normalizedName) return;
              exercise.name = normalizedName;
              session.updatedAt = updatedAt;
              sessionChanged = true;
              changed = true;
            });

            if (sessionChanged) {
              updatedSessions.push(safeClone(session));
              if (!state.dirtyWorkoutIds.includes(session._id)) {
                state.dirtyWorkoutIds.push(session._id);
              }
            }
          });

          if (state.activeSession) {
            state.activeSession.exercises.forEach((exercise) => {
              if (exercise.exerciseDefinitionId !== normalizedExerciseDefinitionId) return;
              if (exercise.name === normalizedName) return;
              exercise.name = normalizedName;
              changed = true;
            });

            if (changed) {
              state.activeSession.updatedAt = nextLocalUpdatedAt(state.lastSyncedAt);
            }

            if (
              state.activeRestTimer &&
              state.activeSession.exercises.some(
                (exercise) =>
                  exercise.id === state.activeRestTimer?.exerciseId &&
                  exercise.exerciseDefinitionId === normalizedExerciseDefinitionId
              )
            ) {
              state.activeRestTimer.exerciseName = normalizedName;
            }
          }

          if (changed) {
            state.isDirty = true;
          }
        });

        if (updatedSessions.length > 0) {
          workoutStorage.saveBatch(updatedSessions);
        }

        if (shardOnlyIds.length > 0) {
          void (async () => {
            const changedShardSessions = await rewriteShardOnlySessions(
              shardOnlyIds,
              updatedAt,
              (exercise) => {
                if (exercise.exerciseDefinitionId !== normalizedExerciseDefinitionId) return false;
                if (exercise.name === normalizedName) return false;
                exercise.name = normalizedName;
                return true;
              }
            );

            if (changedShardSessions.length === 0) return;

            set((state) => {
              markShardRewriteDirty(state, changedShardSessions);
            });
          })();
        }
      },

      removeExerciseDefinitionReferences: (exerciseDefinitionId) => {
        const normalizedExerciseDefinitionId = String(exerciseDefinitionId).trim();
        if (!normalizedExerciseDefinitionId) return;

        const loadedHistoryIds = new Set(get().history.map((session) => session._id));
        const shardOnlyIds = get().historyIndex.filter((id) => !loadedHistoryIds.has(id));
        const updatedAt = nextLocalUpdatedAt(get().lastSyncedAt);
        const updatedSessions: WorkoutSession[] = [];

        set((state) => {
          let changed = false;

          state.history.forEach((session) => {
            let sessionChanged = false;
            session.exercises.forEach((exercise) => {
              if (exercise.exerciseDefinitionId !== normalizedExerciseDefinitionId) return;
              exercise.exerciseDefinitionId = "";
              session.updatedAt = updatedAt;
              sessionChanged = true;
              changed = true;
            });

            if (sessionChanged) {
              updatedSessions.push(safeClone(session));
              if (!state.dirtyWorkoutIds.includes(session._id)) {
                state.dirtyWorkoutIds.push(session._id);
              }
            }
          });

          if (state.activeSession) {
            state.activeSession.exercises.forEach((exercise) => {
              if (exercise.exerciseDefinitionId !== normalizedExerciseDefinitionId) return;
              exercise.exerciseDefinitionId = "";
              changed = true;
            });

            if (changed) {
              state.activeSession.updatedAt = nextLocalUpdatedAt(state.lastSyncedAt);
            }
          }

          if (changed) {
            state.isDirty = true;
          }
        });

        if (updatedSessions.length > 0) {
          workoutStorage.saveBatch(updatedSessions);
        }

        if (shardOnlyIds.length > 0) {
          void (async () => {
            const changedShardSessions = await rewriteShardOnlySessions(
              shardOnlyIds,
              updatedAt,
              (exercise) => {
                if (exercise.exerciseDefinitionId !== normalizedExerciseDefinitionId) return false;
                exercise.exerciseDefinitionId = "";
                return true;
              }
            );

            if (changedShardSessions.length === 0) return;

            set((state) => {
              markShardRewriteDirty(state, changedShardSessions);
            });
          })();
        }
      },

      applySyncMerge: (remote, syncStartTime) => {
        let syncedSessions: WorkoutSession[] = [];
        let deletedSessionIds: string[] = [];
        set((state) => {
          if (remote.length === 0) {
            state.lastSyncedAt = syncStartTime;
            state.isDirty =
              state.dirtyWorkoutIds.length > 0 ||
              state.deletedWorkoutIds.length > 0 ||
              state.history.some((w) => w.updatedAt > syncStartTime);
            return;
          }

          const remoteMap = new Map(remote.map((w) => [w._id, w]));
          let historyChanged = false;
          const shardsToSave: WorkoutSession[] = [];
          const deletedIds = new Set<string>();

          for (let i = 0; i < state.history.length; i++) {
            const lw = state.history[i];
            const rw = remoteMap.get(lw._id);
            
            if (rw) {
              const winner = lw.updatedAt >= rw.updatedAt ? lw : rw;
              state.history[i] = winner;
              if (winner.deletedAt) {
                deletedIds.add(winner._id);
              } else {
                shardsToSave.push(safeClone(winner));
              }
              remoteMap.delete(lw._id);
              historyChanged = true;
            }
          }

          // Remaining remotes are either new additions or tombstones for shard-only sessions.
          if (remoteMap.size > 0) {
            for (const rw of remoteMap.values()) {
              if (rw.deletedAt) {
                deletedIds.add(rw._id);
                historyChanged = historyChanged || state.historyIndex.includes(rw._id);
                continue;
              }

              state.history.push(rw);
              if (!state.historyIndex.includes(rw._id)) {
                state.historyIndex.unshift(rw._id);
              }
              shardsToSave.push(safeClone(rw));
              historyChanged = true;
            }
          }

          if (deletedIds.size > 0) {
            const shouldFilterHistory = state.history.some((session) =>
              deletedIds.has(session._id)
            );
            if (shouldFilterHistory) {
              historyChanged = true;
            }

            state.history = state.history.filter((session) => !deletedIds.has(session._id));
            state.historyIndex = state.historyIndex.filter((id) => !deletedIds.has(id));
            state.deletedWorkoutIds = state.deletedWorkoutIds.filter((id) => !deletedIds.has(id));
            state.dirtyWorkoutIds = state.dirtyWorkoutIds.filter((id) => !deletedIds.has(id));
            deletedSessionIds = Array.from(deletedIds);
          }

          if (historyChanged) {
            state.history = state.history.filter(w => !w.deletedAt);
            state.history.sort(byCompletedAtDesc);
            // Note: intentionally NOT capping state.history here — a delta
            // sync must not evict already-paged-in history (that would strand
            // shard-backed sessions behind a permanently-disabled "Load More").
          }

          if (shardsToSave.length > 0) {
            workoutStorage.saveBatch(shardsToSave);
            syncedSessions = shardsToSave;
          }

          state.lastSyncedAt = syncStartTime;
          state.isDirty =
            state.dirtyWorkoutIds.length > 0 ||
            state.deletedWorkoutIds.length > 0 ||
            state.history.some((w) => w.updatedAt > syncStartTime);
          // Real availability signal — there may still be more to fetch from
          // the server even when this evaluates to false; fetchMoreHistory
          // discovers that case once local shards are exhausted.
          state.hasMoreHistory = state.historyIndex.length > state.history.length;
        });

        if (syncedSessions.length > 0) {
          void workoutStatsStorage.upsertBatch(syncedSessions);
        }
        if (deletedSessionIds.length > 0) {
          void workoutStorage.removeBatch(deletedSessionIds);
          void workoutStatsStorage.removeSessions(deletedSessionIds);
        }
      },

      mergeRemoteWorkouts: (remote) => {
        let newEntriesForStats: WorkoutSession[] = [];
        set((state) => {
          const localIds = new Set(state.history.map((w) => w._id));
          const newEntries = remote.filter((w) => !localIds.has(w._id) && !w.deletedAt);
          if (newEntries.length > 0) {
            // Add all to index
            newEntries.forEach(w => {
              if (!state.historyIndex.includes(w._id)) {
                state.historyIndex.push(w._id);
              }
            });
            
            // Batch save to shards
            workoutStorage.saveBatch(newEntries);
            newEntriesForStats = safeClone(newEntries);

            // Grow the visible history cache with the newly fetched page.
            // Not capped here — this action's job is pagination growth; capping
            // would immediately discard the older page it just fetched.
            state.history.push(...newEntries);
            state.history.sort(byCompletedAtDesc);
          }
        });

        if (newEntriesForStats.length > 0) {
          void workoutStatsStorage.upsertBatch(newEntriesForStats);
        }
      },
    })),
    {
      name: "workout-session-store",
      storage: createJSONStorage(() => zustandAsyncStorage),
      version: WORKOUT_SESSION_STORE_VERSION,
      migrate: (persistedState) =>
        normalizePersistedWorkoutState(
          persistedState as Partial<WorkoutSessionState> | undefined
        ),
      // Optimization: Only persist structural metadata and the recent history cache.
      // Full session objects are sharded to workoutStorage.
      partialize: (state) => ({
        history: state.history,
        historyIndex: state.historyIndex,
        activeSession: state.activeSession,
        activeRestTimer: state.activeRestTimer,
        pinnedExerciseNames: state.pinnedExerciseNames,
        activeExerciseId: state.activeExerciseId,
        lastSyncedAt: state.lastSyncedAt,
        deletedWorkoutIds: state.deletedWorkoutIds,
        dirtyWorkoutIds: state.dirtyWorkoutIds,
        isDirty: state.isDirty,
      }),
    }
  )
);
