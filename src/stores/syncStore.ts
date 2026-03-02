// ──────────────────────────────────────────────
// Sync Store
// ──────────────────────────────────────────────
// Reactive Zustand wrapper around the sync engine.
// Exposes `isSyncing`, `lastSyncAttempt`, and a
// `runFullSync` action the UI can call directly.

import { create } from "zustand";
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    // Dynamic import inside the function to break circular dependencies
    const { runFullSync: engineRunFullSync } = await import("@/lib/api/sync");

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
    } catch {
      set({ isSyncing: false, isManualSync: false, lastSyncSuccess: false });
      return false;
    }
  },

  backgroundSync: async () => {
    const { runFullSync: engineRunFullSync } = await import("@/lib/api/sync");
    try {
      return await engineRunFullSync();
    } catch {
      return false;
    }
  },

  forceResync: async () => {
    const { useProgramStore } = await import("./programStore");
    const { useWorkoutSessionStore } = await import("./workoutSessionStore");
    const { runFullSync: engineRunFullSync } = await import("@/lib/api/sync");

    if (get().isSyncing) return false;
    set({ isSyncing: true, isManualSync: true, lastSyncAttempt: Date.now() });

    try {
      // 1. Wipe EVERYTHING from local storage (hard reset)
      await AsyncStorage.clear();

      // 2. Reset in-memory state
      useProgramStore.setState({ lastSyncedAt: null, programs: [] });
      useWorkoutSessionStore.setState({ lastSyncedAt: null, history: [], deletedWorkoutIds: [] });

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
