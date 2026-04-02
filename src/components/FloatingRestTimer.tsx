import React, { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { useWorkoutSessionStore, type ActiveRestTimer } from "@/stores/workoutSessionStore";
import { cancelScheduledNotification } from "@/utils/notifications";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function formatMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ──────────────────────────────────────────────
// Strict selector — only re-renders when timer
// reference changes, not every store update.
// ──────────────────────────────────────────────

const selectTimer = (s: { activeRestTimer: ActiveRestTimer | null }) =>
  s.activeRestTimer;

// ──────────────────────────────────────────────
// FloatingRestTimer
// ──────────────────────────────────────────────

const FloatingRestTimer = React.memo(function FloatingRestTimer() {
  const timer = useWorkoutSessionStore(selectTimer);
  const cancelRestTimer = useWorkoutSessionStore((s) => s.cancelRestTimer);

  // Local-only display state — never written to Zustand.
  const [displayMs, setDisplayMs] = useState<number>(0);

  // Kick off / tear down the 1-second tick when the timer slice changes.
  useEffect(() => {
    if (!timer) {
      setDisplayMs(0);
      return;
    }

    // Compute initial remaining immediately (handles resume after background).
    const remaining = timer.endTime - Date.now();
    setDisplayMs(remaining);

    if (remaining <= 0) {
      // Timer already expired (e.g., app relaunched after rest finished).
      useWorkoutSessionStore.getState().clearExpiredTimer();
      return;
    }

    const interval = setInterval(() => {
      const rem = timer.endTime - Date.now();
      if (rem <= 0) {
        clearInterval(interval);
        setDisplayMs(0);
        // Clear the persisted timer; notification already fired via OS.
        useWorkoutSessionStore.getState().clearExpiredTimer();
        // Safety fallback: cancel notification in case it hasn't fired.
        cancelScheduledNotification(timer.notificationId);
      } else {
        setDisplayMs(rem);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

  const handleCancel = useCallback(() => {
    cancelRestTimer();
  }, [cancelRestTimer]);

  // Don't render anything if there is no active timer or it expired.
  if (!timer || displayMs <= 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.content}>
          <Text style={styles.label}>{timer.exerciseName}</Text>
          <Text style={styles.countdown}>{formatMmSs(displayMs)}</Text>
        </View>
        <Pressable onPress={handleCancel} hitSlop={12} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>X</Text>
        </Pressable>
      </View>
    </View>
  );
});

export default FloatingRestTimer;

// ──────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 40, // safe-area approximation
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  content: {
    flex: 1,
  },
  label: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  countdown: {
    color: COLORS.ACCENT_BLUE,
    fontFamily: FONT_FAMILIES.MEDIUM,
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 2,
  },
  cancelBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    color: COLORS.DANGER,
    fontWeight: "800",
    fontSize: 18,
  },
});
