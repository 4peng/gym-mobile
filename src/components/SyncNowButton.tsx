// ──────────────────────────────────────────────
// Manual "Sync Now" button example
// ──────────────────────────────────────────────
// Drop this component into a settings screen to give users
// a manual sync trigger with visual feedback.

import React, { useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { COLORS } from "@/constants/colors";
import { useSyncStore } from "@/stores/syncStore";
import { useProgramStore } from "@/stores/programStore";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";

export default function SyncNowButton() {
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const lastSyncAttempt = useSyncStore((s) => s.lastSyncAttempt);
  const lastSyncSuccess = useSyncStore((s) => s.lastSyncSuccess);
  const runFullSync = useSyncStore((s) => s.runFullSync);

  const programsDirty = useProgramStore((s) => s.isDirty);
  const workoutsDirty = useWorkoutSessionStore((s) => s.isDirty);

  const hasPendingChanges = programsDirty || workoutsDirty;

  const handlePress = useCallback(() => {
    if (!isSyncing) {
      runFullSync();
    }
  }, [isSyncing, runFullSync]);

  const formatTime = (epoch: number | null): string => {
    if (!epoch) return "Never";
    const d = new Date(epoch);
    return d.toLocaleTimeString();
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Last sync</Text>
        <Text style={styles.value}>{formatTime(lastSyncAttempt)}</Text>
      </View>

      {lastSyncSuccess !== null && (
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <Text
            style={[
              styles.value,
              { color: lastSyncSuccess ? "#4ade80" : "#f87171" },
            ]}
          >
            {lastSyncSuccess ? "Success" : "Failed"}
          </Text>
        </View>
      )}

      <View style={styles.row}>
        <Text style={styles.label}>Pending changes</Text>
        <Text style={styles.value}>
          {hasPendingChanges ? "Yes" : "No"}
        </Text>
      </View>

      <Pressable
        style={[styles.button, isSyncing && styles.buttonDisabled]}
        onPress={handlePress}
        disabled={isSyncing}
      >
        {isSyncing ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.buttonText}>Sync Now</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 16,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: "600",
  },
  value: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "700",
  },
  button: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: COLORS.ACCENT_BLUE,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: COLORS.ACCENT_BLUE,
    fontSize: 16,
    fontWeight: "800",
  },
});
