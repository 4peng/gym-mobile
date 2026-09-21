// ──────────────────────────────────────────────
// Sync Store
// ──────────────────────────────────────────────
// Reactive Zustand wrapper around the sync engine.
// Exposes `isSyncing`, `lastSyncAttempt`, and a
// `runFullSync` action the UI can call directly.

import { create } from "zustand";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { runFullSync as engineRunFullSync } from "@/lib/api/sync";
import { useProgramStore } from "@/stores/programStore";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";

const APP_STORAGE_KEYS = [
  "program-store",
  "workout-session-store",
  "workout-stats-index-v1", // legacy stats index left on disk by older builds
] as const;
const APP_STORAGE_PREFIXES = ["workout_"] as const;

interface SyncState {
  isSyncing: boolean;
  isManualSync: boolean; // True only when triggered by pull-to-refresh
  lastSyncAttempt: number | null;
  lastSyncSuccess: boolean | null;
}

interface SyncActions {
  /**
   * Trigger a full sync. Updates reactive state so the UI can
   * show spinners / success indicators.
   */
  runFullSync: (manual?: boolean) => Promise<boolean>;
  /**
   * Silent background sync. Does not update isSyncing state.
   */
  backgroundSync: () => Promise<boolean>;
  /**
   * Clears local cache and re-downloads everything from the server.
   * Useful when the database has been manually cleaned.
   */
  forceResync: () => Promise<boolean>;
}

export const useSyncStore = create<SyncState & SyncActions>()((set, get) => ({
  isSyncing: false,
  isManualSync: false,
  lastSyncAttempt: null,
  lastSyncSuccess: null,

  runFullSync: async (manual = false) => {
    if (get().isSyncing) return false;

    set({ 
      isSyncing: true, 
      isManualSync: manual, 
      lastSyncAttempt: Date.now() 
    });

    try {
      const success = await engineRunFullSync();
      set({ isSyncing: false, isManualSync: false, lastSyncSuccess: success });
      return success;
    } catch (err) {
      console.error("Full sync failed:", err);
      set({ isSyncing: false, isManualSync: false, lastSyncSuccess: false });
      return false;
    }
  },

  backgroundSync: async () => {
    try {
      return await engineRunFullSync();
    } catch (err) {
      console.error("Background sync failed:", err);
      return false;
    }
  },

  forceResync: async () => {
    if (get().isSyncing) return false;
    set({ isSyncing: true, isManualSync: true, lastSyncAttempt: Date.now() });

    try {
      // 1. Remove only app-owned keys to avoid wiping unrelated app/SDK state.
      const allKeys = await AsyncStorage.getAllKeys();
      const appKeys = allKeys.filter((key) => {
        if ((APP_STORAGE_KEYS as readonly string[]).includes(key)) return true;
        return (APP_STORAGE_PREFIXES as readonly string[]).some((prefix) => key.startsWith(prefix));
      });
      if (appKeys.length > 0) {
        await AsyncStorage.multiRemove(appKeys);
      }

      // 2. Reset in-memory state
      // Custom exercises and pinned exercise names are local-only and have
      // no server source, so they must survive a resync rather than being wiped.
      const { pinnedExerciseNames } = useWorkoutSessionStore.getState();
      useProgramStore.setState({
        programs: [],
        deletedProgramIds: [],
        isDirty: false,
        lastSyncedAt: null,
      });
      useWorkoutSessionStore.setState({
        activeSession: null,
        history: [],
        historyIndex: [],
        deletedWorkoutIds: [],
        dirtyWorkoutIds: [],
        hasMoreHistory: true,
        activeRestTimer: null,
        pinnedExerciseNames,
        isDirty: false,
        lastSyncedAt: null,
      });

      // 3. Run sync (it will now be a full sync because local is empty)
      const success = await engineRunFullSync();
      set({ isSyncing: false, isManualSync: false, lastSyncSuccess: success });
      
      return success;
    } catch (err) {
      console.error("Force resync failed:", err);
      set({ isSyncing: false, isManualSync: false, lastSyncSuccess: false });
      return false;
    }
  },
}));
