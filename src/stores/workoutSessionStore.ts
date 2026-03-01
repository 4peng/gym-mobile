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
  toggleSetCompletion: (exerciseId: string, setId: string) => void;

  // ── Queries ────────────────────────────────
  getActiveSession: () => WorkoutSession | null;
  getHistory: () => WorkoutSession[];

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
      getHistory: () => get().history,

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

      applySyncMerge: (remote, syncStartTime) => {
        set((state) => {
          const remoteMap = new Map(remote.map((w) => [w._id, w]));
          const merged = new Map<string, WorkoutSession>();
          const lastSync = state.lastSyncedAt || 0;

          // Process completed workouts only. We leave activeSession untouched.
          // In the current logic, only completed workouts are in `history`.
          for (const lw of state.history) {
            const rw = remoteMap.get(lw._id);
            if (!rw) {
              // Local only. Keep it if it has changes since last sync, or if it's strictly local.
              if (lw.updatedAt > lastSync) {
                merged.set(lw._id, lw);
              }
            } else {
              // Both exist. Larger updatedAt wins.
              merged.set(lw._id, lw.updatedAt >= rw.updatedAt ? lw : rw);
              remoteMap.delete(lw._id);
            }
          }

          for (const rw of remoteMap.values()) {
            merged.set(rw._id, rw);
          }

          // Sort newest first by completedAt.
          state.history = Array.from(merged.values()).sort((a, b) => {
            const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
            const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
            return bTime - aTime;
          });

          state.lastSyncedAt = syncStartTime;
          state.isDirty = state.history.some(w => w.updatedAt > syncStartTime);
        });
      },

      mergeRemoteWorkouts: (remote) => {
        set((state) => {
          const localIds = new Set(state.history.map((w) => w._id));
          const newEntries = remote.filter((w) => !localIds.has(w._id));
          if (newEntries.length > 0) {
            state.history.push(...newEntries);
            // Re-sort newest first.
            state.history.sort((a, b) => {
              const aTime = a.completedAt
                ? new Date(a.completedAt).getTime()
                : 0;
              const bTime = b.completedAt
                ? new Date(b.completedAt).getTime()
                : 0;
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
