import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { X } from "lucide-react-native";
import { COLORS, RADIUS, SPACE, TYPE } from "@/constants/theme";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { formatSecondsToMMSS } from "@/utils/conversions";
import { IconButton } from "@/components/ui/IconButton";

/** Countdown chip for the active rest timer; hidden when no timer is running. */
const FloatingRestTimer = React.memo(function FloatingRestTimer() {
  const timer = useWorkoutSessionStore((s) => s.activeRestTimer);
  const cancelRestTimer = useWorkoutSessionStore((s) => s.cancelRestTimer);
  const clearExpiredTimer = useWorkoutSessionStore((s) => s.clearExpiredTimer);
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (!timer) {
      setRemainingMs(0);
      return;
    }
    const tick = () => {
      const rem = timer.endTime - Date.now();
      setRemainingMs(rem);
      if (rem <= 0) clearExpiredTimer();
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timer, clearExpiredTimer]);

  if (!timer || remainingMs <= 0) return null;

  return (
    <View style={styles.card}>
      <Text style={TYPE.monoMedium}>{formatSecondsToMMSS(Math.ceil(remainingMs / 1000))}</Text>
      <IconButton size="sm" tone="danger" onPress={() => void cancelRestTimer()}>
        <X size={14} color={COLORS.DANGER} />
      </IconButton>
    </View>
  );
});

export default FloatingRestTimer;

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.container,
    paddingVertical: SPACE.xs,
    paddingLeft: SPACE.md,
    paddingRight: SPACE.xs,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    gap: SPACE.sm,
  },
});
