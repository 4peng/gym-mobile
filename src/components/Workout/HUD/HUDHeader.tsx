import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Timer, Clock, Check, Activity, Zap } from "lucide-react-native";
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
  totalVolume: number;
  sessionId: string;
}

const SEGMENTS = 20;

const getMissionId = (id: string) => `OP-${(id || 'X000').substring(0, 4).toUpperCase()}`;

export const HUDHeader = React.memo(({ 
  scrollY, 
  startedAt, 
  progressData,
  condenseThreshold,
  totalVolume,
  sessionId
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

  const activeSegments = Math.round(progressData.progress * SEGMENTS);

  return (
    <>
      <Animated.View style={[styles.stickyHud, { opacity: stickyHudOpacity, transform: [{ translateY: stickyHudTranslateY }] }]}>
        <View style={styles.stickyHudContent}>
          <View style={styles.stickyTimer}>
            <Timer size={14} color={COLORS.ACCENT_GREEN} />
            {startedAt && <LiveWorkoutTimer startedAt={startedAt} textStyle={styles.stickyTimerText} />}
          </View>
          <View style={styles.missionBadge}>
            <Text style={styles.missionBadgeText}>{getMissionId(sessionId)}</Text>
          </View>
          <View style={styles.stickyTimer}>
            <Clock size={14} color={COLORS.TEXT_TERTIARY} />
            <LiveRestTimer textStyle={styles.stickyTimerText} />
          </View>
        </View>
      </Animated.View>

      <View style={styles.header}>
        <View style={styles.headerTopLine}>
          <View style={styles.instrumentBlock}>
            <View style={styles.labelRow}>
              <Activity size={10} color={COLORS.TEXT_TERTIARY} />
              <Text style={styles.timerLabel}>ELAPSED: </Text>
            </View>
            {startedAt && <LiveWorkoutTimer startedAt={startedAt} textStyle={styles.timerValue} />}
          </View>
          
          <View style={styles.instrumentBlock}>
            <View style={styles.labelRow}>
              <Zap size={10} color={COLORS.ACCENT_YELLOW} />
              <Text style={styles.timerLabel}>EST. VOL: </Text>
            </View>
            <Text style={[styles.timerValue, { color: COLORS.ACCENT_YELLOW }]}>
                {totalVolume.toLocaleString()} <Text style={styles.unitText}>KG</Text>
            </Text>
          </View>

          <View style={styles.instrumentBlock}>
            <View style={styles.labelRow}>
              <Clock size={10} color={COLORS.TEXT_TERTIARY} />
              <Text style={styles.timerLabel}>TOTAL REST: </Text>
            </View>
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
          <Text style={styles.missionIdText}>{getMissionId(sessionId)} // LIVE_HUD_v1.0</Text>
        </View>

        <View style={styles.segmentedProgressBar}>
          {Array.from({ length: SEGMENTS }).map((_, i) => (
            <View 
              key={i} 
              style={[
                styles.progressSegment, 
                i < activeSegments && styles.progressSegmentActive,
                i === activeSegments - 1 && styles.progressSegmentLeading
              ]} 
            />
          ))}
        </View>
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  stickyHud: { position: 'absolute', top: 0, left: 0, right: 0, height: UI.HEADER_TOP + 20, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 100, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER, paddingTop: UI.HEADER_TOP - 30, justifyContent: 'center', paddingHorizontal: 20 },
  stickyHudContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stickyTimer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stickyTimerText: { color: COLORS.TEXT_PRIMARY, fontSize: 13, fontFamily: FONT_FAMILIES.MONO, fontWeight: "700" },
  missionBadge: { backgroundColor: 'rgba(0, 122, 255, 0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(0, 122, 255, 0.3)' },
  missionBadgeText: { color: COLORS.ACCENT_BLUE, fontSize: 10, fontFamily: FONT_FAMILIES.MONO, fontWeight: "800" },
  header: { paddingTop: UI.HEADER_TOP - 20, paddingHorizontal: 20, paddingBottom: 20 },
  headerTopLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 },
  instrumentBlock: { gap: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timerLabel: { color: COLORS.TEXT_TERTIARY, fontSize: 10, fontFamily: 'NeoGramTrial-BoldCondensed', fontWeight: "700" },
  timerValue: { color: COLORS.TEXT_PRIMARY, fontSize: 16, fontFamily: FONT_FAMILIES.MONO, fontWeight: "700" },
  unitText: { fontSize: 10, color: COLORS.TEXT_TERTIARY },
  activeRestSlot: { position: "absolute", top: 32, right: 0, zIndex: 20 },
  statsLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  statsLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  statsValue: { color: COLORS.TEXT_SECONDARY, fontSize: 11, fontFamily: FONT_FAMILIES.MONO, fontWeight: "600" },
  missionIdText: { color: COLORS.TEXT_TERTIARY, fontSize: 9, fontFamily: FONT_FAMILIES.MONO, fontWeight: "500" },
  segmentedProgressBar: { flexDirection: 'row', gap: 3, height: 6, marginTop: 4 },
  progressSegment: { flex: 1, height: '100%', backgroundColor: COLORS.PROGRESS_BG, borderRadius: 1 },
  progressSegmentActive: { backgroundColor: COLORS.ACCENT_GREEN },
  progressSegmentLeading: { shadowColor: COLORS.ACCENT_GREEN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4, elevation: 4 },
});
