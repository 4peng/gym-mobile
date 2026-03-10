import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { zustandAsyncStorage } from "@/storage/mmkv";
import { workoutStorage } from "@/storage/workoutStorage";
import { workoutStatsStorage } from "@/storage/workoutStatsStorage";
import { USER_ID } from "@/constants/user";
import { generateId } from "@/utils/id";
import { MuscleGroup } from "@/constants/muscles";
import { normalizeExerciseName } from "@/utils/string";
import { safeClone } from "@/utils/clone";
import type {
  Program,
  WorkoutSession,
  WorkoutExercise,
  WorkoutSet,
} from "@/types";
import {
  scheduleRestCompleteNotification,
  cancelScheduledNotification,
} from "@/utils/notifications";

// ──────────────────────────────────────────────
// Constants for Optimization
// ──────────────────────────────────────────────
const MAX_MEMORY_HISTORY = 15; // Limit in-memory history cache size
const WORKOUT_SESSION_STORE_VERSION = 3;

// ──────────────────────────────────────────────
// Rest timer type
// ──────────────────────────────────────────────

export interface ActiveRestTimer {
  /** Absolute epoch-ms when the rest period ends. */
  endTime: number;
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
  /** True when completed workouts have un-synced changes. */
  isDirty: boolean;
  /** Epoch-ms of the last successful sync. */
  lastSyncedAt: number | null;
}

interface WorkoutSessionActions {
  // ── Session lifecycle ──────────────────────
  startQuickSession: () => void;
  startFromProgram: (program: Program) => void;
  completeSession: () => void;
  discardSession: () => void;
  deleteHistorySession: (sessionId: string) => void;
  updateSessionDate: (sessionId: string, newDate: string) => void;

  // ── Exercise mutations ─────────────────────
  addExercise: (name: string) => void;
  removeExercise: (exerciseId: string) => void;
  updateExerciseField: (
    exerciseId: string,
    field: keyof Pick<WorkoutExercise, "name" | "restSeconds" | "notes" | "weightUnit" | "muscles">,
    value: any
  ) => void;
  toggleExerciseUnit: (exerciseId: string) => void;

  // ── Set mutations ──────────────────────────
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  updateSet: (
    exerciseId: string,
    setId: string,
    field: keyof Pick<WorkoutSet, "weight" | "reps">,
    value: number | null
  ) => void;
  updateHistorySet: (
    sessionId: string,
    exerciseId: string,
    setId: string,
    field: keyof Pick<WorkoutSet, "weight" | "reps">,
    value: number | null
  ) => void;
  toggleSetCompletion: (exerciseId: string, setId: string) => void;

  // ── Queries ────────────────────────────────
  getActiveSession: () => WorkoutSession | null;
  getHistory: () => WorkoutSession[];
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
  togglePinExercise: (name: string) => void;

  // ── Sync metadata ─────────────────────────
  markDirty: () => void;
  clearDeletedWorkouts: (ids: string[]) => void;
  clearDirtyWorkouts: (ids: string[]) => void;
  renameExerciseInHistory: (oldName: string, newName: string) => void;
  updateMusclesInHistory: (exerciseName: string, muscles: MuscleGroup[]) => void;

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

function createEmptySet(): WorkoutSet {
  return { id: generateId(), weight: null, reps: null };
}

function createEmptySets(count: number): WorkoutSet[] {
  return Array.from({ length: count }, () => createEmptySet());
}

function normalizePersistedWorkoutSession(raw: any): WorkoutSession | null {
  if (!raw || typeof raw !== "object") return null;
  const id = raw._id ? String(raw._id) : null;
  if (!id) return null;

  const exercises = Array.isArray(raw.exercises)
    ? raw.exercises.map((ex: any) => ({
        id: ex?.id ? String(ex.id) : generateId(),
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
              completedAt: typeof s?.completedAt === "string" ? s.completedAt : undefined,
            }))
          : [],
        weightUnit: ex?.weightUnit === "lbs" ? "lbs" : "kg",
        muscles: Array.isArray(ex?.muscles) ? ex.muscles : [],
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
    exercises,
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
      typeof state.activeRestTimer.exerciseId === "string" &&
      typeof state.activeRestTimer.exerciseName === "string" &&
      typeof state.activeRestTimer.notificationId === "string"
        ? state.activeRestTimer
        : null,
    pinnedExerciseNames: Array.isArray(state?.pinnedExerciseNames)
      ? state!.pinnedExerciseNames.map((name) => String(name).toLowerCase())
      : [],
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
      isDirty: false,
      lastSyncedAt: null,

      // ── Session lifecycle ────────────────────

      startQuickSession: () => {
        const session: WorkoutSession = {
          _id: generateId(),
          userId: USER_ID,
          startedAt: new Date().toISOString(),
          updatedAt: Date.now(),
          exercises: [],
        };
        set((state) => {
          state.activeSession = session;
        });
      },

      startFromProgram: (program) => {
        // Deep-copy program exercises into an independent session.
        const exercises: WorkoutExercise[] = (program.exercises || []).map((pe) => ({
          id: generateId(),
          name: pe.name,
          restSeconds: pe.restSeconds,
          notes: pe.notes,
          sets: createEmptySets(pe.defaultSets),
          weightUnit: pe.weightUnit || "kg",
          muscles: pe.muscles || [],
        }));

        const session: WorkoutSession = {
          _id: generateId(),
          userId: USER_ID,
          programId: program._id,
          startedAt: new Date().toISOString(),
          updatedAt: Date.now(),
          exercises,
        };
        set((state) => {
          state.activeSession = session;
        });
      },

      completeSession: () => {
        // Cancel any active rest timer when session ends.
        const timer = get().activeRestTimer;
        if (timer) {
          cancelScheduledNotification(timer.notificationId);
        }

        const session = get().activeSession;
        if (!session) return;

        const completedAt = new Date().toISOString();
        const updatedAt = Date.now();
        const finalSession = { ...session, completedAt, updatedAt };

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
        }

        set((state) => {
          state.activeSession = null;
          state.activeRestTimer = null;
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
            workout.updatedAt = Date.now();
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
        let updatedSession: WorkoutSession | null = null;
        set((state) => {
          const session = state.history.find(s => s._id === sessionId);
          if (session) {
            session.completedAt = newDate;
            session.updatedAt = Date.now();
            state.isDirty = true;
            
            // Re-sort history by completedAt date
            state.history.sort((a, b) => {
              const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
              const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
              return bTime - aTime;
            });

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
      },

      addExercise: (name) => {
        const history = get().history;
        const historyIndex = get().historyIndex;
        const normalizedName = normalizeExerciseName(name, historyIndex);
        const lowerName = normalizedName.toLowerCase();

        // Smart Lookup: Find the most recent session containing this exercise to copy its muscles
        let inferredMuscles: MuscleGroup[] = [];
        for (const session of history) {
          const existingEx = session.exercises.find(
            (e) => e.name.toLowerCase() === lowerName
          );
          if (existingEx && existingEx.muscles && existingEx.muscles.length > 0) {
            inferredMuscles = [...existingEx.muscles];
            break;
          }
        }

        set((state) => {
          if (!state.activeSession) return;
          const exercise: WorkoutExercise = {
            id: generateId(),
            name: normalizedName,
            restSeconds: 90,
            notes: "",
            sets: createEmptySets(3),
            weightUnit: "kg",
            muscles: inferredMuscles,
          };
          state.activeSession.exercises.push(exercise);
        });
      },

      removeExercise: (exerciseId) => {
        set((state) => {
          if (!state.activeSession) return;
          state.activeSession.exercises =
            state.activeSession.exercises.filter((e) => e.id !== exerciseId);
        });
      },

      updateExerciseField: (exerciseId, field, value) => {
        const oldName = field === "name" ? get().activeSession?.exercises.find(e => e.id === exerciseId)?.name : null;
        const normalizedValue = field === "name" ? normalizeExerciseName(value as string, get().historyIndex) : value;

        set((state) => {
          if (!state.activeSession) return;
          const ex = state.activeSession.exercises.find(
            (e) => e.id === exerciseId
          );
          if (!ex) return;
          if (field === "restSeconds") {
            ex.restSeconds = normalizedValue as number;
          } else if (field === "weightUnit") {
            ex.weightUnit = normalizedValue as "kg" | "lbs";
          } else if (field === "muscles") {
            ex.muscles = normalizedValue as MuscleGroup[];
          } else {
            (ex[field] as any) = normalizedValue;
          }
        });

        // Trigger history rename if name changed during active workout
        if (field === "name" && oldName && oldName.toLowerCase() !== (normalizedValue as string).toLowerCase()) {
          get().renameExerciseInHistory(oldName, normalizedValue as string);
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
          ex.sets.push(createEmptySet());
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
        });
      },

      updateHistorySet: (sessionId, exerciseId, setId, field, value) => {
        let updatedSession: WorkoutSession | null = null;
        set((state) => {
          const session = state.history.find((s) => s._id === sessionId);
          if (!session) return;
          const ex = session.exercises.find((e) => e.id === exerciseId);
          if (!ex) return;
          const s = ex.sets.find((s) => s.id === setId);
          if (!s) return;
          s[field] = value;
          session.updatedAt = Date.now();
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
      },

      /**
       * Toggle a set between completed and in-progress.
       */
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
        });
      },

      // ── Queries ──────────────────────────────

      getActiveSession: () => get().activeSession,
      getHistory: () => get().history.filter(s => !s.deletedAt),

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
              state.history.sort((a, b) => {
                const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
                const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
                return bTime - aTime;
              });
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

        // Cancel existing timer + notification if one is active (duplicate protection).
        if (current) {
          await cancelScheduledNotification(current.notificationId);
        }

        const endTime = Date.now() + restSeconds * 1000;
        const notificationId = await scheduleRestCompleteNotification(
          exerciseName,
          restSeconds
        );

        set((state) => {
          state.activeRestTimer = {
            endTime,
            exerciseId,
            exerciseName,
            notificationId,
          };
        });
      },

      cancelRestTimer: async () => {
        const current = get().activeRestTimer;
        if (current) {
          await cancelScheduledNotification(current.notificationId);
        }
        set((state) => {
          state.activeRestTimer = null;
        });
      },

      clearExpiredTimer: () => {
        const timer = get().activeRestTimer;
        if (timer && timer.endTime <= Date.now()) {
          set((state) => {
            state.activeRestTimer = null;
          });
        }
      },

      // ── Stats ─────────────────────────────────

      togglePinExercise: (name) => {
        set((state) => {
          if (!state.pinnedExerciseNames) {
            state.pinnedExerciseNames = [];
          }
          const lowerName = name.toLowerCase();
          if (state.pinnedExerciseNames.includes(lowerName)) {
            state.pinnedExerciseNames = state.pinnedExerciseNames.filter(n => n !== lowerName);
          } else {
            state.pinnedExerciseNames.push(lowerName);
          }
          state.isDirty = true;
        });
      },

      // ── Sync metadata ────────────────────────

      markDirty: () => {
        set((state) => {
          state.isDirty = true;
        });
      },

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

      renameExerciseInHistory: (oldName, newName) => {
        if (!oldName || !newName || oldName.toLowerCase() === newName.toLowerCase()) return;

        const updatedSessions: WorkoutSession[] = [];
        set((state) => {
          let count = 0;
          state.history.forEach(session => {
            let sessionChanged = false;
            session.exercises.forEach(ex => {
              if (ex.name.toLowerCase() === oldName.toLowerCase()) {
                ex.name = newName;
                session.updatedAt = Date.now();
                count++;
                sessionChanged = true;
              }
            });
            if (sessionChanged) {
              updatedSessions.push(safeClone(session));
              if (!state.dirtyWorkoutIds.includes(session._id)) {
                state.dirtyWorkoutIds.push(session._id);
              }
            }
          });
          if (count > 0) state.isDirty = true;
        });

        if (updatedSessions.length > 0) {
          workoutStorage.saveBatch(updatedSessions);
          void workoutStatsStorage.upsertBatch(updatedSessions);
        }
      },

      updateMusclesInHistory: (exerciseName, muscles) => {
        if (!exerciseName) return;
        
        const updatedSessions: WorkoutSession[] = [];
        set((state) => {
          let count = 0;
          const lowerName = exerciseName.toLowerCase();
          
          state.history.forEach(session => {
            let sessionChanged = false;
            session.exercises.forEach(ex => {
              if (ex.name.toLowerCase() === lowerName) {
                ex.muscles = [...muscles];
                session.updatedAt = Date.now();
                count++;
                sessionChanged = true;
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
              if (ex.name.toLowerCase() === lowerName) {
                ex.muscles = [...muscles];
              }
            });
          }

          if (count > 0) state.isDirty = true;
        });

        if (updatedSessions.length > 0) {
          workoutStorage.saveBatch(updatedSessions);
        }
      },

      applySyncMerge: (remote, syncStartTime) => {
        let syncedSessions: WorkoutSession[] = [];
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

          for (let i = 0; i < state.history.length; i++) {
            const lw = state.history[i];
            const rw = remoteMap.get(lw._id);
            
            if (rw) {
              const winner = lw.updatedAt >= rw.updatedAt ? lw : rw;
              state.history[i] = winner;
              shardsToSave.push(safeClone(winner));
              remoteMap.delete(lw._id);
              historyChanged = true;
            }
          }

          // Remaining remotes are new additions
          if (remoteMap.size > 0) {
            for (const rw of remoteMap.values()) {
              if (!rw.deletedAt) {
                state.history.push(rw);
                if (!state.historyIndex.includes(rw._id)) {
                  state.historyIndex.unshift(rw._id);
                }
                shardsToSave.push(safeClone(rw));
                historyChanged = true;
              }
            }
          }

          // Clean up any that ended up deleted
          if (historyChanged) {
            state.history = state.history.filter(w => !w.deletedAt);
            state.history.sort((a, b) => {
              const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
              const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
              return bTime - aTime;
            });
            
            // Limit in-memory cache
            if (state.history.length > MAX_MEMORY_HISTORY) {
              state.history = state.history.slice(0, MAX_MEMORY_HISTORY);
            }
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
          state.hasMoreHistory = false;
        });

        if (syncedSessions.length > 0) {
          void workoutStatsStorage.upsertBatch(syncedSessions);
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

            // Add only what fits to the in-memory cache
            state.history.push(...newEntries);
            state.history.sort((a, b) => {
              const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
              const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
              return bTime - aTime;
            });
            
            if (state.history.length > MAX_MEMORY_HISTORY) {
              state.history = state.history.slice(0, MAX_MEMORY_HISTORY);
            }
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
        lastSyncedAt: state.lastSyncedAt,
        deletedWorkoutIds: state.deletedWorkoutIds,
        dirtyWorkoutIds: state.dirtyWorkoutIds,
        isDirty: state.isDirty,
      }),
    }
  )
);
