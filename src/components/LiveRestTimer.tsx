import { useEffect, useState } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { TYPE } from "@/constants/theme";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { formatClock } from "@/utils/conversions";

/** Total rest taken this session, including the timer currently running. Ticks once a second. */
export default function LiveRestTimer({ textStyle }: { textStyle?: StyleProp<TextStyle> }) {
  const baseRestSeconds = useWorkoutSessionStore(
    (s) => s.activeSession?.cumulativeRestSeconds || 0,
  );
  const timerStartedAt = useWorkoutSessionStore((s) => s.activeRestTimer?.startTime ?? null);
  const [display, setDisplay] = useState("00:00");

  useEffect(() => {
    const tick = () => {
      const running = timerStartedAt
        ? Math.max(0, Math.floor((Date.now() - timerStartedAt) / 1000))
        : 0;
      setDisplay(formatClock(baseRestSeconds + running));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [baseRestSeconds, timerStartedAt]);

  return <Text style={[TYPE.mono, textStyle]}>{display}</Text>;
}
