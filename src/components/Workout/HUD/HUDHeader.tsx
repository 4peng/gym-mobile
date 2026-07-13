import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Timer, Clock, Check } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import LiveWorkoutTimer from "@/components/LiveWorkoutTimer";
import LiveRestTimer from "@/components/LiveRestTimer";
import FloatingRestTimer from "@/components/FloatingRestTimer";

interface HUDHeaderProps {
  scrollY: Animated.Value;
  startedAt: string | null | undefined;
  progressData: { progress: number; completed: number; total: number };
  condenseThreshold: number;
}

export const HUDHeader = React.memo(({ 
  scrollY, 
  startedAt, 
  progressData,
  condenseThreshold 
}: HUDHeaderProps) => {
  const stickyHudOpacity = scrollY.interpolate({
    inputRange: [condenseThreshold - 20, condenseThreshold],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const stickyHudTranslateY = scrollY.interpolate({
    inputRange: [condenseThreshold - 20, condenseThreshold],
    outputRange: [-20, 0],
    extrapolate: 'clamp',
  });

  return (
    <>
      <Animated.View style={[styles.stickyHud, { opacity: stickyHudOpacity, transform: [{ translateY: stickyHudTranslateY }] }]}>
        <View style={styles.stickyHudContent}>
          <View style={styles.stickyTimer}>
            <Timer size={14} color={COLORS.ACCENT_GREEN} />
            {startedAt && <LiveWorkoutTimer startedAt={startedAt} textStyle={styles.stickyTimerText} />}
          </View>
          <View style={styles.stickyTimer}>
            <Clock size={14} color={COLORS.TEXT_TERTIARY} />
            <LiveRestTimer textStyle={styles.stickyTimerText} />
          </View>
        </View>
      </Animated.View>

      <View style={styles.header}>
        <View style={styles.headerTopLine}>
          <View style={styles.timerBlock}>
            <Text style={styles.timerLabel}>ELAPSED: </Text>
            {startedAt && <LiveWorkoutTimer startedAt={startedAt} textStyle={styles.timerValue} />}
          </View>
          <View style={styles.timerBlock}>
            <Text style={styles.timerLabel}>TOTAL REST: </Text>
            <LiveRestTimer textStyle={styles.timerValue} />
            <View style={styles.activeRestSlot}>
              <FloatingRestTimer />
            </View>
          </View>
        </View>

        <View style={styles.statsLine}>
          <View style={styles.statsLeft}>
            <Check size={14} color={COLORS.ACCENT_GREEN} />
            <Text style={styles.statsValue}>
              {Math.round(progressData.progress * 100)}% ({progressData.completed}/{progressData.total})
            </Text>
          </View>
        </View>

        <View style={styles.progressBarWrapper}>
          <View style={[styles.progressBar, { width: `${progressData.progress * 100}%` }]} />
          <View style={[styles.progressIndicator, { left: `${progressData.progress * 100}%` }]}>
            <View style={styles.indicatorCircle} />
          </View>
        </View>
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  stickyHud: { position: 'absolute', top: 0, left: 0, right: 0, height: UI.HEADER_TOP + 20, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 100, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER, paddingTop: UI.HEADER_TOP - 30, justifyContent: 'center', paddingHorizontal: 20 },
  stickyHudContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stickyTimer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stickyTimerText: { color: COLORS.TEXT_PRIMARY, fontSize: 13, fontFamily: FONT_FAMILIES.MONO, fontWeight: "700" },
  header: { paddingTop: UI.HEADER_TOP - 20, paddingHorizontal: 20, paddingBottom: 20 },
  headerTopLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 44 },
  timerBlock: { flexDirection: "row", marginTop: 2 },
  timerLabel: { color: COLORS.TEXT_TERTIARY, fontSize: 14, fontFamily: FONT_FAMILIES.MONO, fontWeight: "700" },
  timerValue: { color: COLORS.TEXT_PRIMARY, fontSize: 14, fontFamily: FONT_FAMILIES.MONO, fontWeight: "700" },
  activeRestSlot: { position: "absolute", top: 28, right: 0, zIndex: 20 },
  statsLine: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  statsLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  statsValue: { color: COLORS.TEXT_SECONDARY, fontSize: 11, fontFamily: FONT_FAMILIES.MONO, fontWeight: "600" },
  progressBarWrapper: { height: 4, backgroundColor: COLORS.PROGRESS_BG, borderRadius: 2, position: "relative", marginTop: 4 },
  progressBar: { height: "100%", backgroundColor: COLORS.ACCENT_GREEN, borderRadius: 2 },
  progressIndicator: { position: "absolute", top: -4, width: 12, height: 12, marginLeft: -6, alignItems: "center", justifyContent: "center" },
  indicatorCircle: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.ACCENT_GREEN, borderWidth: 2, borderColor: COLORS.BG },
});
