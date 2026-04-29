'use client';

import React, { useMemo, useState, useRef, useEffect } from "react";
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
  PanResponder,
} from "react-native";
import { ChevronLeft, Calendar, Zap, Check, X, ChevronDown, Trophy, Activity, TrendingUp } from "lucide-react-native";
import Svg, { Path, Line, Text as SvgText, Rect, G } from "react-native-svg";
import { useAppRouter } from "@/utils/navigation";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { workoutStorage } from "@/storage/workoutStorage";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import MuscleSelector from "@/src/components/MuscleSelector";
import { MuscleGroup } from "@/constants/muscles";
import { toTitleCase } from "@/utils/string";
import { Swipeable } from "@/src/components/Swipeable";
import { HapticFeedback } from "@/src/utils/haptics";
import { WorkoutSession } from "@/src/types";
import { getExerciseIdentityKey, normalizeExerciseIdentityKey } from "@/utils/exerciseIdentity";
import { useUiPreferencesStore } from "@/stores/uiPreferencesStore";
import { resolveEffectiveStrengthLoad } from "@/utils/bodyweightAnalytics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_HEIGHT = 220;
const CHART_PADDING_HORIZONTAL = 40;

type TimeRange = "30D" | "6M" | "1Y";

interface ExerciseVolumeScreenProps {
  exerciseKey: string;
}

export default function ExerciseVolumeScreen({ exerciseKey }: ExerciseVolumeScreenProps) {
  const router = useAppRouter();
  const historyCache = useWorkoutSessionStore((s) => s.history);
  const historyIndex = useWorkoutSessionStore((s) => s.historyIndex);
  const deleteHistorySession = useWorkoutSessionStore((s) => s.deleteHistorySession);
  const updateHistorySet = useWorkoutSessionStore((s) => s.updateHistorySet);
  const updateSessionDate = useWorkoutSessionStore((s) => s.updateSessionDate);
  const updateMusclesInHistory = useWorkoutSessionStore((s) => s.updateMusclesInHistory);
  const analyticsBodyweight = useUiPreferencesStore((s) => s.analyticsBodyweight);
  const analyticsBodyweightUnit = useUiPreferencesStore((s) => s.analyticsBodyweightUnit);
  
  const [loading, setLoading] = useState(true);
  const [localFullHistory, setLocalFullHistory] = useState<WorkoutSession[]>([]);
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
  const decimalKeyboardType = "decimal-pad";
  const normalizedExerciseKey = normalizeExerciseIdentityKey(exerciseKey);

  /**
   * Shard Hydration Strategy:
   * Since the main store only keeps ~15 sessions in RAM, we manually
   * load ALL relevant shards from disk to ensure the chart is complete.
   */
  useEffect(() => {
    let isMounted = true;
    const loadShards = async () => {
      setLoading(true);
      try {
        // 1. Identify which IDs we already have in the 15-session RAM cache
        const cachedIds = new Set(historyCache.map(s => s._id));
        
        // 2. Identify missing IDs from the global index
        const missingIds = historyIndex.filter(id => !cachedIds.has(id));
        
        // 3. Load all missing shards from disk (Multi-get is efficient)
        const shards = await workoutStorage.getBatch(missingIds);
        
        // 4. Combine and filter for the target exercise
        const combined = [...historyCache, ...shards]
          .filter(
            (s) =>
              !s.deletedAt &&
              s.exercises.some((e) => getExerciseIdentityKey(e) === normalizedExerciseKey)
          )
          .sort((a, b) => {
            const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
            const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
            return bTime - aTime;
          });

        if (isMounted) {
          setLocalFullHistory(combined);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to hydrate shards for trends:", err);
        if (isMounted) setLoading(false);
      }
    };

    loadShards();
    return () => { isMounted = false; };
  }, [normalizedExerciseKey, historyIndex, historyCache]);

  const history = localFullHistory;

  const currentMuscles = useMemo(() => {
    // Find the most recent session that has this exercise to get its categories
    const lastSession = history.find((s) =>
      s.exercises.some((e) => getExerciseIdentityKey(e) === normalizedExerciseKey)
    );
    const ex = lastSession?.exercises.find(
      (e) => getExerciseIdentityKey(e) === normalizedExerciseKey
    );
    return ex?.muscles || [];
  }, [history, normalizedExerciseKey]);

  const displayName = useMemo(() => {
    const lastSession = history.find((s) =>
      s.exercises.some((e) => getExerciseIdentityKey(e) === normalizedExerciseKey)
    );
    const ex = lastSession?.exercises.find(
      (e) => getExerciseIdentityKey(e) === normalizedExerciseKey
    );
    return ex?.name || exerciseKey;
  }, [exerciseKey, history, normalizedExerciseKey]);

  const handleMusclesChange = (muscles: MuscleGroup[]) => {
    updateMusclesInHistory(normalizedExerciseKey, muscles);
  };

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
    let max1RM = 0;
    let maxDailyVolume = 0;
    let lastVolume = 0;

    // First pass: Global maxes
    history.forEach(s => {
      s.exercises.forEach(ex => {
        if (getExerciseIdentityKey(ex) === normalizedExerciseKey) {
          ex.sets.forEach(set => {
            if (set.reps !== null && Number.isFinite(set.reps)) {
              const effectiveLoad = resolveEffectiveStrengthLoad(
                ex,
                set.weight,
                ex.weightUnit || "kg",
                ex.weightUnit || "kg",
                analyticsBodyweight,
                analyticsBodyweightUnit
              );
              if (effectiveLoad === null || !Number.isFinite(effectiveLoad)) return;
              const current1RM = effectiveLoad * (1 + set.reps / 30);
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

    const lastSessionWithEx = [...history].reverse().find((s) => 
      s.exercises.find((e) => getExerciseIdentityKey(e) === normalizedExerciseKey)
    );
    const targetUnit =
      lastSessionWithEx?.exercises.find(
        (e) => getExerciseIdentityKey(e) === normalizedExerciseKey
      )?.weightUnit || "kg";

    // Second pass: Group logs by local date
    const logsByDate: { [key: string]: any } = {};

    history.forEach((session) => {
      const sessionDate = new Date(session.completedAt || session.startedAt);
      const dateKey = `${sessionDate.getFullYear()}-${(sessionDate.getMonth() + 1).toString().padStart(2, '0')}-${sessionDate.getDate().toString().padStart(2, '0')}`;
      
      const sessionExercises = session.exercises.filter(
        (e) => getExerciseIdentityKey(e) === normalizedExerciseKey
      );

      sessionExercises.forEach(exercise => {
        let totalExerciseVolume = 0;
        const completedSets: any[] = [];

        exercise.sets.forEach(s => {
          if (s.completedAt && s.reps !== null && Number.isFinite(s.reps)) {
            const effectiveLoad = resolveEffectiveStrengthLoad(
              exercise,
              s.weight,
              exercise.weightUnit || "kg",
              targetUnit,
              analyticsBodyweight,
              analyticsBodyweightUnit
            );
            if (effectiveLoad === null || !Number.isFinite(effectiveLoad)) return;
            totalExerciseVolume += effectiveLoad * s.reps;
            completedSets.push({ ...s, sessionId: session._id, exerciseId: exercise.id });
          }
        });

        if (completedSets.length > 0) {
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

          // Add to chart buckets
          data.forEach(bucket => {
            if (sessionDate.getTime() >= bucket.timestamp && sessionDate.getTime() <= bucket.endTimestamp) {
              bucket.value += totalExerciseVolume;
            }
          });
        }
      });
    });

    const rawLogs = Object.values(logsByDate) as any[];

    if (rawLogs.length > 0) {
      maxDailyVolume = Math.max(...rawLogs.map((log: any) => log.volume));
      rawLogs.forEach((log: any) => {
        log.isPR = maxDailyVolume > 0 && log.volume === maxDailyVolume;
      });

      const latestLog = rawLogs.reduce((latest: any, log: any) =>
        log.rawDate > latest.rawDate ? log : latest
      );
      lastVolume = latestLog.volume;
    }

    const sessionLogs = rawLogs.sort((a: any, b: any) => {
      // Pin PRs to the top
      if (a.isPR && !b.isPR) return -1;
      if (!a.isPR && b.isPR) return 1;
      // Otherwise reverse chronological
      return b.rawDate - a.rawDate;
    });
    
    // Set PR star to the highest volume bar in the CURRENT chart view
    const chartMaxVolume = Math.max(...data.map(d => d.value));
    if (chartMaxVolume > 0) {
      data.forEach(d => {
        d.hasPR = d.value === chartMaxVolume;
      });
    }

    return { buckets: data, unit: targetUnit, sessionLogs, stats: { max1RM, maxDailyVolume, lastVolume } };
  }, [
    analyticsBodyweight,
    analyticsBodyweightUnit,
    history,
    normalizedExerciseKey,
    range,
  ]);

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
    Alert.prompt("Edit Date", "Enter new date (YYYY-MM-DD):", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Save", 
        onPress: (newDate?: string) => {
          if (newDate && /^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
            ids.forEach(id => {
              const session = history.find(s => s._id === id);
              if (session) {
                const oldTime = (session.completedAt || session.startedAt).split('T')[1] || "12:00:00.000Z";
                updateSessionDate(id, `${newDate}T${oldTime}`);
              }
            });
          }
        } 
      }
    ], "plain-text", currentDate);
  };

  const handleStartEdit = (sessionId: string, exId: string, setId: string, weight: number | null, reps: number | null) => {
    setEditingSet({ sessionId, exerciseId: exId, setId, weight: (weight ?? 0).toString(), reps: (reps ?? 0).toString() });
  };

  const handleSaveEdit = () => {
    if (!editingSet) return;
    const w = Number(editingSet.weight.trim().replace(",", "."));
    const r = Number(editingSet.reps.trim());
    if (Number.isFinite(w) && Number.isFinite(r)) {
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

  const chartPanResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        // Expand touch area by accounting for the expanded overlay offset
        const x = evt.nativeEvent.locationX - 60; 
        const step = barWidth + gap;
        const rawIndex = Math.max(0, Math.min(buckets.length - 1, Math.round(x / step)));
        
        // Find nearest bucket with data
        let resolvedIndex = -1;
        let minDistance = Infinity;
        buckets.forEach((b, i) => {
          if (b.value > 0) {
            const dist = Math.abs(i - rawIndex);
            if (dist < minDistance) {
              minDistance = dist;
              resolvedIndex = i;
            }
          }
        });

        if (resolvedIndex !== -1) {
          setActiveBucketIdx(prev => {
            if (prev === resolvedIndex) {
              HapticFeedback.light();
              return null;
            }
            HapticFeedback.selection();
            return resolvedIndex;
          });
        }
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX - 60;
        const step = barWidth + gap;
        const rawIndex = Math.max(0, Math.min(buckets.length - 1, Math.round(x / step)));

        // Find nearest bucket with data
        let resolvedIndex = -1;
        let minDistance = Infinity;
        buckets.forEach((b, i) => {
          if (b.value > 0) {
            const dist = Math.abs(i - rawIndex);
            if (dist < minDistance) {
              minDistance = dist;
              resolvedIndex = i;
            }
          }
        });

        if (resolvedIndex !== -1) {
          setActiveBucketIdx(prev => {
            if (prev !== resolvedIndex) {
              HapticFeedback.selection();
              return resolvedIndex;
            }
            return prev;
          });
        }
      },
    }),
    [chartWidth, buckets, barWidth, gap]
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
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
          <Text style={styles.title}>Volume Trends:{"\n"}<Text style={{ color: COLORS.ACCENT_GREEN }}>{toTitleCase(displayName)}</Text></Text>

          {/* Muscle Category Editor */}
          <View style={styles.categorySection}>
            <MuscleSelector 
              selectedMuscles={currentMuscles}
              onSelect={handleMusclesChange}
              label="Exercise Categories"
            />
          </View>

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

            <View style={{ alignItems: 'center' }}>
              <Svg width={chartWidth + 60} height={CHART_HEIGHT + 40}>
                <SvgText x="35" y="10" fill={COLORS.TEXT_TERTIARY} fontSize="9" fontWeight="900" fontFamily={FONT_FAMILIES.MONO} textAnchor="start" letterSpacing="0.5">{yLabel}</SvgText>

                {[0, 0.5, 1].map((v) => {
                  const y = CHART_HEIGHT - (v * 150 + 20);
                  const label = Math.round(v * maxVolume);
                  return (
                    <React.Fragment key={v}>
                      <Line x1="40" y1={y} x2={chartWidth + 40} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                      <SvgText x="32" y={y + 4} fill={COLORS.TEXT_TERTIARY} fontSize="10" fontWeight="800" textAnchor="end" fontFamily={FONT_FAMILIES.MONO}>{label >= 1000 ? `${(label / 1000).toFixed(1)}k` : label}</SvgText>
                    </React.Fragment>
                  );
                })}

                {buckets.map((d, i) => {
                  const barHeight = (d.value / maxVolume) * (CHART_HEIGHT - 60);
                  const x = 40 + i * (barWidth + gap);
                  const y = CHART_HEIGHT - barHeight - 20;
                  const isActive = activeBucketIdx === i;

                  return (
                    <G key={i}>
                      <Rect 
                        x={x} 
                        y={y} 
                        width={barWidth} 
                        height={Math.max(2, barHeight)} 
                        fill={d.value === 0 ? "rgba(255,255,255,0.05)" : (isActive ? COLORS.ACCENT_BLUE : "rgba(11, 130, 255, 0.6)")} 
                        rx={barWidth / 2} 
                      />
                      {d.hasPR && <SvgText x={x + barWidth / 2} y={y - 8} fill={isActive ? COLORS.ACCENT_YELLOW : "rgba(250, 204, 0, 0.8)"} fontSize="10" fontWeight="900" textAnchor="middle" pointerEvents="none">★</SvgText>}
                    </G>
                  );
                })}

                {buckets.map((d, i) => {
                  if (!d.label) return null;
                  return <SvgText key={`date-${i}`} x={40 + i * (barWidth + gap) + barWidth / 2} y={CHART_HEIGHT + 10} fill={COLORS.TEXT_TERTIARY} fontSize="9" fontWeight="800" textAnchor="middle" fontFamily={FONT_FAMILIES.MONO}>{d.label}</SvgText>;
                })}

                <SvgText x={chartWidth / 2 + 40} y={CHART_HEIGHT + 30} fill={COLORS.TEXT_TERTIARY} fontSize="9" fontWeight="900" textAnchor="middle" fontFamily={FONT_FAMILIES.MONO} letterSpacing="1">DATE</SvgText>
                {linePath ? <Path d={linePath} fill="none" stroke={COLORS.ACCENT_GREEN} strokeWidth={2.5} opacity={0.8} strokeLinecap="round" strokeLinejoin="round" /> : null}
              </Svg>
              
              {/* Invisible High-Performance Touch Overlay */}
              <View 
                {...chartPanResponder.panHandlers}
                style={{
                  position: 'absolute',
                  left: -20,
                  top: 0,
                  width: chartWidth + 100,
                  height: CHART_HEIGHT + 40,
                  backgroundColor: 'transparent',
                }} 
              />
            </View>
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
                    <View style={[
                      UI.SHARED.card, 
                      { marginBottom: 0, borderRadius: 32 },
                      log.isPR && { borderColor: COLORS.ACCENT_YELLOW, borderWidth: 3 }
                    ]}>
                      <View style={styles.logCardHeader}>
                        <Pressable onPress={() => handleEditDate(log.sessionIds, log.rawDate.toISOString())} style={({ pressed }) => [styles.dateRow, pressed && { opacity: 0.6 }]}><Calendar size={14} color={COLORS.TEXT_TERTIARY} /><Text style={styles.logDate}>{log.date}</Text></Pressable>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                          {log.isPR && (
                            <View style={[styles.prBadge, { backgroundColor: "rgba(250, 204, 0, 0.2)" }]}>
                              <Text style={styles.prBadgeText}>PR</Text>
                            </View>
                          )}
                          <Text style={[styles.logVolume, log.isPR && { color: COLORS.ACCENT_YELLOW }]}>{Math.round(log.volume)} {unit}</Text>
                        </View>
                      </View>
                      <View style={styles.setsList}>
                        {log.sets.map((s: any) => {
                          const isEditing = editingSet?.setId === s.id;
                          if (isEditing) {
                            return (
                              <View key={s.id} style={styles.editRow}>
                                <TextInput style={styles.editInput} value={editingSet?.weight ?? ""} onChangeText={(v) => setEditingSet((prev) => (prev ? { ...prev, weight: v } : prev))} keyboardType={decimalKeyboardType} autoFocus />
                                <Text style={styles.setTagX}>×</Text>
                                <TextInput style={styles.editInput} value={editingSet?.reps ?? ""} onChangeText={(v) => setEditingSet((prev) => (prev ? { ...prev, reps: v } : prev))} keyboardType="numeric" />
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
  title: { color: COLORS.TEXT_PRIMARY, fontSize: 32, fontWeight: "900", letterSpacing: -1, lineHeight: 38, fontFamily: FONT_FAMILIES.MEDIUM, marginTop: 20, marginBottom: 24 },
  categorySection: {
    marginBottom: 32,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
  statItem: { flex: 1 },
  statLabel: { color: COLORS.TEXT_TERTIARY, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  statValue: { color: 'white', fontSize: 24, fontWeight: '900', letterSpacing: -1, fontFamily: FONT_FAMILIES.MONO },
  statUnit: { fontSize: 12, color: COLORS.TEXT_TERTIARY, fontWeight: '700', marginLeft: 2, fontFamily: FONT_FAMILIES.MONO },
  chartContainer: { alignItems: "center", marginTop: 0, marginBottom: 40 },
  tooltipPlaceholder: { height: 60, justifyContent: 'center', marginBottom: 10 },
  minimalTooltip: { alignItems: 'center' },
  minimalTooltipDate: { color: COLORS.TEXT_TERTIARY, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  minimalTooltipValue: { color: 'white', fontSize: 28, fontWeight: '900', letterSpacing: -1, fontFamily: FONT_FAMILIES.MONO },
  xAxisLabel: { color: COLORS.TEXT_SECONDARY, fontSize: 12, fontWeight: "700", marginTop: 20, fontFamily: FONT_FAMILIES.MONO, textAlign: "center" },
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
  logVolume: { color: COLORS.ACCENT_BLUE, fontSize: 14, fontWeight: "800", fontFamily: FONT_FAMILIES.MONO },
  prBadge: { backgroundColor: "rgba(250, 204, 0, 0.15)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: "rgba(250, 204, 0, 0.3)" },
  prBadgeText: { color: COLORS.ACCENT_YELLOW, fontSize: 10, fontWeight: "900" },
  setsList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  setTag: { backgroundColor: "#1D1D21", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  setTagText: { color: COLORS.TEXT_PRIMARY, fontSize: 13, fontWeight: "700", fontFamily: FONT_FAMILIES.MONO },
  setTagX: { color: COLORS.TEXT_TERTIARY, fontSize: 10, marginHorizontal: 4, fontFamily: FONT_FAMILIES.MONO },
  editRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#1D1D21", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.ACCENT_BLUE },
  editInput: { color: COLORS.TEXT_PRIMARY, fontFamily: FONT_FAMILIES.MONO, fontSize: 13, fontWeight: "700", width: 35, textAlign: "center", padding: 0 },
  editIcon: { marginLeft: 8, padding: 4 },
  emptyLogs: { padding: 40, alignItems: "center" },
  emptyLogsText: { color: COLORS.TEXT_TERTIARY, fontSize: 14, fontWeight: "600" },
  footerLoader: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  loadMoreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, marginTop: 8 },
  loadMoreText: { color: COLORS.TEXT_SECONDARY, fontSize: 14, fontWeight: "700", fontFamily: FONT_FAMILIES.MEDIUM },
});
