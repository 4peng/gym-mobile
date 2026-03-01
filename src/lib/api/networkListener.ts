// ──────────────────────────────────────────────
// Network-aware automatic sync
// ──────────────────────────────────────────────
// Listens for connectivity changes via @react-native-community/netinfo.
// When the device comes back online, triggers a full sync automatically.
//
// Usage: call `startNetworkSyncListener()` once at app root mount and
// store the unsubscribe function for cleanup.

import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useSyncStore } from "@/stores/syncStore";

let _wasOffline = false;

function handleConnectivityChange(state: NetInfoState): void {
  const isConnected = state.isConnected && state.isInternetReachable;

  if (isConnected && _wasOffline) {
    // We just came back online — trigger sync.
    useSyncStore.getState().runFullSync();
  }

  _wasOffline = !isConnected;
}

/**
 * Start listening for network changes.
 * Returns an unsubscribe function.
 *
 * ```ts
 * // In your root layout / App.tsx useEffect:
 * const unsub = startNetworkSyncListener();
 * return () => unsub();
 * ```
 */
export function startNetworkSyncListener(): () => void {
  const unsubscribe = NetInfo.addEventListener(handleConnectivityChange);

  // Also check current state on startup — if already online, run initial sync.
  NetInfo.fetch().then((state) => {
    if (state.isConnected && state.isInternetReachable) {
      useSyncStore.getState().runFullSync();
    } else {
      _wasOffline = true;
    }
  });

  return unsubscribe;
}
