'use client';

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { ChevronLeft, Calendar, Zap, Check, X, ChevronDown, Trophy, Activity, TrendingUp } from "lucide-react-native";
import Svg, { Rect, Line, Path, Text as SvgText, Circle, G } from "react-native-svg";
import { useAppRouter } from "@/utils/navigation";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import { toTitleCase } from "@/utils/string";
import { convertWeight } from "@/utils/conversions";
import { Swipeable } from "@/src/components/Swipeable";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_HEIGHT = 220;
const CHART_PADDING_HORIZONTAL = 40;

type TimeRange = "30D" | "6M" | "1Y";

interface ExerciseVolumeScreenProps {
  exerciseName: string;
}

export default function ExerciseVolumeScreen({ exerciseName }: ExerciseVolumeScreenProps) {
  const router = useAppRouter();
  const allHistory = useWorkoutSessionStore((s) => s.history);
  const deleteHistorySession = useWorkoutSessionStore((s) => s.deleteHistorySession);
  const updateHistorySet = useWorkoutSessionStore((s) => s.updateHistorySet);
  const updateSessionDate = useWorkoutSessionStore((s) => s.updateSessionDate);
  
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [range, setRange] = useState<TimeRange>("30D");
  const [displayLimit, setDisplayLimit] = useState(10);
  const [activeBucketIdx, setActiveBucketIdx] = useState<number | null>(null);
  const [editingSet, setEditingSet] = useState<{
    sessionId: string;
    exerciseId: string;
    setId: string;
    weight: string;
    reps: string;
  } | null>(null);

  const history = useMemo(() => 
    allHistory.filter(s => !s.deletedAt), 
    [allHistory]
  );

  // ── Data Processing ────────────────────────
  
  const processedData = useMemo(() => {
    const now = new Date();
    const data: { label: string; value: number; timestamp: number; endTimestamp: number; hasPR: boolean }[] = [];
    
    let bucketCount = 0;
    let windowSizeDays = 1;

    if (range === "30D") {
      bucketCount = 30;
      windowSizeDays = 1;
    } else if (range === "6M") {
      bucketCount = 24; 
      windowSizeDays = 7;
    } else {
      bucketCount = 12; 
      windowSizeDays = 30;
    }

    // High Impact Stats
    let globalMaxWeight = 0;
    let max1RM = 0;
    let maxDailyVolume = 0;
    let lastVolume = 0;

    // First pass: Global maxes
    history.forEach(s => {
      s.exercises.forEach(ex => {
        if (ex.name.toLowerCase() === exerciseName.toLowerCase()) {
          ex.sets.forEach(set => {
            if (set.weight && set.weight > globalMaxWeight) globalMaxWeight = set.weight;
            if (set.weight && set.reps) {
              const current1RM = set.weight * (1 + set.reps / 30);
              if (current1RM > max1RM) max1RM = current1RM;
            }
          });
        }
      });
    });

    // Initialize buckets (Trailing Windows)
    for (let i = bucketCount - 1; i >= 0; i--) {
      const end = new Date(now);
      end.setDate(end.getDate() - (i * windowSizeDays));
      end.setHours(23, 59, 59, 999);
      
      const start = new Date(end);
      start.setDate(start.getDate() - windowSizeDays + 1);
      start.setHours(0, 0, 0, 0);

      let label = "";
      if (range === "30D") {
        if (i % 7 === 0 || i === 0) label = end.toLocaleDateString('default', { month: 'short', day: 'numeric' });
      } else if (range === "6M") {
        if (i % 4 === 0) label = end.toLocaleDateString('default', { month: 'short', day: 'numeric' });
      } else {
        label = end.toLocaleDateString('default', { month: 'short' });
      }

      data.push({ 
        label, 
        value: 0, 
        timestamp: start.getTime(),
        endTimestamp: end.getTime(),
        hasPR: false
      });
    }

    const lastSessionWithEx = [...history].reverse().find(s => 
      s.exercises.find(e => e.name.toLowerCase() === exerciseName.toLowerCase())
    );
    const targetUnit = lastSessionWithEx?.exercises.find(e => e.name.toLowerCase() === exerciseName.toLowerCase())?.weightUnit || "kg";

    // Second pass: Group logs by local date
    const logsByDate: { [key: string]: any } = {};

    history.forEach((session) => {
      const sessionDate = new Date(session.completedAt || session.startedAt);
      const dateKey = `${sessionDate.getFullYear()}-${(sessionDate.getMonth() + 1).toString().padStart(2, '0')}-${sessionDate.getDate().toString().padStart(2, '0')}`;
      
      const sessionExercises = session.exercises.filter(
        (e) => e.name.toLowerCase() === exerciseName.toLowerCase()
      );

      sessionExercises.forEach(exercise => {
        let totalExerciseVolume = 0;
        let exerciseMaxWeight = 0;
        const completedSets: any[] = [];

        exercise.sets.forEach(s => {
          if (s.completedAt && s.weight !== null && s.reps !== null) {
            const normalizedWeight = convertWeight(s.weight, exercise.weightUnit || "kg", targetUnit) || 0;
            totalExerciseVolume += normalizedWeight * s.reps;
            if (s.weight > exerciseMaxWeight) exerciseMaxWeight = s.weight;
            completedSets.push({ ...s, sessionId: session._id, exerciseId: exercise.id });
          }
        });

        if (completedSets.length > 0) {
          const isPRSession = exerciseMaxWeight === globalMaxWeight && globalMaxWeight > 0;
          
          if (!logsByDate[dateKey]) {
            logsByDate[dateKey] = {
              id: dateKey,
              sessionIds: new Set([session._id]),
              date: sessionDate.toLocaleDateString('default', { month: 'short', day: 'numeric' }),
              rawDate: sessionDate,
              volume: 0,
              sets: [],
              isPR: false
            };
          }
          logsByDate[dateKey].volume += totalExerciseVolume;
          logsByDate[dateKey].sets = [...logsByDate[dateKey].sets, ...completedSets];
          logsByDate[dateKey].sessionIds.add(session._id);
          if (isPRSession) logsByDate[dateKey].isPR = true;

          // Add to chart buckets
          data.forEach(bucket => {
            if (sessionDate.getTime() >= bucket.timestamp && sessionDate.getTime() <= bucket.endTimestamp) {
              bucket.value += totalExerciseVolume;
            }
          });
        }
      });
    });

    const sessionLogs = Object.values(logsByDate).sort((a: any, b: any) => b.rawDate - a.rawDate);
    
    // Calculate final stats from grouped data
    if (sessionLogs.length > 0) {
      lastVolume = sessionLogs[0].volume;
      maxDailyVolume = Math.max(...sessionLogs.map((log: any) => log.volume));
    }

    // Set PR star to the highest volume bar in the CURRENT chart view
    const chartMaxVolume = Math.max(...data.map(d => d.value));
    if (chartMaxVolume > 0) {
      data.forEach(d => {
        d.hasPR = d.value === chartMaxVolume;
      });
    }

    return { buckets: data, unit: targetUnit, sessionLogs, stats: { max1RM, maxDailyVolume, lastVolume } };
  }, [history, exerciseName, range]);

  const { buckets, unit, sessionLogs, stats } = processedData;
  const maxVolume = Math.max(100, ...buckets.map(d => d.value));
  const chartWidth = SCREEN_WIDTH - (CHART_PADDING_HORIZONTAL * 2);
  const barWidth = Math.max(4, (chartWidth / buckets.length) * 0.6);
  const gap = (chartWidth - (buckets.length * barWidth)) / (buckets.length - 1);

  const yLabel = `VOLUME (${unit.toUpperCase()})`;

  const activePoints = useMemo(() => {
    return buckets
      .map((d, i) => {
        if (d.value === 0) return null;
        const x = 40 + i * (barWidth + gap) + barWidth / 2;
        const normalized = d.value / maxVolume;
        const y = CHART_HEIGHT - (normalized * (CHART_HEIGHT - 60)) - 20;
        return { x, y };
      })
      .filter((p): p is { x: number; y: number } => p !== null);
  }, [buckets, maxVolume, barWidth, gap]);

  const linePath = useMemo(() => {
    if (activePoints.length < 2) return "";
    let path = `M ${activePoints[0].x} ${activePoints[0].y}`;
    for (let i = 0; i < activePoints.length - 1; i++) {
      const p0 = activePoints[i];
      const p1 = activePoints[i + 1];
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      if (i === 0) path += ` L ${midX} ${midY}`;
      else path += ` Q ${p0.x} ${p0.y}, ${midX} ${midY}`;
    }
    path += ` L ${activePoints[activePoints.length - 1].x} ${activePoints[activePoints.length - 1].y}`;
    return path;
  }, [activePoints]);

  const handleDeleteSession = (ids: Set<string>) => {
    Alert.alert("Delete Daily Log", "Are you sure you want to remove all logs for this date?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => ids.forEach(id => deleteHistorySession(id)) }
    ]);
  };

  const handleEditDate = (ids: Set<string>, currentIso: string) => {
    const currentDate = new Date(currentIso).toISOString().split('T')[0];
    if (Platform.OS === 'ios') {
      Alert.prompt("Edit Date", "Enter new date (YYYY-MM-DD):", [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Save", 
          onPress: (newDate) => {
            if (newDate && /^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
              ids.forEach(id => {
                const session = allHistory.find(s => s._id === id);
                if (session) {
                  const oldTime = (session.completedAt || session.startedAt).split('T')[1] || "12:00:00.000Z";
                  updateSessionDate(id, `${newDate}T${oldTime}`);
                }
              });
            }
          } 
        }
      ], "plain-text", currentDate);
    }
  };

  const handleStartEdit = (sessionId: string, exId: string, setId: string, weight: number | null, reps: number | null) => {
    setEditingSet({ sessionId, exerciseId: exId, setId, weight: (weight ?? 0).toString(), reps: (reps ?? 0).toString() });
  };

  const handleSaveEdit = () => {
    if (!editingSet) return;
    const w = parseFloat(editingSet.weight);
    const r = parseFloat(editingSet.reps);
    if (!isNaN(w) && !isNaN(r)) {
      updateHistorySet(editingSet.sessionId, editingSet.exerciseId, editingSet.setId, "weight", w);
      updateHistorySet(editingSet.sessionId, editingSet.exerciseId, editingSet.setId, "reps", r);
    }
    setEditingSet(null);
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 20 && sessionLogs.length > displayLimit) {
      setDisplayLimit(prev => prev + 10);
    }
  };

  const handleBucketPress = (idx: number) => setActiveBucketIdx(activeBucketIdx === idx ? null : idx);
  const selectedBucket = activeBucketIdx !== null ? buckets[activeBucketIdx] : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={UI.SHARED.iconBtn}>
            <ChevronDown size={28} color={COLORS.TEXT_PRIMARY} />
          </Pressable>
          <View style={styles.rangeSelector}>
            {(["30D", "6M", "1Y"] as TimeRange[]).map((r) => (
              <Pressable key={r} onPress={() => { setRange(r); setActiveBucketIdx(null); }} style={[styles.rangeBtn, range === r && styles.rangeBtnActive]}>
                <Text style={[styles.rangeText, range === r && styles.rangeTextActive]}>{r}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} scrollEnabled={scrollEnabled} onScroll={handleScroll} scrollEventThrottle={16}>
          <Text style={styles.title}>Volume Trends:{"\n"}<Text style={{ color: COLORS.ACCENT_GREEN }}>{toTitleCase(exerciseName)}</Text></Text>

          {/* Strong Minimal Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>EST. 1RM</Text>
              <Text style={styles.statValue}>{Math.round(stats.max1RM)}<Text style={styles.statUnit}>{unit}</Text></Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>MAX DAILY</Text>
              <Text style={styles.statValue}>{Math.round(stats.maxDailyVolume)}<Text style={styles.statUnit}>{unit}</Text></Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>LAST LOG</Text>
              <Text style={styles.statValue}>{Math.round(stats.lastVolume)}<Text style={styles.statUnit}>{unit}</Text></Text>
            </View>
          </View>

          <View style={styles.chartContainer}>
            <View style={styles.tooltipPlaceholder}>
              {selectedBucket && (
                <View style={styles.minimalTooltip}>
                  <Text style={styles.minimalTooltipDate}>
                    {range === "30D" 
                      ? new Date(selectedBucket.timestamp).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })
                      : `${new Date(selectedBucket.timestamp).toLocaleDateString('default', { month: 'short', day: 'numeric' })} - ${new Date(selectedBucket.endTimestamp).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`
                    }
                  </Text>
                  <Text style={styles.minimalTooltipValue}>{Math.round(selectedBucket.value)} {unit.toUpperCase()}</Text>
                </View>
              )}
            </View>

            <Svg width={chartWidth + 60} height={CHART_HEIGHT + 40}>
              <SvgText x="35" y="10" fill={COLORS.TEXT_TERTIARY} fontSize="9" fontWeight="900" fontFamily={FONT_FAMILIES.MEDIUM} textAnchor="start" letterSpacing="0.5">{yLabel}</SvgText>

              {[0, 0.5, 1].map((v) => {
                const y = CHART_HEIGHT - (v * 150 + 20);
                const label = Math.round(v * maxVolume);
                return (
                  <React.Fragment key={v}>
                    <Line x1="40" y1={y} x2={chartWidth + 40} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                    <SvgText x="32" y={y + 4} fill={COLORS.TEXT_TERTIARY} fontSize="10" fontWeight="800" textAnchor="end" fontFamily={FONT_FAMILIES.MEDIUM}>{label >= 1000 ? `${(label / 1000).toFixed(1)}k` : label}</SvgText>
                  </React.Fragment>
                );
              })}

              {buckets.map((d, i) => {
                const barHeight = (d.value / maxVolume) * (CHART_HEIGHT - 60);
                const x = 40 + i * (barWidth + gap);
                const y = CHART_HEIGHT - barHeight - 20;
                const isActive = activeBucketIdx === i;
                const hitWidth = barWidth + gap;
                const hitX = x - gap / 2;

                return (
                  <G key={i}>
                    <Rect x={hitX} y={0} width={hitWidth} height={CHART_HEIGHT + 20} fill="transparent" onPress={() => { if (d.value > 0) handleBucketPress(i); }} />
                    <Rect x={x} y={y} width={barWidth} height={Math.max(2, barHeight)} fill={d.value === 0 ? "rgba(255,255,255,0.05)" : (isActive ? COLORS.ACCENT_BLUE : "rgba(11, 130, 255, 0.6)")} rx={barWidth / 2} pointerEvents="none" />
                    {d.hasPR && <SvgText x={x + barWidth / 2} y={y - 8} fill={isActive ? COLORS.ACCENT_YELLOW : "rgba(250, 204, 0, 0.8)"} fontSize="10" fontWeight="900" textAnchor="middle" pointerEvents="none">★</SvgText>}
                  </G>
                );
              })}

              {buckets.map((d, i) => {
                if (!d.label) return null;
                return <SvgText key={`date-${i}`} x={40 + i * (barWidth + gap) + barWidth / 2} y={CHART_HEIGHT + 10} fill={COLORS.TEXT_TERTIARY} fontSize="9" fontWeight="800" textAnchor="middle" fontFamily={FONT_FAMILIES.MEDIUM}>{d.label}</SvgText>;
              })}

              <SvgText x={chartWidth / 2 + 40} y={CHART_HEIGHT + 30} fill={COLORS.TEXT_TERTIARY} fontSize="9" fontWeight="900" textAnchor="middle" fontFamily={FONT_FAMILIES.MEDIUM} letterSpacing="1">DATE</SvgText>
              {linePath ? <Path d={linePath} fill="none" stroke={COLORS.ACCENT_GREEN} strokeWidth={2.5} opacity={0.8} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" /> : null}
            </Svg>
          </View>

          <View style={styles.logsSection}>
            <View style={styles.disclosureContainer}>
              <TrendingUp size={14} color={COLORS.TEXT_TERTIARY} />
              <Text style={styles.disclosureText}>
                EST. 1RM is calculated using the Epley Formula (Weight × (1 + reps/30)). 
                This estimation is most accurate for sets under 10 reps.
              </Text>
            </View>

            <Text style={[UI.SHARED.sectionLabel, { marginBottom: 16 }]}>Daily History</Text>
            {sessionLogs.length === 0 ? <View style={styles.emptyLogs}><Text style={styles.emptyLogsText}>No recorded sessions found</Text></View> : (
              <View style={{ gap: 0 }}>
                {sessionLogs.slice(0, displayLimit).map((log) => (
                  <Swipeable key={log.id} onDelete={() => handleDeleteSession(log.sessionIds)} onToggleScroll={setScrollEnabled}>
                    <View style={[UI.SHARED.card, { marginBottom: 0, borderRadius: 0 }]}>
                      <View style={styles.logCardHeader}>
                        <Pressable onPress={() => handleEditDate(log.sessionIds, log.rawDate.toISOString())} style={({ pressed }) => [styles.dateRow, pressed && { opacity: 0.6 }]}><Calendar size={14} color={COLORS.TEXT_TERTIARY} /><Text style={styles.logDate}>{log.date}</Text></Pressable>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                          {log.isPR && (
                            <View style={styles.prBadge}>
                              <Text style={styles.prBadgeText}>PR</Text>
                            </View>
                          )}
                          <Text style={styles.logVolume}>{Math.round(log.volume)} {unit}</Text>
                        </View>
                      </View>
                      <View style={styles.setsList}>
                        {log.sets.map((s: any) => {
                          const isEditing = editingSet?.setId === s.id;
                          if (isEditing) {
                            return (
                              <View key={s.id} style={styles.editRow}>
                                <TextInput style={styles.editInput} value={editingSet.weight} onChangeText={(v) => setEditingSet({ ...editingSet, weight: v })} keyboardType="numeric" autoFocus />
                                <Text style={styles.setTagX}>×</Text>
                                <TextInput style={styles.editInput} value={editingSet.reps} onChangeText={(v) => setEditingSet({ ...editingSet, reps: v })} keyboardType="numeric" />
                                <Pressable onPress={handleSaveEdit} style={styles.editIcon}><Check size={16} color={COLORS.ACCENT_GREEN} /></Pressable>
                                <Pressable onPress={() => setEditingSet(null)} style={styles.editIcon}><X size={16} color={COLORS.DANGER} /></Pressable>
                              </View>
                            );
                          }
                          return <Pressable key={s.id} style={({ pressed }) => [styles.setTag, pressed && { backgroundColor: COLORS.CARD_HOVER }]} onPress={() => handleStartEdit(s.sessionId, s.exerciseId, s.id, s.weight, s.reps)}><Text style={styles.setTagText}>{s.weight} <Text style={styles.setTagX}>×</Text> {s.reps}</Text></Pressable>;
                        })}
                      </View>
                    </View>
                  </Swipeable>
                ))}
                {sessionLogs.length > displayLimit && <View style={styles.footerLoader}><ActivityIndicator size="small" color={COLORS.ACCENT_BLUE} /></View>}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: { paddingTop: UI.HEADER_TOP - 10, paddingHorizontal: UI.LAYOUT_PADDING, paddingBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rangeSelector: { flexDirection: "row", backgroundColor: "#1D1D21", borderRadius: 12, padding: 4 },
  rangeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  rangeBtnActive: { backgroundColor: COLORS.BG },
  rangeText: { color: COLORS.TEXT_TERTIARY, fontSize: 12, fontWeight: "800" },
  rangeTextActive: { color: COLORS.TEXT_PRIMARY },
  content: { paddingHorizontal: UI.LAYOUT_PADDING, paddingBottom: 120 },
  title: { color: COLORS.TEXT_PRIMARY, fontSize: 32, fontWeight: "900", letterSpacing: -1, lineHeight: 38, fontFamily: FONT_FAMILIES.MEDIUM, marginTop: 20, marginBottom: 32 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
  statItem: { flex: 1 },
  statLabel: { color: COLORS.TEXT_TERTIARY, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  statValue: { color: 'white', fontSize: 24, fontWeight: '900', letterSpacing: -1 },
  statUnit: { fontSize: 12, color: COLORS.TEXT_TERTIARY, fontWeight: '700', marginLeft: 2 },
  chartContainer: { alignItems: "center", marginTop: 0, marginBottom: 40 },
  tooltipPlaceholder: { height: 60, justifyContent: 'center', marginBottom: 10 },
  minimalTooltip: { alignItems: 'center' },
  minimalTooltipDate: { color: COLORS.TEXT_TERTIARY, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  minimalTooltipValue: { color: 'white', fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  xAxisLabel: { color: COLORS.TEXT_SECONDARY, fontSize: 12, fontWeight: "700", marginTop: 20, fontFamily: FONT_FAMILIES.MEDIUM, textAlign: "center" },
  disclosureContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  disclosureText: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  logsSection: { marginTop: 20 },
  logCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  logDate: { color: COLORS.TEXT_SECONDARY, fontSize: 14, fontWeight: "600" },
  logVolume: { color: COLORS.ACCENT_BLUE, fontSize: 14, fontWeight: "800" },
  prBadge: { backgroundColor: "rgba(250, 204, 0, 0.15)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: "rgba(250, 204, 0, 0.3)" },
  prBadgeText: { color: COLORS.ACCENT_YELLOW, fontSize: 10, fontWeight: "900" },
  setsList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  setTag: { backgroundColor: "#1D1D21", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  setTagText: { color: COLORS.TEXT_PRIMARY, fontSize: 13, fontWeight: "700" },
  setTagX: { color: COLORS.TEXT_TERTIARY, fontSize: 10, marginHorizontal: 4 },
  editRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#1D1D21", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.ACCENT_BLUE },
  editInput: { color: COLORS.TEXT_PRIMARY, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 13, fontWeight: "700", width: 35, textAlign: "center", padding: 0 },
  editIcon: { marginLeft: 8, padding: 4 },
  emptyLogs: { padding: 40, alignItems: "center" },
  emptyLogsText: { color: COLORS.TEXT_TERTIARY, fontSize: 14, fontWeight: "600" },
  footerLoader: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  loadMoreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, marginTop: 8 },
  loadMoreText: { color: COLORS.TEXT_SECONDARY, fontSize: 14, fontWeight: "700", fontFamily: FONT_FAMILIES.MEDIUM },
});
