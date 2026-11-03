import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, type AppStateStatus } from "react-native";
import type { StateStorage } from "zustand/middleware";

// Per-key trailing debounce: persist writes on every change, so rapid writes to one key coalesce.
const DEBOUNCE_MS = 400;

interface PendingWrite {
  value: string;
  timeout: ReturnType<typeof setTimeout>;
  resolvers: (() => void)[];
}

const pendingWrites = new Map<string, PendingWrite>();

/** Performs the actual write for a pending entry and resolves all waiters. */
function commitPendingWrite(name: string, pending: PendingWrite): void {
  AsyncStorage.setItem(name, pending.value)
    .catch((err) => {
      console.error(`Failed to persist debounced write for "${name}":`, err);
    })
    .finally(() => {
      pending.resolvers.forEach((resolve) => resolve());
    });
}

/** Immediately flushes the pending debounced write for a single key, if any. */
function flushKey(name: string): void {
  const pending = pendingWrites.get(name);
  if (!pending) return;
  pendingWrites.delete(name);
  clearTimeout(pending.timeout);
  commitPendingWrite(name, pending);
}

/** Immediately flushes ALL pending debounced writes, across every key. */
function flushAllPendingWrites(): void {
  // Snapshot keys first: each entry leaves the map before its async write settles.
  Array.from(pendingWrites.keys()).forEach(flushKey);
}

AppState.addEventListener("change", (nextState: AppStateStatus) => {
  if (nextState === "inactive" || nextState === "background") {
    flushAllPendingWrites();
  }
});

/** Zustand-compatible StateStorage adapter. */
export const zustandAsyncStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return await AsyncStorage.getItem(name);
  },
  setItem: (name: string, value: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      const existing = pendingWrites.get(name);
      if (existing) {
        clearTimeout(existing.timeout);
      }

      const resolvers = existing ? [...existing.resolvers, resolve] : [resolve];

      const timeout = setTimeout(() => {
        const pending = pendingWrites.get(name);
        if (!pending) return;
        pendingWrites.delete(name);
        commitPendingWrite(name, pending);
      }, DEBOUNCE_MS);

      pendingWrites.set(name, { value, timeout, resolvers });
    });
  },
  removeItem: async (name: string): Promise<void> => {
    // Cancel the pending write first, or it could fire after removal and resurrect the value.
    const pending = pendingWrites.get(name);
    if (pending) {
      clearTimeout(pending.timeout);
      pendingWrites.delete(name);
      pending.resolvers.forEach((resolve) => resolve());
    }
    await AsyncStorage.removeItem(name);
  },
};
