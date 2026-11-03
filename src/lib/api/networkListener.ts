// On startup restore if this install is empty, else push pending; push again on every reconnect.

import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { InteractionManager } from "react-native";
import { useSyncStore } from "@/stores/syncStore";
import { isLocalEmpty } from "@/lib/api/backup";

let _wasOffline = false;

// Reconnect push throttle; a failed push clears it so the next reconnect retries.
const MIN_PUSH_INTERVAL_MS = 60_000;
let _lastPushAt: number | null = null;

function pushIfDue(): void {
  const now = Date.now();
  if (_lastPushAt !== null && now - _lastPushAt < MIN_PUSH_INTERVAL_MS) return;
  _lastPushAt = now;
  void useSyncStore
    .getState()
    .pushPending()
    .then((ok) => {
      if (!ok) _lastPushAt = null;
    })
    .catch(() => {
      _lastPushAt = null;
    });
}

const isOnline = (state: NetInfoState) => !!state.isConnected && !!state.isInternetReachable;

/** Fresh installs restore; everything else pushes whatever is pending (throttled). */
function syncIfDue(): void {
  if (isLocalEmpty()) void useSyncStore.getState().restoreFromCloud();
  else pushIfDue();
}

function handleConnectivityChange(state: NetInfoState): void {
  const online = isOnline(state);
  if (online && _wasOffline) syncIfDue();
  _wasOffline = !online;
}

/** Starts listening; returns the unsubscribe function. */
export function startNetworkSyncListener(): () => void {
  const unsubscribe = NetInfo.addEventListener(handleConnectivityChange);

  NetInfo.fetch().then((state) => {
    if (!isOnline(state)) {
      _wasOffline = true;
      return;
    }
    // Deferred so the first paint isn't competing with network work.
    InteractionManager.runAfterInteractions(syncIfDue);
  });

  return unsubscribe;
}
