import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { zustandAsyncStorage } from "@/storage/mmkv";
import { USER_ID } from "@/constants/user";
import { generateId } from "@/utils/id";
import type { Program, ProgramExercise } from "@/types";

interface ProgramState {
  programs: Program[];
  deletedProgramIds: string[];
  isDirty: boolean;
  lastSyncedAt: number | null;
}

interface ProgramActions {
  addProgram: (name: string, exercises: ProgramExercise[]) => void;
  updateProgram: (id: string, updates: Partial<Program>) => void;
  deleteProgram: (id: string) => void;
  getProgramById: (id: string) => Program | undefined;
  markDirty: () => void;
  clearDeletedPrograms: (ids: string[]) => void;
  applySyncMerge: (remote: Program[], syncStartTime: number) => void;
  repairCorruptedData: () => void;
}

export const useProgramStore = create<ProgramState & ProgramActions>()(
  persist(
    immer((set, get) => ({
      programs: [],
      deletedProgramIds: [],
      isDirty: false,
      lastSyncedAt: null,

      repairCorruptedData: () => {
        set((state) => {
          state.programs.forEach((p) => {
            // Fix case where 'name' accidentally became an object during a bad update
            if (typeof p.name === "object" && p.name !== null) {
              const corrupted = p.name as any;
              p.name = corrupted.name || "Untitled Program";
              if (corrupted.exercises && (!p.exercises || p.exercises.length === 0)) {
                p.exercises = corrupted.exercises;
              }
            }
            // Ensure exercises is always an array
            if (!p.exercises) {
              p.exercises = [];
            }
          });
        });
      },

      addProgram: (name, exercises) => {
        const newProgram: Program = {
          _id: generateId(),
          userId: USER_ID,
          name,
          exercises,
          createdAt: new Date().toISOString(),
          updatedAt: Date.now(),
        };
        set((state) => {
          state.programs.push(newProgram);
          state.isDirty = true;
        });
      },

      updateProgram: (id, updates) => {
        const oldProgram = get().programs.find(p => p._id === id);
        if (!oldProgram) return;

        if (updates.exercises) {
          const { useWorkoutSessionStore } = require("./workoutSessionStore");
          const workoutStore = useWorkoutSessionStore.getState();

          updates.exercises.forEach(newEx => {
            const oldEx = oldProgram.exercises.find(e => e.id === newEx.id);
            if (oldEx && oldEx.name.toLowerCase() !== newEx.name.toLowerCase()) {
              workoutStore.renameExerciseInHistory(oldEx.name, newEx.name);
            }
          });
        }

        set((state) => {
          const index = state.programs.findIndex((p) => p._id === id);
          if (index !== -1) {
            const current = state.programs[index];
            if (updates.name !== undefined) current.name = updates.name;
            if (updates.exercises !== undefined) current.exercises = updates.exercises;
            current.updatedAt = Date.now();
            state.isDirty = true;
          }
        });
      },

      deleteProgram: (id) => {
        set((state) => {
          const program = state.programs.find(p => p._id === id);
          if (program) {
            program.deletedAt = Date.now();
            program.updatedAt = Date.now();
          }
          if (!state.deletedProgramIds.includes(id)) {
            state.deletedProgramIds.push(id);
          }
          state.isDirty = true;
        });
      },

      getProgramById: (id) => {
        return get().programs.find((p) => p._id === id && !p.deletedAt);
      },

      markDirty: () => {
        set((state) => {
          state.isDirty = true;
        });
      },

      clearDeletedPrograms: (ids) => {
        set((state) => {
          state.deletedProgramIds = state.deletedProgramIds.filter(id => !ids.includes(id));
          state.programs = state.programs.filter(p => !ids.includes(p._id) || !p.deletedAt);
        });
      },

      applySyncMerge: (remote, syncStartTime) => {
        set((state) => {
          const remoteMap = new Map(remote.map((p) => [p._id, p]));
          const merged = new Map<string, Program>();
          const lastSync = state.lastSyncedAt || 0;

          for (const lp of state.programs) {
            const rp = remoteMap.get(lp._id);
            if (!rp) {
              if (lp.updatedAt > lastSync || !lp.deletedAt) {
                merged.set(lp._id, lp);
              }
            } else {
              const winner = lp.updatedAt >= rp.updatedAt ? lp : rp;
              if (!winner.deletedAt) {
                merged.set(lp._id, winner);
              }
              remoteMap.delete(lp._id);
            }
          }

          for (const rp of remoteMap.values()) {
            if (!rp.deletedAt) {
              merged.set(rp._id, rp);
            }
          }

          state.programs = Array.from(merged.values());
          state.lastSyncedAt = syncStartTime;
          state.isDirty = state.programs.some(p => p.updatedAt > syncStartTime) || state.deletedProgramIds.length > 0;
        });
      },
    })),
    {
      name: "program-store",
      storage: createJSONStorage(() => zustandAsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.repairCorruptedData();
        }
      },
    }
  )
);
