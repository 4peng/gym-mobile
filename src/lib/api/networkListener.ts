// ──────────────────────────────────────────────
// Network-aware automatic sync
// ──────────────────────────────────────────────
// Listens for connectivity changes via @react-native-community/netinfo.
// When the device comes back online, triggers a full sync automatically.
//
// Usage: call `startNetworkSyncListener()` once at app root mount and
// store the unsubscribe function for cleanup.

import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { InteractionManager } from "react-native";
import { useSyncStore } from "@/stores/syncStore";

let _wasOffline = false;

// Guards against redundant full syncs firing back-to-back — e.g. NetInfo
// reporting "online" moments after the startup sync already ran, or a flurry
// of connectivity 'change' events. `runFullSync` already no-ops if a sync is
// in flight; this additionally throttles how often a NEW sync can be kicked
// off at all.
const MIN_SYNC_INTERVAL_MS = 60_000;
let _lastSyncTriggeredAt: number | null = null;

function triggerSyncIfDue(): void {
  const now = Date.now();
  if (_lastSyncTriggeredAt !== null && now - _lastSyncTriggeredAt < MIN_SYNC_INTERVAL_MS) {
    return;
  }
  _lastSyncTriggeredAt = now;
  // If the sync fails, clear the throttle so the next reconnect can retry
  // immediately rather than being suppressed for the full interval.
  void useSyncStore
    .getState()
    .runFullSync()
    .then((ok) => {
      if (!ok) _lastSyncTriggeredAt = null;
    })
    .catch(() => {
      _lastSyncTriggeredAt = null;
    });
}

function handleConnectivityChange(state: NetInfoState): void {
  const isConnected = state.isConnected && state.isInternetReachable;

  if (isConnected && _wasOffline) {
    // We just came back online — trigger sync (reconnect sync stays immediate,
    // subject only to the shared throttle above).
    triggerSyncIfDue();
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
  // Deferred via InteractionManager so this doesn't compete with the initial
  // route mount / first paint (it runs once interactions/animations settle).
  NetInfo.fetch().then((state) => {
    if (state.isConnected && state.isInternetReachable) {
      InteractionManager.runAfterInteractions(() => {
        triggerSyncIfDue();
      });
    } else {
      _wasOffline = true;
    }
  });

  return unsubscribe;
}
