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
import { ChevronLeft, Calendar, Zap, Trash2, Check, X, ChevronDown } from "lucide-react-native";
import Svg, { Rect, Line, Path, Text as SvgText, Circle } from "react-native-svg";
import { useAppRouter } from "@/utils/navigation";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import { toTitleCase } from "@/utils/string";
import { convertWeight } from "@/utils/conversions";

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
  
  const history = useMemo(() => 
    allHistory.filter(s => !s.deletedAt), 
    [allHistory]
  );

  const deleteHistorySession = useWorkoutSessionStore((s) => s.deleteHistorySession);
  const updateHistorySet = useWorkoutSessionStore((s) => s.updateHistorySet);
  const fetchMoreHistory = useWorkoutSessionStore((s) => s.fetchMoreHistory);
  const hasMoreHistoryOnServer = useWorkoutSessionStore((s) => s.hasMoreHistory);
  
  const [range, setRange] = useState<TimeRange>("30D");
  const [displayLimit, setDisplayLimit] = useState(10);
  const [loadingMore, setLoadingMore] = useState(false);

  // Inline editing state
  const [editingSet, setEditingSet] = useState<{
    sessionId: string;
    exerciseId: string;
    setId: string;
    weight: string;
    reps: string;
  } | null>(null);

  const processedData = useMemo(() => {
    const now = new Date();
    const data: { label: string; value: number; timestamp: number }[] = [];
    
    let bucketCount = 0;
    let bucketType: 'day' | 'week' | 'month' = 'day';

    if (range === "30D") {
      bucketCount = 30;
      bucketType = 'day';
    } else if (range === "6M") {
      bucketCount = 24; 
      bucketType = 'week';
    } else {
      bucketCount = 12; 
      bucketType = 'month';
    }

    for (let i = bucketCount - 1; i >= 0; i--) {
      const d = new Date(now);
      if (bucketType === 'day') d.setDate(d.getDate() - i);
      else if (bucketType === 'week') d.setDate(d.getDate() - i * 7);
      else d.setMonth(d.getMonth() - i);

      if (bucketType === 'week') {
        const day = d.getDay();
        d.setDate(d.getDate() - day);
      }
      if (bucketType === 'month') d.setDate(1);
      d.setHours(0, 0, 0, 0);

      data.push({ 
        label: bucketType === 'month' ? d.toLocaleString('default', { month: 'short' }) : "", 
        value: 0, 
        timestamp: d.getTime() 
      });
    }

    const lastSessionWithEx = [...history].reverse().find(s => 
      s.exercises.find(e => e.name.toLowerCase() === exerciseName.toLowerCase())
    );
    const targetUnit = lastSessionWithEx?.exercises.find(e => e.name.toLowerCase() === exerciseName.toLowerCase())?.weightUnit || "kg";

    const sessionLogs: { 
      sessionId: string;
      exerciseId: string;
      date: string; 
      volume: number; 
      sets: { id: string; weight: number; reps: number }[] 
    }[] = [];

    history.forEach((session) => {
      const sessionDate = new Date(session.completedAt || session.startedAt);
      const exercise = session.exercises.find(
        (e) => e.name.toLowerCase() === exerciseName.toLowerCase()
      );

      if (exercise) {
        let sessionVolume = 0;
        const sets: { id: string; weight: number; reps: number }[] = [];
        
        exercise.sets.forEach(s => {
          if (s.completedAt && s.weight !== null && s.reps !== null) {
            const normalizedWeight = convertWeight(s.weight, exercise.weightUnit || "kg", targetUnit) || 0;
            const vol = normalizedWeight * s.reps;
            sessionVolume += vol;
            sets.push({ id: s.id, weight: s.weight, reps: s.reps });
          }
        });
        
        if (sets.length > 0) {
          sessionLogs.push({
            sessionId: session._id,
            exerciseId: exercise.id,
            date: sessionDate.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' }),
            volume: sessionVolume,
            sets
          });
        }
        
        const bucketIdx = data.findIndex((b, idx) => {
          const nextBucketTs = data[idx + 1]?.timestamp || Infinity;
          return sessionDate.getTime() >= b.timestamp && sessionDate.getTime() < nextBucketTs;
        });

        if (bucketIdx !== -1) {
          data[bucketIdx].value += sessionVolume;
        }
      }
    });

    return { buckets: data, unit: targetUnit, sessionLogs };
  }, [history, exerciseName, range]);

  const { buckets, unit, sessionLogs } = processedData;

  const handleDeleteSession = (sessionId: string) => {
    Alert.alert(
      "Delete Session",
      "Are you sure you want to delete this workout session from your history? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: () => deleteHistorySession(sessionId) 
        }
      ]
    );
  };

  const handleStartEdit = (sessionId: string, exerciseId: string, setId: string, weight: number, reps: number) => {
    setEditingSet({
      sessionId,
      exerciseId,
      setId,
      weight: weight.toString(),
      reps: reps.toString(),
    });
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

  const handleLoadMore = async () => {
    if (sessionLogs.length > displayLimit) {
      setDisplayLimit(prev => prev + 10);
      return;
    }

    if (hasMoreHistoryOnServer) {
      setLoadingMore(true);
      try {
        await fetchMoreHistory();
        setDisplayLimit(prev => prev + 10);
      } catch (err) {
        console.error("Failed to load more history:", err);
      } finally {
        setLoadingMore(false);
      }
    }
  };

  const maxVolume = Math.max(100, ...buckets.map(d => d.value));
  const chartWidth = SCREEN_WIDTH - (CHART_PADDING_HORIZONTAL * 2);
  const barWidth = Math.max(4, (chartWidth / buckets.length) * 0.6);
  const gap = (chartWidth - (buckets.length * barWidth)) / (buckets.length - 1);

  const activePoints = useMemo(() => {
    return buckets
      .map((d, i) => {
        if (d.value === 0) return null;
        const x = 50 + i * (barWidth + gap) + barWidth / 2;
        const normalized = Math.min(d.value / maxVolume, 1);
        const y = CHART_HEIGHT - (normalized * 120 + 40); 
        return { x, y };
      })
      .filter((p): p is { x: number; y: number } => p !== null);
  }, [buckets, maxVolume, barWidth, gap]);

  const linePath = useMemo(() => {
    if (activePoints.length < 2) return "";
    return activePoints.reduce((acc, p, i, arr) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = arr[i - 1];
      const cpX = (prev.x + p.x) / 2;
      return `${acc} Q ${cpX} ${prev.y}, ${p.x} ${p.y}`;
    }, "");
  }, [activePoints]);

  const hasMoreToShow = sessionLogs.length > displayLimit || hasMoreHistoryOnServer;

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={UI.SHARED.iconBtn}>
            <ChevronLeft size={28} color={COLORS.TEXT_PRIMARY} />
          </Pressable>
          <View style={styles.rangeSelector}>
            {(["30D", "6M", "1Y"] as TimeRange[]).map((r) => (
              <Pressable 
                key={r} 
                onPress={() => setRange(r)}
                style={[styles.rangeBtn, range === r && styles.rangeBtnActive]}
              >
                <Text style={[styles.rangeText, range === r && styles.rangeTextActive]}>{r}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>
            Volume Trends:{"\n"}
            <Text style={{ color: COLORS.ACCENT_GREEN }}>{toTitleCase(exerciseName)}</Text>
          </Text>

          <Text style={styles.subtitle}>
            Tracking your total weight moved ({unit}) per period. Consistent volume increases are a key indicator of progress.
          </Text>

          <View style={styles.chartContainer}>
            <Svg width={chartWidth + 50} height={CHART_HEIGHT}>
              {[0, 0.5, 1].map((v) => {
                const yPos = CHART_HEIGHT - (v * 150 + 20);
                const labelValue = Math.round(v * maxVolume);
                return (
                  <React.Fragment key={v}>
                    <Line
                      x1="45"
                      y1={yPos}
                      x2={chartWidth + 50}
                      y2={yPos}
                      stroke="rgba(255,255,255,0.05)"
                      strokeWidth="1"
                    />
                    <SvgText
                      x="35"
                      y={yPos + 4}
                      fill={COLORS.TEXT_TERTIARY}
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="end"
                      fontFamily={FONT_FAMILIES.MEDIUM}
                    >
                      {labelValue >= 1000 ? `${(labelValue / 1000).toFixed(1)}k` : labelValue}
                    </SvgText>
                  </React.Fragment>
                );
              })}

              <SvgText
                x="10"
                y={CHART_HEIGHT / 2}
                fill={COLORS.TEXT_TERTIARY}
                fontSize="10"
                fontWeight="bold"
                fontFamily={FONT_FAMILIES.MEDIUM}
                transform={`rotate(-90, 10, ${CHART_HEIGHT / 2})`}
                textAnchor="middle"
              >{`VOLUME (${unit.toUpperCase()})`}</SvgText>

              {buckets.map((d, i) => {
                const barHeight = (d.value / maxVolume) * (CHART_HEIGHT - 60);
                const x = 50 + i * (barWidth + gap);
                return (
                  <Rect
                    key={i}
                    x={x}
                    y={CHART_HEIGHT - barHeight - 20}
                    width={barWidth}
                    height={Math.max(2, barHeight)}
                    fill={d.value === 0 ? "rgba(255,255,255,0.05)" : COLORS.ACCENT_BLUE}
                    rx={barWidth / 4}
                  />
                );
              })}

              {buckets.map((d, i) => {
                const shouldShowLabel = i === 0 || i === Math.floor(buckets.length / 2) || i === buckets.length - 1;
                if (!shouldShowLabel) return null;

                const x = 50 + i * (barWidth + gap) + barWidth / 2;
                const date = new Date(d.timestamp);
                let label = "";
                
                if (range === "30D") {
                  label = `${date.getDate()} ${date.toLocaleString('default', { month: 'short' })}`;
                } else if (range === "6M") {
                  label = date.toLocaleString('default', { month: 'short', year: '2-digit' });
                } else {
                  label = date.toLocaleString('default', { month: 'short' });
                }

                return (
                  <SvgText
                    key={`label-${i}`}
                    x={x}
                    y={CHART_HEIGHT - 2}
                    fill={COLORS.TEXT_TERTIARY}
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                    fontFamily={FONT_FAMILIES.MEDIUM}
                  >
                    {label}
                  </SvgText>
                );
              })}

              {linePath ? (
                <Path 
                  d={linePath} 
                  fill="none" 
                  stroke={COLORS.ACCENT_GREEN} 
                  strokeWidth={2} 
                  opacity={0.8} 
                />
              ) : null}

              {activePoints.map((p, i) => (
                <Circle 
                  key={i} 
                  cx={p.x} 
                  cy={p.y} 
                  r={3} 
                  fill={COLORS.ACCENT_GREEN} 
                />
              ))}
            </Svg>

            <Text style={styles.xAxisLabel}>
              Total volume ({unit}) over the last {range === "30D" ? "30 days" : range === "6M" ? "6 months" : "year"}
            </Text>
          </View>

          <View style={styles.logsSection}>
            <View style={styles.logsHeader}>
              <Zap size={20} color={COLORS.ACCENT_YELLOW} />
              <Text style={styles.logsTitle}>Recent Sessions</Text>
            </View>

            {sessionLogs.length === 0 ? (
              <View style={styles.emptyLogs}>
                <Text style={styles.emptyLogsText}>No recorded sessions for this exercise.</Text>
              </View>
            ) : (
              <>
                {sessionLogs.slice(0, displayLimit).map((log, idx) => (
                  <View key={idx} style={UI.SHARED.card}>
                    <View style={styles.logCardHeader}>
                      <View style={styles.dateRow}>
                        <Calendar size={14} color={COLORS.TEXT_TERTIARY} />
                        <Text style={styles.logDate}>{log.date}</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <Text style={styles.logVolume}>{Math.round(log.volume)} {unit}</Text>
                        <Pressable 
                          onPress={() => handleDeleteSession(log.sessionId)}
                          hitSlop={10}
                        >
                          <Trash2 size={16} color={COLORS.DANGER} opacity={0.8} />
                        </Pressable>
                      </View>
                    </View>
                    
                    <View style={styles.setsList}>
                      {log.sets.map((s, sIdx) => {
                        const isEditing = editingSet?.setId === s.id;
                        
                        if (isEditing) {
                          return (
                            <View key={sIdx} style={styles.editRow}>
                              <TextInput
                                style={styles.editInput}
                                value={editingSet.weight}
                                onChangeText={(v) => setEditingSet({ ...editingSet, weight: v })}
                                keyboardType="numeric"
                                autoFocus
                                placeholder="kg"
                              />
                              <Text style={styles.setTagX}>×</Text>
                              <TextInput
                                style={styles.editInput}
                                value={editingSet.reps}
                                onChangeText={(v) => setEditingSet({ ...editingSet, reps: v })}
                                keyboardType="numeric"
                                placeholder="reps"
                              />
                              <Pressable onPress={handleSaveEdit} style={styles.editIcon}>
                                <Check size={16} color={COLORS.ACCENT_GREEN} />
                              </Pressable>
                              <Pressable onPress={() => setEditingSet(null)} style={styles.editIcon}>
                                <X size={16} color={COLORS.DANGER} />
                              </Pressable>
                            </View>
                          );
                        }

                        return (
                          <Pressable 
                            key={sIdx} 
                            style={({ pressed }) => [
                              styles.setTag,
                              pressed && { backgroundColor: COLORS.CARD_HOVER }
                            ]}
                            onPress={() => handleStartEdit(log.sessionId, log.exerciseId, s.id, s.weight, s.reps)}
                          >
                            <Text style={styles.setTagText}>
                              {s.weight} <Text style={styles.setTagX}>×</Text> {s.reps}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}

                {hasMoreToShow && (
                  <Pressable 
                    style={[styles.loadMoreBtn, loadingMore && { opacity: 0.5 }]} 
                    onPress={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <ActivityIndicator size="small" color={COLORS.TEXT_SECONDARY} />
                    ) : (
                      <>
                        <Text style={styles.loadMoreText}>Load More Sessions</Text>
                        <ChevronDown size={16} color={COLORS.TEXT_SECONDARY} />
                      </>
                    )}
                  </Pressable>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: {
    paddingTop: UI.HEADER_TOP - 10,
    paddingHorizontal: UI.LAYOUT_PADDING,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rangeSelector: {
    flexDirection: "row",
    backgroundColor: "#1D1D21",
    borderRadius: 12,
    padding: 4,
  },
  rangeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  rangeBtnActive: {
    backgroundColor: COLORS.BG,
  },
  rangeText: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 12,
    fontWeight: "800",
  },
  rangeTextActive: {
    color: COLORS.TEXT_PRIMARY,
  },
  content: { paddingHorizontal: UI.LAYOUT_PADDING, paddingBottom: 120 },
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -1,
    lineHeight: 38,
    fontFamily: FONT_FAMILIES.MEDIUM,
    marginTop: 20,
    marginBottom: 24,
  },
  subtitle: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: FONT_FAMILIES.MEDIUM,
    marginBottom: 40,
  },
  chartContainer: { alignItems: "center", marginTop: 20, marginBottom: 40 },
  xAxisLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 20,
    fontFamily: FONT_FAMILIES.MEDIUM,
    textAlign: "center",
  },
  logsSection: {
    marginTop: 20,
  },
  logsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  logsTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  logCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  logDate: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: "600",
  },
  logVolume: {
    color: COLORS.ACCENT_GREEN,
    fontSize: 14,
    fontWeight: "800",
  },
  setsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  setTag: {
    backgroundColor: "#1D1D21",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  setTagText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "700",
  },
  setTagX: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 10,
    marginHorizontal: 4,
  },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1D1D21",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  editInput: {
    color: COLORS.TEXT_PRIMARY,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 13,
    fontWeight: "700",
    width: 35, // Fixed width prevents text disappearance
    textAlign: "center",
    padding: 0,
  },
  editIcon: {
    marginLeft: 8,
    padding: 4,
  },
  emptyLogs: {
    padding: 40,
    alignItems: "center",
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 20,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
  },
  emptyLogsText: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  loadMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    marginTop: 8,
  },
  loadMoreText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
});
