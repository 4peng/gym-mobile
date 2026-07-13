import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandAsyncStorage } from "@/storage/mmkv";
import { convertWeight } from "@/utils/conversions";

interface UiPreferencesState {
  showDetailedMuscleGroups: boolean;
  analyticsBodyweight: number | null;
  analyticsBodyweightUnit: "kg" | "lbs";
  preferredWeightUnit: "kg" | "lbs";
}

interface UiPreferencesActions {
  toggleDetailedMuscleGroups: () => void;
  setDetailedMuscleGroups: (enabled: boolean) => void;
  setAnalyticsBodyweight: (bodyweight: number | null) => void;
  toggleAnalyticsBodyweightUnit: () => void;
  setPreferredWeightUnit: (unit: "kg" | "lbs") => void;
}

export const useUiPreferencesStore = create<
  UiPreferencesState & UiPreferencesActions
>()(
  persist(
    (set, get) => ({
      showDetailedMuscleGroups: false,
      analyticsBodyweight: null,
      analyticsBodyweightUnit: "kg",
      preferredWeightUnit: "kg",
      toggleDetailedMuscleGroups: () =>
        set((state) => ({
          showDetailedMuscleGroups: !state.showDetailedMuscleGroups,
        })),
      setDetailedMuscleGroups: (enabled) =>
        set({ showDetailedMuscleGroups: enabled }),
      setAnalyticsBodyweight: (analyticsBodyweight) =>
        set({ analyticsBodyweight }),
      toggleAnalyticsBodyweightUnit: () => {
        const { analyticsBodyweight, analyticsBodyweightUnit } = get();
        const nextUnit = analyticsBodyweightUnit === "lbs" ? "kg" : "lbs";
        set({
          analyticsBodyweightUnit: nextUnit,
          analyticsBodyweight:
            analyticsBodyweight === null
              ? null
              : convertWeight(analyticsBodyweight, analyticsBodyweightUnit, nextUnit),
        });
      },
      setPreferredWeightUnit: (preferredWeightUnit) =>
        set({ preferredWeightUnit }),
    }),
    {
      name: "ui-preferences-store",
      storage: createJSONStorage(() => zustandAsyncStorage),
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as Partial<UiPreferencesState> | undefined;
        return {
          showDetailedMuscleGroups: !!state?.showDetailedMuscleGroups,
          analyticsBodyweight:
            typeof state?.analyticsBodyweight === "number" &&
            Number.isFinite(state.analyticsBodyweight)
              ? state.analyticsBodyweight
              : null,
          analyticsBodyweightUnit: state?.analyticsBodyweightUnit === "lbs" ? "lbs" : "kg",
          preferredWeightUnit: state?.preferredWeightUnit === "lbs" ? "lbs" : "kg",
        } as UiPreferencesState;
      },
      partialize: (state) => ({
        showDetailedMuscleGroups: state.showDetailedMuscleGroups,
        analyticsBodyweight: state.analyticsBodyweight,
        analyticsBodyweightUnit: state.analyticsBodyweightUnit,
        preferredWeightUnit: state.preferredWeightUnit,
      }),
    }
  )
);
