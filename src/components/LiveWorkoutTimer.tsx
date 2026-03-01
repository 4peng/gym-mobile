import React, { useState, useEffect } from "react";
import { Text, StyleSheet, Platform } from "react-native";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";

interface LiveWorkoutTimerProps {
  startedAt: string;
}

export default function LiveWorkoutTimer({ startedAt }: LiveWorkoutTimerProps) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const start = new Date(startedAt).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((now - start) / 1000));
      
      const hrs = Math.floor(diff / 3600);
      const mins = Math.floor((diff % 3600) / 60);
      const secs = diff % 60;

      const parts = [];
      if (hrs > 0) parts.push(String(hrs).padStart(2, "0"));
      parts.push(String(mins).padStart(2, "0"));
      parts.push(String(secs).padStart(2, "0"));
      
      setElapsed(parts.join(":"));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return <Text style={styles.timer}>{elapsed}</Text>;
}

const styles = StyleSheet.create({
  timer: {
    color: COLORS.ACCENT_GREEN,
    fontSize: 14,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    letterSpacing: 1,
  },
});
