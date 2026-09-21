import React, { useState, useEffect } from "react";
import { Text, StyleSheet, TextStyle } from "react-native";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { formatClock } from "@/utils/conversions";

interface LiveRestTimerProps {
  textStyle?: TextStyle;
}

export default function LiveRestTimer({ textStyle }: LiveRestTimerProps) {
  const [totalRestDisplay, setTotalRestDisplay] = useState("00:00");

  // Use granular selectors to avoid re-rendering on session-wide updates (like typing reps)
  const baseRestSeconds = useWorkoutSessionStore(
    (s) => s.activeSession?.cumulativeRestSeconds || 0,
  );
  const activeRestTimer = useWorkoutSessionStore((s) => s.activeRestTimer);
  const activeSessionId = useWorkoutSessionStore((s) => s.activeSession?._id);

  useEffect(() => {
    if (!activeSessionId) return;

    const updateTimer = () => {
      let currentRestContribution = 0;
      if (activeRestTimer) {
        currentRestContribution = Math.max(
          0,
          Math.floor((Date.now() - activeRestTimer.startTime) / 1000),
        );
      }

      setTotalRestDisplay(formatClock(baseRestSeconds + currentRestContribution));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeRestTimer, baseRestSeconds, activeSessionId]);

  return <Text style={[styles.timer, textStyle]}>{totalRestDisplay}</Text>;
}

const styles = StyleSheet.create({
  timer: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: FONT_FAMILIES.MONO,
  },
});
