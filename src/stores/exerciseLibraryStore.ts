import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandAsyncStorage } from "@/storage/mmkv";
import { generateId } from "@/utils/id";
import type { ExerciseDefinition } from "@/types";
import type { MuscleGroup } from "@/constants/muscles";

interface ExerciseLibraryState {
  customExercises: ExerciseDefinition[];
}

interface ExerciseLibraryActions {
  addCustomExercise: (name: string, muscles?: MuscleGroup[]) => ExerciseDefinition;
  updateCustomExerciseMuscles: (id: string, muscles: MuscleGroup[]) => void;
}

function normalizeCustomExercise(raw: any): ExerciseDefinition | null {
  const name = typeof raw?.name === "string" ? raw.name.trim() : "";
  const id = typeof raw?.id === "string" ? raw.id.trim() : "";
  if (!name || !id) return null;

  return {
    id,
    name,
    muscles: Array.isArray(raw?.muscles) ? raw.muscles : [],
    aliases: Array.isArray(raw?.aliases) ? raw.aliases : [],
    isCustom: true,
  };
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export const useExerciseLibraryStore = create<
  ExerciseLibraryState & ExerciseLibraryActions
>()(
  persist(
    (set, get) => ({
      customExercises: [],

      addCustomExercise: (name, muscles = []) => {
        const normalizedName = normalizeName(name);
        const existing = get().customExercises.find(
          (exercise) => exercise.name.toLowerCase() === normalizedName.toLowerCase()
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

      updateCustomExerciseMuscles: (id, muscles) => {
        set((state) => ({
          customExercises: state.customExercises.map((exercise) =>
            exercise.id === id ? { ...exercise, muscles: [...muscles] } : exercise
          ),
        }));
      },
    }),
    {
      name: "exercise-library-store",
      storage: createJSONStorage(() => zustandAsyncStorage),
      version: 1,
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
    }
  )
);
