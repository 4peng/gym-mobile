import { useEffect, useState } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { COLORS, TYPE } from "@/constants/theme";
import { formatClock } from "@/utils/conversions";

/** Elapsed time since `startedAt`. Ticks once a second. */
export default function LiveWorkoutTimer({
  startedAt,
  textStyle,
}: {
  startedAt: string;
  textStyle?: StyleProp<TextStyle>;
}) {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () =>
      setDisplay(formatClock(Math.max(0, Math.floor((Date.now() - start) / 1000))));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <Text style={[TYPE.mono, { color: COLORS.ACCENT_GREEN, letterSpacing: 1 }, textStyle]}>
      {display}
    </Text>
  );
}
