import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandAsyncStorage } from "@/storage/mmkv";

interface UiPreferencesState {
  showDetailedMuscleGroups: boolean;
}

interface UiPreferencesActions {
  toggleDetailedMuscleGroups: () => void;
  setDetailedMuscleGroups: (enabled: boolean) => void;
}

export const useUiPreferencesStore = create<
  UiPreferencesState & UiPreferencesActions
>()(
  persist(
    (set) => ({
      showDetailedMuscleGroups: false,
      toggleDetailedMuscleGroups: () =>
        set((state) => ({
          showDetailedMuscleGroups: !state.showDetailedMuscleGroups,
        })),
      setDetailedMuscleGroups: (enabled) =>
        set({ showDetailedMuscleGroups: enabled }),
    }),
    {
      name: "ui-preferences-store",
      storage: createJSONStorage(() => zustandAsyncStorage),
      partialize: (state) => ({
        showDetailedMuscleGroups: state.showDetailedMuscleGroups,
      }),
    }
  )
);
