import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { zustandAsyncStorage } from "@/storage/mmkv";
import { USER_ID } from "@/constants/user";
import { generateId } from "@/utils/id";
import type { Program, ProgramExercise } from "@/types";

const PROGRAM_STORE_VERSION = 4;

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
  togglePin: (id: string) => void;
  getProgramById: (id: string) => Program | undefined;
  markDirty: () => void;
  clearDeletedPrograms: (ids: string[]) => void;
  applySyncMerge: (remote: Program[], syncStartTime: number) => void;
  repairCorruptedData: () => void;
}

function nextLocalUpdatedAt(lastSyncedAt: number | null): number {
  const now = Date.now();
  return typeof lastSyncedAt === "number" ? Math.max(now, lastSyncedAt + 1) : now;
}

function normalizeProgram(raw: any): Program {
  return {
    _id: String(raw?._id ?? generateId()),
    userId: String(raw?.userId ?? USER_ID),
    name: typeof raw?.name === "string" ? raw.name : "Untitled Program",
    exercises: Array.isArray(raw?.exercises) ? raw.exercises : [],
    pinned: typeof raw?.pinned === "boolean" ? raw.pinned : undefined,
    createdAt:
      typeof raw?.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    updatedAt:
      typeof raw?.updatedAt === "number" && Number.isFinite(raw.updatedAt)
        ? raw.updatedAt
        : Date.now(),
    deletedAt:
      typeof raw?.deletedAt === "number" || raw?.deletedAt === null
        ? raw.deletedAt
        : undefined,
  };
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
            if (typeof p.name === "object" && p.name !== null) {
              const corrupted = p.name as any;
              p.name = corrupted.name || "Untitled Program";
              if (corrupted.exercises && (!p.exercises || p.exercises.length === 0)) {
                p.exercises = corrupted.exercises;
              }
            }
            if (!p.exercises) {
              p.exercises = [];
            }
          });
        });
      },

      addProgram: (name, exercises) => {
        const updatedAt = nextLocalUpdatedAt(get().lastSyncedAt);
        const newProgram: Program = {
          _id: generateId(),
          userId: USER_ID,
          name,
          exercises,
          createdAt: new Date().toISOString(),
          updatedAt,
        };
        set((state) => {
          state.programs.push(newProgram);
          state.isDirty = true;
        });
      },

      updateProgram: (id, updates) => {
        const updatedAt = nextLocalUpdatedAt(get().lastSyncedAt);
        set((state) => {
          const index = state.programs.findIndex((p) => p._id === id);
          if (index !== -1) {
            const current = state.programs[index];
            if (updates.name !== undefined) current.name = updates.name;
            if (updates.exercises !== undefined) current.exercises = updates.exercises;
            if (updates.pinned !== undefined) current.pinned = updates.pinned;
            current.updatedAt = updatedAt;
            state.isDirty = true;
          }
        });
      },

      deleteProgram: (id) => {
        const updatedAt = nextLocalUpdatedAt(get().lastSyncedAt);
        set((state) => {
          const program = state.programs.find((p) => p._id === id);
          if (program) {
            program.deletedAt = updatedAt;
            program.updatedAt = updatedAt;
          }
          if (!state.deletedProgramIds.includes(id)) {
            state.deletedProgramIds.push(id);
          }
          state.isDirty = true;
        });
      },

      togglePin: (id) => {
        const updatedAt = nextLocalUpdatedAt(get().lastSyncedAt);
        set((state) => {
          const program = state.programs.find((p) => p._id === id);
          if (program) {
            program.pinned = !program.pinned;
            program.updatedAt = updatedAt;
            state.isDirty = true;
          }
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
          state.deletedProgramIds = state.deletedProgramIds.filter((id) => !ids.includes(id));
          state.programs = state.programs.filter((p) => !ids.includes(p._id) || !p.deletedAt);
        });
      },

      applySyncMerge: (remote, syncStartTime) => {
        set((state) => {
          if (remote.length === 0) {
            state.lastSyncedAt = syncStartTime;
            state.isDirty =
              state.programs.some((p) => p.updatedAt > syncStartTime) ||
              state.deletedProgramIds.length > 0;
            return;
          }

          const remoteMap = new Map(remote.map((p) => [p._id, p]));
          let historyChanged = false;

          for (let i = 0; i < state.programs.length; i++) {
            const lp = state.programs[i];
            const rp = remoteMap.get(lp._id);

            if (rp) {
              const winner = lp.updatedAt >= rp.updatedAt ? lp : rp;
              state.programs[i] = winner;
              remoteMap.delete(lp._id);
              historyChanged = true;
            }
          }

          if (remoteMap.size > 0) {
            for (const rp of remoteMap.values()) {
              if (!rp.deletedAt) {
                state.programs.push(rp);
                historyChanged = true;
              }
            }
          }

          if (historyChanged) {
            state.programs = state.programs.filter((p) => !p.deletedAt);
          }

          state.lastSyncedAt = syncStartTime;
          state.isDirty =
            state.programs.some((p) => p.updatedAt > syncStartTime) ||
            state.deletedProgramIds.length > 0;
        });
      },
    })),
    {
      name: "program-store",
      storage: createJSONStorage(() => zustandAsyncStorage),
      version: PROGRAM_STORE_VERSION,
      migrate: (persistedState) => {
        const state = persistedState as Partial<ProgramState> | undefined;
        return {
          programs: Array.isArray(state?.programs)
            ? state!.programs.map(normalizeProgram)
            : [],
          deletedProgramIds: Array.isArray(state?.deletedProgramIds)
            ? state!.deletedProgramIds
                .map((id) => String(id))
                .filter((id) => id.length > 0)
            : [],
          isDirty: !!state?.isDirty,
          lastSyncedAt:
            typeof state?.lastSyncedAt === "number" && Number.isFinite(state.lastSyncedAt)
              ? state.lastSyncedAt
              : null,
        } as ProgramState;
      },
    }
  )
);
