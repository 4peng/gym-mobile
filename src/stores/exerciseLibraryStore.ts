import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandAsyncStorage } from "@/storage/mmkv";
import { generateId } from "@/utils/id";
import type { ExerciseDefinition } from "@/types";
import type { MuscleGroup } from "@/constants/muscles";
import { normalizeExerciseDisplayName as normalizeName } from "@/utils/exerciseIdentity";

interface ExerciseLibraryState {
  customExercises: ExerciseDefinition[];
}

interface ExerciseLibraryActions {
  addCustomExercise: (name: string, muscles?: MuscleGroup[]) => ExerciseDefinition;
  renameCustomExercise: (id: string, name: string) => ExerciseDefinition | null;
  removeCustomExercise: (id: string) => void;
  updateCustomExerciseMuscles: (id: string, muscles: MuscleGroup[]) => void;
}

function normalizeCustomExercise(raw: unknown): ExerciseDefinition | null {
  const r = raw as Record<string, unknown> | null | undefined;
  const name = typeof r?.name === "string" ? r.name.trim() : "";
  const id = typeof r?.id === "string" ? r.id.trim() : "";
  if (!name || !id) return null;

  return {
    id,
    name,
    muscles: Array.isArray(r?.muscles) ? (r.muscles as MuscleGroup[]) : [],
    aliases: Array.isArray(r?.aliases) ? (r.aliases as string[]) : [],
    isCustom: true,
  };
}

export function matchesCustomExerciseNameOrAlias(
  exercise: ExerciseDefinition,
  normalizedName: string,
) {
  const target = normalizedName.toLowerCase();
  if (exercise.name.trim().toLowerCase() === target) return true;

  return (exercise.aliases || []).some((alias) => alias.trim().toLowerCase() === target);
}

export const useExerciseLibraryStore = create<ExerciseLibraryState & ExerciseLibraryActions>()(
  persist(
    (set, get) => ({
      customExercises: [],

      addCustomExercise: (name, muscles = []) => {
        const normalizedName = normalizeName(name);
        const existing = get().customExercises.find((exercise) =>
          matchesCustomExerciseNameOrAlias(exercise, normalizedName),
        );
        if (existing) {
          return existing;
        }

        const next: ExerciseDefinition = {
          id: `custom-${generateId()}`,
          name: normalizedName,
          muscles: [...muscles],
          aliases: [],
          isCustom: true,
        };

        set((state) => ({
          customExercises: [next, ...state.customExercises],
        }));

        return next;
      },

      renameCustomExercise: (id, name) => {
        const normalizedName = normalizeName(name);
        if (!normalizedName) return null;

        const current = get().customExercises.find((exercise) => exercise.id === id);
        if (!current) return null;

        const conflicting = get().customExercises.find(
          (exercise) =>
            exercise.id !== id && matchesCustomExerciseNameOrAlias(exercise, normalizedName),
        );
        if (conflicting) {
          return null;
        }

        const nextAliases = Array.from(
          new Set(
            [current.name, ...(current.aliases || [])].filter(
              (alias) => alias.trim().toLowerCase() !== normalizedName.toLowerCase(),
            ),
          ),
        );

        const renamed: ExerciseDefinition = {
          ...current,
          name: normalizedName,
          aliases: nextAliases,
        };

        set((state) => ({
          customExercises: state.customExercises.map((exercise) =>
            exercise.id === id ? renamed : exercise,
          ),
        }));

        return renamed;
      },

      updateCustomExerciseMuscles: (id, muscles) => {
        set((state) => ({
          customExercises: state.customExercises.map((exercise) =>
            exercise.id === id ? { ...exercise, muscles: [...muscles] } : exercise,
          ),
        }));
      },

      removeCustomExercise: (id) => {
        set((state) => ({
          customExercises: state.customExercises.filter((exercise) => exercise.id !== id),
        }));
      },
    }),
    {
      name: "exercise-library-store",
      storage: createJSONStorage(() => zustandAsyncStorage),
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as Partial<ExerciseLibraryState> | undefined;
        return {
          customExercises: Array.isArray(state?.customExercises)
            ? state.customExercises
                .map(normalizeCustomExercise)
                .filter((exercise): exercise is ExerciseDefinition => exercise !== null)
            : [],
        } as ExerciseLibraryState;
      },
    },
  ),
);
