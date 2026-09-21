import { create } from "zustand";
import { backupEverything, pushPending, restoreFromCloud } from "@/lib/api/backup";

interface SyncState {
  isSyncing: boolean;
  lastSyncAttempt: number | null;
  lastSyncSuccess: boolean | null;
}

interface SyncActions {
  /** Push pending edits and deletes. No-ops while another operation runs. */
  pushPending: () => Promise<boolean>;
  /** Push every program and session (manual full backup). */
  backupEverything: () => Promise<boolean>;
  /** Replace local data with the cloud copy. Custom and pinned exercises are untouched. */
  restoreFromCloud: () => Promise<boolean>;
}

export const useSyncStore = create<SyncState & SyncActions>()((set, get) => {
  const run = async (task: () => Promise<boolean>, label: string) => {
    if (get().isSyncing) return false;
    set({ isSyncing: true, lastSyncAttempt: Date.now() });
    try {
      const ok = await task();
      set({ isSyncing: false, lastSyncSuccess: ok });
      return ok;
    } catch (err) {
      console.error(`${label} failed:`, err);
      set({ isSyncing: false, lastSyncSuccess: false });
      return false;
    }
  };

  return {
    isSyncing: false,
    lastSyncAttempt: null,
    lastSyncSuccess: null,
    pushPending: () => run(pushPending, "Backup"),
    backupEverything: () => run(backupEverything, "Full backup"),
    restoreFromCloud: () => run(restoreFromCloud, "Restore"),
  };
});
