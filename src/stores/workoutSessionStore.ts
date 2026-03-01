import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { zustandAsyncStorage } from "@/storage/mmkv";
import { USER_ID } from "@/constants/user";
import { generateId } from "@/utils/id";
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
  /** Completed sessions, newest first. */
  history: WorkoutSession[];
  /** IDs of sessions deleted locally but not yet synced to the server. */
  deletedWorkoutIds: string[];
  /** Whether there are more sessions to fetch from the server. */
  hasMoreHistory: boolean;
  /** Background-safe rest timer (persisted via MMKV). */
  activeRestTimer: ActiveRestTimer | null;
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

  // ── Exercise mutations ─────────────────────
  addExercise: (name: string) => void;
  removeExercise: (exerciseId: string) => void;
  updateExerciseField: (
    exerciseId: string,
    field: keyof Pick<WorkoutExercise, "name" | "restSeconds" | "notes" | "weightUnit">,
    value: string | number
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

  // ── Sync metadata ─────────────────────────
  markDirty: () => void;
  clearDeletedWorkouts: (ids: string[]) => void;
  renameExerciseInHistory: (oldName: string, newName: string) => void;

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
      deletedWorkoutIds: [],
      hasMoreHistory: true,
      activeRestTimer: null,
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
        const exercises: WorkoutExercise[] = program.exercises.map((pe) => ({
          id: generateId(),
          name: pe.name,
          restSeconds: pe.restSeconds,
          notes: pe.notes,
          sets: createEmptySets(pe.defaultSets),
          weightUnit: pe.weightUnit || "kg",
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

        set((state) => {
          if (!state.activeSession) return;
          state.activeSession.completedAt = new Date().toISOString();
          state.activeSession.updatedAt = Date.now();
          // Prepend to history (newest first).
          state.history.unshift(
            JSON.parse(JSON.stringify(state.activeSession)) as WorkoutSession
          );
          state.activeSession = null;
          state.activeRestTimer = null;
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
        set((state) => {
          const workout = state.history.find(s => s._id === sessionId);
          if (workout) {
            workout.deletedAt = Date.now();
            workout.updatedAt = Date.now();
          }
          if (!state.deletedWorkoutIds.includes(sessionId)) {
            state.deletedWorkoutIds.push(sessionId);
          }
          state.isDirty = true;
        });
      },

      // ── Exercise mutations ───────────────────

      addExercise: (name) => {
        set((state) => {
          if (!state.activeSession) return;
          const exercise: WorkoutExercise = {
            id: generateId(),
            name,
            restSeconds: 90,
            notes: "",
            sets: createEmptySets(3),
            weightUnit: "kg",
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
        
        set((state) => {
          if (!state.activeSession) return;
          const ex = state.activeSession.exercises.find(
            (e) => e.id === exerciseId
          );
          if (!ex) return;
          if (field === "restSeconds") {
            ex.restSeconds = value as number;
          } else if (field === "weightUnit") {
            ex.weightUnit = value as "kg" | "lbs";
          } else {
            (ex[field] as string) = value as string;
          }
        });

        // Trigger history rename if name changed during active workout
        if (field === "name" && oldName && oldName.toLowerCase() !== (value as string).toLowerCase()) {
          get().renameExerciseInHistory(oldName, value as string);
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
        set((state) => {
          const session = state.history.find((s) => s._id === sessionId);
          if (!session) return;
          const ex = session.exercises.find((e) => e.id === exerciseId);
          if (!ex) return;
          const s = ex.sets.find((s) => s.id === setId);
          if (!s) return;
          s[field] = value;
          session.updatedAt = Date.now();
          state.isDirty = true;
        });
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
      fetchMoreHistory: async () => {
        const { fetchWorkouts } = await import("@/lib/api/workouts");
        const currentCount = get().history.filter(s => !s.deletedAt).length;
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
        });
      },

      renameExerciseInHistory: (oldName, newName) => {
        if (!oldName || !newName || oldName.toLowerCase() === newName.toLowerCase()) return;
        
        set((state) => {
          let count = 0;
          state.history.forEach(session => {
            session.exercises.forEach(ex => {
              if (ex.name.toLowerCase() === oldName.toLowerCase()) {
                ex.name = newName;
                session.updatedAt = Date.now();
                count++;
              }
            });
          });
          if (count > 0) state.isDirty = true;
        });
      },

      applySyncMerge: (remote, syncStartTime) => {
        set((state) => {
          const remoteMap = new Map(remote.map((w) => [w._id, w]));
          const merged = new Map<string, WorkoutSession>();
          const lastSync = state.lastSyncedAt || 0;

          for (const lw of state.history) {
            const rw = remoteMap.get(lw._id);
            if (!rw) {
              if (lw.updatedAt > lastSync || !lw.deletedAt) {
                merged.set(lw._id, lw);
              }
            } else {
              const winner = lw.updatedAt >= rw.updatedAt ? lw : rw;
              if (!winner.deletedAt) {
                merged.set(lw._id, winner);
              }
              remoteMap.delete(lw._id);
            }
          }

          for (const rw of remoteMap.values()) {
            if (!rw.deletedAt) {
              merged.set(rw._id, rw);
            }
          }

          state.history = Array.from(merged.values()).sort((a, b) => {
            const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
            const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
            return bTime - aTime;
          });

          state.lastSyncedAt = syncStartTime;
          state.isDirty = state.history.some(w => w.updatedAt > syncStartTime) || state.deletedWorkoutIds.length > 0;
          state.hasMoreHistory = false;
        });
      },

      mergeRemoteWorkouts: (remote) => {
        set((state) => {
          const localIds = new Set(state.history.map((w) => w._id));
          const newEntries = remote.filter((w) => !localIds.has(w._id) && !w.deletedAt);
          if (newEntries.length > 0) {
            state.history.push(...newEntries);
            state.history.sort((a, b) => {
              const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
              const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
              return bTime - aTime;
            });
          }
        });
      },
    })),
    {
      name: "workout-session-store",
      storage: createJSONStorage(() => zustandAsyncStorage),
    }
  )
);
