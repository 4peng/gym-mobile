import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { zustandAsyncStorage } from "@/storage/mmkv";
import { USER_ID } from "@/constants/user";
import { generateId } from "@/utils/id";
import type { Program, ProgramExercise } from "@/types";

// ──────────────────────────────────────────────
// Exercise input (no id — assigned by store)
// ──────────────────────────────────────────────

export interface ExerciseInput {
  name: string;
  defaultSets: number;
  restSeconds: number;
  notes: string;
  weightUnit?: "kg" | "lbs";
}

// ──────────────────────────────────────────────
// State shape
// ──────────────────────────────────────────────

interface ProgramState {
  programs: Program[];
  /** IDs of programs deleted locally but not yet synced to the server. */
  deletedProgramIds: string[];
  /** True when local programs have un-synced changes. */
  isDirty: boolean;
  /** Epoch-ms of the last successful sync. */
  lastSyncedAt: number | null;
}

interface ProgramActions {
  // ── Program-level CRUD ─────────────────────
  createProgram: (name: string) => string;
  updateProgram: (
    programId: string,
    updates: Partial<Pick<Program, "name">>
  ) => void;
  deleteProgram: (programId: string) => void;
  getProgramById: (id: string) => Program | undefined;

  // ── Exercise-level mutations ───────────────
  addExercise: (programId: string, exercise: ExerciseInput) => void;
  updateExercise: (
    programId: string,
    exerciseId: string,
    updates: Partial<Omit<ProgramExercise, "id">>
  ) => void;
  removeExercise: (programId: string, exerciseId: string) => void;
  toggleExerciseUnit: (programId: string, exerciseId: string) => void;

  // ── Bulk save (used by Create screen) ──────
  addProgramWithExercises: (
    name: string,
    exercises: ExerciseInput[]
  ) => string;

  // ── Sync metadata ─────────────────────────
  markDirty: () => void;
  
  /** Clears the queue of deleted program IDs after a successful sync. */
  clearDeletedPrograms: (ids: string[]) => void;

  /**
   * Applies remote data using last-write-wins against the current state.
   * Resolves race conditions by merging inside the state lock.
   */
  applySyncMerge: (remote: Program[], syncStartTime: number) => void;
}

// ──────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────

export const useProgramStore = create<ProgramState & ProgramActions>()(
  persist(
    immer((set, get) => ({
      programs: [],
      deletedProgramIds: [],
      isDirty: false,
      lastSyncedAt: null,

      // ── Program CRUD ─────────────────────────

      createProgram: (name) => {
        const id = generateId();
        const now = Date.now();
        const program: Program = {
          _id: id,
          userId: USER_ID,
          name,
          exercises: [],
          createdAt: new Date().toISOString(),
          updatedAt: now,
        };
        set((state) => {
          state.programs.push(program);
          state.isDirty = true;
        });
        return id;
      },

      updateProgram: (programId, updates) => {
        set((state) => {
          const prog = state.programs.find((p) => p._id === programId);
          if (!prog) return;
          if (updates.name !== undefined) prog.name = updates.name;
          prog.updatedAt = Date.now();
          state.isDirty = true;
        });
      },

      deleteProgram: (programId) => {
        set((state) => {
          state.programs = state.programs.filter((p) => p._id !== programId);
          if (!state.deletedProgramIds.includes(programId)) {
            state.deletedProgramIds.push(programId);
          }
          state.isDirty = true;
        });
      },

      getProgramById: (id) => {
        return get().programs.find((p) => p._id === id);
      },

      // ── Exercise mutations ───────────────────

      addExercise: (programId, exercise) => {
        set((state) => {
          const prog = state.programs.find((p) => p._id === programId);
          if (!prog) return;
          prog.exercises.push({
            id: generateId(),
            name: exercise.name,
            defaultSets: exercise.defaultSets,
            restSeconds: exercise.restSeconds,
            notes: exercise.notes,
            weightUnit: exercise.weightUnit || "kg",
          });
          prog.updatedAt = Date.now();
          state.isDirty = true;
        });
      },

      updateExercise: (programId, exerciseId, updates) => {
        set((state) => {
          const prog = state.programs.find((p) => p._id === programId);
          if (!prog) return;
          const ex = prog.exercises.find((e) => e.id === exerciseId);
          if (!ex) return;
          if (updates.name !== undefined) ex.name = updates.name;
          if (updates.defaultSets !== undefined)
            ex.defaultSets = updates.defaultSets;
          if (updates.restSeconds !== undefined)
            ex.restSeconds = updates.restSeconds;
          if (updates.notes !== undefined) ex.notes = updates.notes;
          if (updates.weightUnit !== undefined)
            ex.weightUnit = updates.weightUnit;
          prog.updatedAt = Date.now();
          state.isDirty = true;
        });
      },

      removeExercise: (programId, exerciseId) => {
        set((state) => {
          const prog = state.programs.find((p) => p._id === programId);
          if (!prog) return;
          prog.exercises = prog.exercises.filter((e) => e.id !== exerciseId);
          prog.updatedAt = Date.now();
          state.isDirty = true;
        });
      },

      toggleExerciseUnit: (programId, exerciseId) => {
        set((state) => {
          const prog = state.programs.find((p) => p._id === programId);
          if (!prog) return;
          const ex = prog.exercises.find((e) => e.id === exerciseId);
          if (!ex) return;
          ex.weightUnit = ex.weightUnit === "lbs" ? "kg" : "lbs";
          prog.updatedAt = Date.now();
          state.isDirty = true;
        });
      },

      // ── Bulk save ────────────────────────────

      addProgramWithExercises: (name, exercises) => {
        const id = generateId();
        const now = Date.now();
        const program: Program = {
          _id: id,
          userId: USER_ID,
          name,
          exercises: exercises.map((e) => ({
            id: generateId(),
            name: e.name,
            defaultSets: e.defaultSets,
            restSeconds: e.restSeconds,
            notes: e.notes,
            weightUnit: e.weightUnit || "kg",
          })),
          createdAt: new Date().toISOString(),
          updatedAt: now,
        };
        set((state) => {
          state.programs.push(program);
          state.isDirty = true;
        });
        return id;
      },

      // ── Sync metadata ────────────────────────

      markDirty: () => {
        set((state) => {
          state.isDirty = true;
        });
      },

      clearDeletedPrograms: (ids) => {
        set((state) => {
          state.deletedProgramIds = state.deletedProgramIds.filter(id => !ids.includes(id));
        });
      },

      applySyncMerge: (remote, syncStartTime) => {
        set((state) => {
          const remoteMap = new Map(remote.map((p) => [p._id, p]));
          const merged = new Map<string, Program>();
          const lastSync = state.lastSyncedAt || 0;

          // Walk local programs.
          for (const lp of state.programs) {
            const rp = remoteMap.get(lp._id);
            if (!rp) {
              // Exists locally only.
              // If it has unsynced local changes, keep it. Otherwise, it was deleted on the server, so drop it.
              if (lp.updatedAt > lastSync) {
                merged.set(lp._id, lp);
              }
            } else {
              // Both exist — larger updatedAt wins. Tie goes to local.
              merged.set(lp._id, lp.updatedAt >= rp.updatedAt ? lp : rp);
              remoteMap.delete(lp._id);
            }
          }

          // Remaining remote-only programs.
          for (const rp of remoteMap.values()) {
            merged.set(rp._id, rp);
          }

          state.programs = Array.from(merged.values());
          state.lastSyncedAt = syncStartTime;
          
          // Re-evaluate isDirty: true if any program's updatedAt > syncStartTime or there are pending deletions
          state.isDirty = state.programs.some(p => p.updatedAt > syncStartTime) || state.deletedProgramIds.length > 0;
        });
      },
    })),
    {
      name: "program-store",
      storage: createJSONStorage(() => zustandAsyncStorage),
    }
  )
);
