import React, { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { useWorkoutSessionStore, type ActiveRestTimer } from "@/stores/workoutSessionStore";
import { cancelScheduledNotification } from "@/utils/notifications";

function formatMmSs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const selectTimer = (s: { activeRestTimer: ActiveRestTimer | null }) => s.activeRestTimer;

const FloatingRestTimer = React.memo(function FloatingRestTimer() {
  const timer = useWorkoutSessionStore(selectTimer);
  const cancelRestTimer = useWorkoutSessionStore((s) => s.cancelRestTimer);
  const [displayMs, setDisplayMs] = useState<number>(0);
  useEffect(() => {
    if (!timer) { setDisplayMs(0); return; }
    const remaining = timer.endTime - Date.now();
    setDisplayMs(remaining);
    if (remaining <= 0) { useWorkoutSessionStore.getState().clearExpiredTimer(); return; }
    const interval = setInterval(() => {
      const rem = timer.endTime - Date.now();
      if (rem <= 0) { clearInterval(interval); setDisplayMs(0); useWorkoutSessionStore.getState().clearExpiredTimer(); cancelScheduledNotification(timer.notificationId); } else { setDisplayMs(rem); }
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);
  const handleCancel = useCallback(() => { cancelRestTimer(); }, [cancelRestTimer]);
  if (!timer || displayMs <= 0) return null;
  return (<View style={styles.container}><View style={styles.card}><Text style={styles.countdown}>{formatMmSs(displayMs)}</Text><Pressable onPress={handleCancel} hitSlop={12} style={styles.cancelBtn}><Text style={styles.cancelText}>X</Text></Pressable></View></View>);
});

export default FloatingRestTimer;

const styles = StyleSheet.create({
  container: { },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "transparent", borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.BORDER, gap: 10 },
  countdown: { color: COLORS.TEXT_PRIMARY, fontFamily: FONT_FAMILIES.MONO, fontSize: 18, fontWeight: "900", letterSpacing: 0.5 },
  cancelBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: "transparent", borderWidth: 1, borderColor: COLORS.BORDER, alignItems: "center", justifyContent: "center" },
  cancelText: { color: COLORS.DANGER, fontWeight: "900", fontSize: 12, fontFamily: FONT_FAMILIES.MONO },
});
