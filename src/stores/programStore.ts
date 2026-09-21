import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { zustandAsyncStorage } from "@/storage/asyncStorage";
import { USER_ID } from "@/constants/user";
import { generateId } from "@/utils/id";
import type { Program, ProgramExercise } from "@/types";
import { normalizeExercises } from "@/shared/programs.js";

const STORE_VERSION = 7;

interface ProgramState {
  programs: Program[];
  /** Programs changed locally and not yet backed up. */
  dirtyProgramIds: string[];
  /** Programs deleted locally and not yet deleted in the cloud. */
  deletedProgramIds: string[];
}

interface ProgramActions {
  addProgram: (name: string, exercises: ProgramExercise[]) => void;
  updateProgram: (
    id: string,
    updates: Partial<Pick<Program, "name" | "exercises" | "pinned">>,
  ) => void;
  deleteProgram: (id: string) => void;
  togglePin: (id: string) => void;
  renameExerciseDefinitionReferences: (exerciseDefinitionId: string, nextName: string) => void;
  removeExerciseDefinitionReferences: (exerciseDefinitionId: string) => void;
  getProgramById: (id: string) => Program | undefined;
  /** Replaces every program (cloud restore); nothing is left pending. */
  importPrograms: (programs: Program[]) => void;
  clearDeletedPrograms: (ids: string[]) => void;
  /** Clears push bookkeeping, keeping any id edited after `pushedAt`. */
  clearDirtyPrograms: (ids: string[], pushedAt: number) => void;
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
  };
}

const addUnique = (list: string[], id: string) => {
  if (!list.includes(id)) list.push(id);
};

/** Applies `mutate` to every exercise of every program; dirties the ones that changed. */
function rewriteProgramExerciseRefs(
  state: ProgramState,
  mutate: (exercise: ProgramExercise) => boolean,
) {
  state.programs.forEach((program) => {
    let changed = false;
    program.exercises.forEach((ex) => {
      if (mutate(ex)) changed = true;
    });
    if (!changed) return;
    program.updatedAt = Date.now();
    addUnique(state.dirtyProgramIds, program._id);
  });
}

export const useProgramStore = create<ProgramState & ProgramActions>()(
  persist(
    immer((set, get) => {
      const withProgram = (id: string, recipe: (program: Program) => void) =>
        set((state) => {
          const program = state.programs.find((p) => p._id === id);
          if (!program) return;
          recipe(program);
          program.updatedAt = Date.now();
          addUnique(state.dirtyProgramIds, id);
        });

      return {
        programs: [],
        dirtyProgramIds: [],
        deletedProgramIds: [],

        addProgram: (name, exercises) => {
          const program: Program = {
            _id: generateId(),
            userId: USER_ID,
            name,
            exercises,
            createdAt: new Date().toISOString(),
            updatedAt: Date.now(),
          };
          set((state) => {
            state.programs.push(program);
            addUnique(state.dirtyProgramIds, program._id);
          });
        },

        updateProgram: (id, updates) =>
          withProgram(id, (program) => {
            if (updates.name !== undefined) program.name = updates.name;
            if (updates.exercises !== undefined) program.exercises = updates.exercises;
            if (updates.pinned !== undefined) program.pinned = updates.pinned;
          }),

        deleteProgram: (id) =>
          set((state) => {
            state.programs = state.programs.filter((p) => p._id !== id);
            state.dirtyProgramIds = state.dirtyProgramIds.filter((d) => d !== id);
            addUnique(state.deletedProgramIds, id);
          }),

        togglePin: (id) =>
          withProgram(id, (program) => {
            program.pinned = !program.pinned;
          }),

        renameExerciseDefinitionReferences: (exerciseDefinitionId, nextName) => {
          const defId = String(exerciseDefinitionId).trim();
          const name = String(nextName).trim();
          if (!defId || !name) return;
          set((state) =>
            rewriteProgramExerciseRefs(state, (ex) => {
              if (ex.exerciseDefinitionId !== defId || ex.name === name) return false;
              ex.name = name;
              return true;
            }),
          );
        },

        removeExerciseDefinitionReferences: (exerciseDefinitionId) => {
          const defId = String(exerciseDefinitionId).trim();
          if (!defId) return;
          set((state) =>
            rewriteProgramExerciseRefs(state, (ex) => {
              if (ex.exerciseDefinitionId !== defId) return false;
              ex.exerciseDefinitionId = "";
              return true;
            }),
          );
        },

        getProgramById: (id) => get().programs.find((p) => p._id === id),

        importPrograms: (programs) =>
          set((state) => {
            state.programs = programs.map(normalizeProgram);
            state.dirtyProgramIds = [];
            state.deletedProgramIds = [];
          }),

        clearDeletedPrograms: (ids) =>
          set((state) => {
            state.deletedProgramIds = state.deletedProgramIds.filter((id) => !ids.includes(id));
          }),

        clearDirtyPrograms: (ids, pushedAt) => {
          if (ids.length === 0) return;
          set((state) => {
            state.dirtyProgramIds = state.dirtyProgramIds.filter((id) => {
              if (!ids.includes(id)) return true;
              const program = state.programs.find((p) => p._id === id);
              return !!program && program.updatedAt > pushedAt;
            });
          });
        },
      };
    }),
    {
      name: "program-store",
      storage: createJSONStorage(() => zustandAsyncStorage),
      version: STORE_VERSION,
      // v7 dropped tombstones (deletedAt) and the sync watermark; a pending
      // delete is only ever an id in deletedProgramIds now.
      migrate: (persistedState) => {
        const s = persistedState as Partial<ProgramState & { lastSyncedAt?: number }> | undefined;
        const ids = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
        const programs = Array.isArray(s?.programs)
          ? (s!.programs as unknown[])
              .filter((p) => !(p as { deletedAt?: unknown })?.deletedAt)
              .map(normalizeProgram)
          : [];
        return {
          programs,
          dirtyProgramIds: ids(s?.dirtyProgramIds),
          deletedProgramIds: ids(s?.deletedProgramIds),
        } as ProgramState;
      },
    },
  ),
);
