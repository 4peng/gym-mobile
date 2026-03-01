// ──────────────────────────────────────────────
// Sync Store
// ──────────────────────────────────────────────
// Reactive Zustand wrapper around the sync engine.
// Exposes `isSyncing`, `lastSyncAttempt`, and a
// `runFullSync` action the UI can call directly.

import { create } from "zustand";

interface SyncState {
  isSyncing: boolean;
  lastSyncAttempt: number | null;
  lastSyncSuccess: boolean | null;
}

interface SyncActions {
  /**
   * Trigger a full sync. Updates reactive state so the UI can
   * show spinners / success indicators.
   */
  runFullSync: () => Promise<boolean>;
}

export const useSyncStore = create<SyncState & SyncActions>()((set, get) => ({
  isSyncing: false,
  lastSyncAttempt: null,
  lastSyncSuccess: null,

  runFullSync: async () => {
    // Dynamic import inside the function to break circular dependencies
    const { runFullSync: engineRunFullSync } = await import("@/lib/api/sync");

    if (get().isSyncing) return false;

    set({ isSyncing: true, lastSyncAttempt: Date.now() });

    try {
      const success = await engineRunFullSync();
      set({ isSyncing: false, lastSyncSuccess: success });
      return success;
    } catch {
      set({ isSyncing: false, lastSyncSuccess: false });
      return false;
    }
  },
}));
