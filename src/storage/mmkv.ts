import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';
import type { StateStorage } from "zustand/middleware";

/**
 * NOTE: This module is named `mmkv` for historical reasons only. Persistence is
 * backed by the async `@react-native-async-storage/async-storage`, NOT by MMKV.
 * There is no synchronous storage layer in this app; all persisted stores use
 * this async adapter. (Kept the filename to avoid churning every import site.)
 */

// ──────────────────────────────────────────────
// Debounced writes
// ──────────────────────────────────────────────
// Zustand's `persist` middleware calls `setItem` on every state change, which
// for stores updated on every keystroke (e.g. the active workout session)
// means re-serializing and writing a large JSON blob dozens of times a
// second. We coalesce rapid writes to the SAME key into a single trailing
// write ~400ms after the last change. Writes to different keys are
// independent (per-key debounce), so unrelated stores never block each other.
//
// Durability: if the app is backgrounded/inactivated while a debounced write
// is still pending, we flush everything immediately so nothing is lost.
const DEBOUNCE_MS = 400;

interface PendingWrite {
  value: string;
  timeout: ReturnType<typeof setTimeout>;
  resolvers: Array<() => void>;
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
  // Snapshot keys first — commitPendingWrite is async, and we've already
  // removed each entry from the map by the time its write settles.
  Array.from(pendingWrites.keys()).forEach(flushKey);
}

// Backgrounding/inactivating the app must not lose in-flight edits: flush
// every pending debounced write right away so it lands on disk before the
// app is suspended.
AppState.addEventListener('change', (nextState: AppStateStatus) => {
  if (nextState === 'inactive' || nextState === 'background') {
    flushAllPendingWrites();
  }
});

/**
 * Zustand-compatible StateStorage adapter.
 */
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
    // Cancel any pending debounced write for this key first — otherwise it
    // could fire after the removal and resurrect the value.
    const pending = pendingWrites.get(name);
    if (pending) {
      clearTimeout(pending.timeout);
      pendingWrites.delete(name);
      pending.resolvers.forEach((resolve) => resolve());
    }
    await AsyncStorage.removeItem(name);
  },
};
