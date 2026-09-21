import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { X } from "lucide-react-native";
import { COLORS, RADIUS, SPACE, TYPE, UI } from "@/constants/theme";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { formatSecondsToMMSS } from "@/utils/conversions";

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
      <Text style={styles.countdown}>{formatSecondsToMMSS(Math.ceil(remainingMs / 1000))}</Text>
      <Pressable
        onPress={() => void cancelRestTimer()}
        hitSlop={12}
        style={({ pressed }) => [styles.cancel, pressed && UI.pressed]}
      >
        <X size={12} color={COLORS.DANGER} />
      </Pressable>
    </View>
  );
});

export default FloatingRestTimer;

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.item,
    paddingVertical: SPACE.sm - 2,
    paddingHorizontal: SPACE.md,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    gap: SPACE.sm + 2,
  },
  countdown: { ...TYPE.monoMedium },
  cancel: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
});
