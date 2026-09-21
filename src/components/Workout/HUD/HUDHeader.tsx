import React from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Check, Clock, Timer } from "lucide-react-native";
import { COLORS, LAYOUT, SPACE, SURFACE, TYPE } from "@/constants/theme";
import LiveWorkoutTimer from "@/components/LiveWorkoutTimer";
import LiveRestTimer from "@/components/LiveRestTimer";
import FloatingRestTimer from "@/components/FloatingRestTimer";

interface HUDHeaderProps {
  scrollY: Animated.Value;
  startedAt: string | null | undefined;
  progressData: { progress: number; completed: number; total: number };
}

/** Scroll offset (px) at which the condensed sticky HUD fades in. */
const CONDENSE_THRESHOLD = 80;

export const HUDHeader = React.memo(function HUDHeader({
  scrollY,
  startedAt,
  progressData,
}: HUDHeaderProps) {
  const stickyOpacity = scrollY.interpolate({
    inputRange: [CONDENSE_THRESHOLD - 20, CONDENSE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const stickyTranslateY = scrollY.interpolate({
    inputRange: [CONDENSE_THRESHOLD - 20, CONDENSE_THRESHOLD],
    outputRange: [-20, 0],
    extrapolate: "clamp",
  });
  const pct = `${progressData.progress * 100}%` as const;

  return (
    <>
      <Animated.View
        style={[
          styles.sticky,
          { opacity: stickyOpacity, transform: [{ translateY: stickyTranslateY }] },
        ]}
      >
        <View style={styles.stickyRow}>
          <View style={styles.stat}>
            <Timer size={14} color={COLORS.ACCENT_GREEN} />
            {startedAt && <LiveWorkoutTimer startedAt={startedAt} textStyle={styles.stickyText} />}
          </View>
          <View style={styles.stat}>
            <Clock size={14} color={COLORS.TEXT_TERTIARY} />
            <LiveRestTimer textStyle={styles.stickyText} />
          </View>
        </View>
      </Animated.View>

      <View style={styles.header}>
        <View style={styles.topLine}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>ELAPSED</Text>
            {startedAt && <LiveWorkoutTimer startedAt={startedAt} textStyle={styles.statValue} />}
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>REST</Text>
            <LiveRestTimer textStyle={styles.statValue} />
            <View style={styles.restSlot}>
              <FloatingRestTimer />
            </View>
          </View>
        </View>

        <View style={styles.progressLine}>
          <Check size={14} color={COLORS.ACCENT_GREEN} />
          <Text style={TYPE.monoSmall}>
            {Math.round(progressData.progress * 100)}% ({progressData.completed}/
            {progressData.total})
          </Text>
        </View>

        <View style={styles.track}>
          <View style={[styles.bar, { width: pct }]} />
          <View style={[styles.indicator, { left: pct }]}>
            <View style={styles.indicatorDot} />
          </View>
        </View>
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  sticky: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: LAYOUT.headerTop + 30,
    backgroundColor: SURFACE.backdrop,
    zIndex: 100,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
    paddingTop: LAYOUT.headerTop - 20,
    justifyContent: "center",
    paddingHorizontal: LAYOUT.gutter + SPACE.xs,
  },
  stickyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stickyText: { ...TYPE.mono },
  header: {
    paddingTop: LAYOUT.headerTop - 10,
    paddingHorizontal: LAYOUT.gutter + SPACE.xs,
    paddingBottom: SPACE.xl,
  },
  topLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACE.xxxl + SPACE.md,
  },
  stat: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  statLabel: { ...TYPE.mono, color: COLORS.TEXT_TERTIARY },
  statValue: { ...TYPE.mono },
  restSlot: { position: "absolute", top: 28, right: 0, zIndex: 20 },
  progressLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm - 2,
    marginBottom: SPACE.sm,
  },
  track: { height: 4, backgroundColor: SURFACE.greenTint, borderRadius: 2, marginTop: SPACE.xs },
  bar: { height: "100%", backgroundColor: COLORS.ACCENT_GREEN, borderRadius: 2 },
  indicator: {
    position: "absolute",
    top: -4,
    width: 12,
    height: 12,
    marginLeft: -6,
    alignItems: "center",
    justifyContent: "center",
  },
  indicatorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.ACCENT_GREEN,
    borderWidth: 2,
    borderColor: COLORS.BG,
  },
});
