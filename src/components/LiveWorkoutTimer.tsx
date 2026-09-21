import React, { useState, useEffect } from "react";
import { Text, StyleSheet, TextStyle } from "react-native";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { formatClock } from "@/utils/conversions";

interface LiveWorkoutTimerProps {
  startedAt: string;
  textStyle?: TextStyle;
}

export default function LiveWorkoutTimer({ startedAt, textStyle }: LiveWorkoutTimerProps) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const start = new Date(startedAt).getTime();

    const updateTimer = () => {
      const now = Date.now();
      setElapsed(formatClock(Math.max(0, Math.floor((now - start) / 1000))));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return <Text style={[styles.timer, textStyle]}>{elapsed}</Text>;
}

const styles = StyleSheet.create({
  timer: {
    color: COLORS.ACCENT_GREEN,
    fontSize: 14,
    fontWeight: "900",
    fontFamily: FONT_FAMILIES.MONO,
    letterSpacing: 1,
  },
});
