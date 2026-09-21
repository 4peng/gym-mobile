import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { zustandAsyncStorage } from "@/storage/mmkv";
import { USER_ID } from "@/constants/user";
import { generateId } from "@/utils/id";
import { nextLocalUpdatedAt } from "@/utils/timestamps";
import type { Program, ProgramExercise } from "@/types";
import { normalizeExercises } from "@/shared/programs.js";

const PROGRAM_STORE_VERSION = 6;

interface ProgramState {
  programs: Program[];
  deletedProgramIds: string[];
  dirtyProgramIds: string[];
  isDirty: boolean;
  lastSyncedAt: number | null;
}

interface ProgramActions {
  addProgram: (name: string, exercises: ProgramExercise[]) => void;
  updateProgram: (id: string, updates: Partial<Program>) => void;
  deleteProgram: (id: string) => void;
  togglePin: (id: string) => void;
  renameExerciseDefinitionReferences: (exerciseDefinitionId: string, nextName: string) => void;
  removeExerciseDefinitionReferences: (exerciseDefinitionId: string) => void;
  getProgramById: (id: string) => Program | undefined;
  clearDeletedPrograms: (ids: string[]) => void;
  clearDirtyPrograms: (ids: string[], pushedAt: number) => void;
  applySyncMerge: (remote: Program[], syncStartTime: number) => void;
}

function normalizeProgram(raw: unknown): Program {
  const r = raw as Record<string, unknown> | null | undefined;
  return {
    _id: String(r?._id ?? generateId()),
    userId: String(r?.userId ?? USER_ID),
    name: typeof r?.name === "string" ? r.name : "Untitled Program",
    exercises: normalizeExercises(
      Array.isArray(r?.exercises) ? (r.exercises as any[]) : [],
      generateId,
    ),
    pinned: typeof r?.pinned === "boolean" ? r.pinned : undefined,
    createdAt: typeof r?.createdAt === "string" ? r.createdAt : new Date().toISOString(),
    updatedAt:
      typeof r?.updatedAt === "number" && Number.isFinite(r.updatedAt) ? r.updatedAt : Date.now(),
    deletedAt: typeof r?.deletedAt === "number" || r?.deletedAt === null ? r.deletedAt : undefined,
  };
}

/** Applies `mutate` to every exercise of every live program; dirties the ones that changed. */
function rewriteProgramExerciseRefs(
  state: ProgramState,
  updatedAt: number,
  mutate: (exercise: ProgramExercise) => boolean,
) {
  state.programs.forEach((program) => {
    if (program.deletedAt) return; // don't re-dirty tombstoned programs
    let changed = false;
    program.exercises.forEach((ex) => {
      if (mutate(ex)) changed = true;
    });
    if (!changed) return;
    program.updatedAt = updatedAt;
    // syncPrograms pushes strictly by dirtyProgramIds; an updatedAt bump alone never syncs.
    if (!state.dirtyProgramIds.includes(program._id)) state.dirtyProgramIds.push(program._id);
    state.isDirty = true;
  });
}

export const useProgramStore = create<ProgramState & ProgramActions>()(
  persist(
    immer((set, get) => ({
      programs: [],
      deletedProgramIds: [],
      dirtyProgramIds: [],
      isDirty: false,
      lastSyncedAt: null,

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
          if (!state.dirtyProgramIds.includes(newProgram._id)) {
            state.dirtyProgramIds.push(newProgram._id);
          }
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
            if (!state.dirtyProgramIds.includes(id)) {
              state.dirtyProgramIds.push(id);
            }
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
          state.dirtyProgramIds = state.dirtyProgramIds.filter((dirtyId) => dirtyId !== id);
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
            if (!state.dirtyProgramIds.includes(id)) {
              state.dirtyProgramIds.push(id);
            }
            state.isDirty = true;
          }
        });
      },

      renameExerciseDefinitionReferences: (exerciseDefinitionId, nextName) => {
        const defId = String(exerciseDefinitionId).trim();
        const name = String(nextName).trim();
        if (!defId || !name) return;
        const updatedAt = nextLocalUpdatedAt(get().lastSyncedAt);
        set((state) =>
          rewriteProgramExerciseRefs(state, updatedAt, (ex) => {
            if (ex.exerciseDefinitionId !== defId || ex.name === name) return false;
            ex.name = name;
            return true;
          }),
        );
      },

      removeExerciseDefinitionReferences: (exerciseDefinitionId) => {
        const defId = String(exerciseDefinitionId).trim();
        if (!defId) return;
        const updatedAt = nextLocalUpdatedAt(get().lastSyncedAt);
        set((state) =>
          rewriteProgramExerciseRefs(state, updatedAt, (ex) => {
            if (ex.exerciseDefinitionId !== defId) return false;
            ex.exerciseDefinitionId = "";
            return true;
          }),
        );
      },

      getProgramById: (id) => {
        return get().programs.find((p) => p._id === id && !p.deletedAt);
      },

      clearDeletedPrograms: (ids) => {
        set((state) => {
          state.deletedProgramIds = state.deletedProgramIds.filter((id) => !ids.includes(id));
          state.programs = state.programs.filter((p) => !ids.includes(p._id) || !p.deletedAt);
        });
      },

      clearDirtyPrograms: (ids, pushedAt) => {
        set((state) => {
          if (ids.length === 0) return;
          state.dirtyProgramIds = state.dirtyProgramIds.filter((id) => {
            if (!ids.includes(id)) return true;
            const program = state.programs.find((p) => p._id === id);
            // Keep the id dirty if it was edited again after the snapshot we
            // just pushed — otherwise that later edit would never get pushed.
            return !!program && program.updatedAt > pushedAt;
          });
          state.isDirty = state.dirtyProgramIds.length > 0 || state.deletedProgramIds.length > 0;
        });
      },

      applySyncMerge: (remote, syncStartTime) => {
        set((state) => {
          if (remote.length === 0) {
            state.lastSyncedAt = syncStartTime;
            state.isDirty = state.dirtyProgramIds.length > 0 || state.deletedProgramIds.length > 0;
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
          state.isDirty = state.dirtyProgramIds.length > 0 || state.deletedProgramIds.length > 0;
        });
      },
    })),
    {
      name: "program-store",
      storage: createJSONStorage(() => zustandAsyncStorage),
      version: PROGRAM_STORE_VERSION,
      migrate: (persistedState) => {
        const state = persistedState as Partial<ProgramState> | undefined;
        const programs = Array.isArray(state?.programs)
          ? state!.programs.map(normalizeProgram)
          : [];
        const deletedProgramIds = Array.isArray(state?.deletedProgramIds)
          ? state!.deletedProgramIds.map((id) => String(id)).filter((id) => id.length > 0)
          : [];
        const lastSyncedAt =
          typeof state?.lastSyncedAt === "number" && Number.isFinite(state.lastSyncedAt)
            ? state.lastSyncedAt
            : null;
        // dirtyProgramIds was introduced in v6. When upgrading from an older
        // persisted state that predates it, backfill from the previous
        // watermark criterion (updatedAt > lastSyncedAt) so a pending offline
        // edit made on the old build is not silently dropped at the version
        // boundary (syncPrograms now pushes strictly by dirtyProgramIds).
        const dirtyProgramIds = Array.isArray(state?.dirtyProgramIds)
          ? state!.dirtyProgramIds.map((id) => String(id)).filter((id) => id.length > 0)
          : programs
              .filter((p) => !p.deletedAt && p.updatedAt > (lastSyncedAt || 0))
              .map((p) => p._id);
        return {
          programs,
          deletedProgramIds,
          dirtyProgramIds,
          isDirty: dirtyProgramIds.length > 0 || deletedProgramIds.length > 0,
          lastSyncedAt,
        } as ProgramState;
      },
    },
  ),
);
