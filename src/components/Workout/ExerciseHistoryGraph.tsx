import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import Svg, { Path, Rect, G, Text as SvgText } from "react-native-svg";
import { useShallow } from 'zustand/react/shallow';
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { workoutStorage } from "@/storage/workoutStorage";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { normalizeExerciseIdentityKey, getExerciseIdentityKey } from "@/utils/exerciseIdentity";
import { useUiPreferencesStore } from "@/stores/uiPreferencesStore";
import { isBodyweightStrengthExercise, type WeightUnit } from "@/utils/bodyweightAnalytics";
import { convertWeight } from "@/utils/conversions";
import type { WorkoutSession } from "@/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_HEIGHT = 160;
const MS_PER_DAY = 86400000;

interface ExerciseHistoryGraphProps {
  exerciseKey: string;
}

// Mirrors resolveEffectiveStrengthLoad from utils/bodyweightAnalytics, but takes the
// bodyweight-exercise flag as a precomputed input instead of resolving exercise
// identity on every call, since that resolution only depends on the exercise (not
// the individual set) and previously ran once per set in a per-exercise loop.
function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function resolveEffectiveLoadForKnownBodyweight(
  isBodyweightExercise: boolean,
  loggedWeight: number | null,
  loggedWeightUnit: WeightUnit,
  targetUnit: WeightUnit,
  analyticsBodyweight: number | null,
  analyticsBodyweightUnit: WeightUnit
): number | null {
  if (!isBodyweightExercise) {
    return isFiniteNumber(loggedWeight)
      ? convertWeight(loggedWeight, loggedWeightUnit, targetUnit)
      : loggedWeight;
  }

  const extraLoad = isFiniteNumber(loggedWeight)
    ? convertWeight(loggedWeight, loggedWeightUnit, targetUnit) ?? loggedWeight
    : 0;

  if (!isFiniteNumber(analyticsBodyweight)) {
    return extraLoad;
  }

  const convertedBodyweight =
    convertWeight(analyticsBodyweight, analyticsBodyweightUnit, targetUnit) ??
    analyticsBodyweight;

  return convertedBodyweight + extraLoad;
}

// Local calendar-day index (in the device's local timezone), immune to DST since it
// discards time-of-day and only encodes the Y/M/D via Date.UTC.
function localDayIndex(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY);
}

function ExerciseHistoryGraph({ exerciseKey }: ExerciseHistoryGraphProps) {
  const historyCache = useWorkoutSessionStore(useShallow((s) => s.history));
  const historyIndex = useWorkoutSessionStore(useShallow((s) => s.historyIndex));
  const analyticsBodyweight = useUiPreferencesStore((s) => s.analyticsBodyweight);
  const analyticsBodyweightUnit = useUiPreferencesStore((s) => s.analyticsBodyweightUnit);
  
  const [loading, setLoading] = useState(true);
  const [localFullHistory, setLocalFullHistory] = useState<WorkoutSession[]>([]);
  const normalizedExerciseKey = normalizeExerciseIdentityKey(exerciseKey);

  useEffect(() => {
    let isMounted = true;
    const loadShards = async () => {
      setLoading(true);
      try {
        const cachedIds = new Set(historyCache.map(s => s._id));
        const missingIds = historyIndex.filter(id => !cachedIds.has(id));
        const shards = await workoutStorage.getBatch(missingIds);
        
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
        console.error("Failed to hydrate shards for history graph:", err);
        if (isMounted) setLoading(false);
      }
    };

    loadShards();
    return () => { isMounted = false; };
  }, [normalizedExerciseKey, historyIndex, historyCache]);

  const processedData = useMemo(() => {
    const now = new Date();
    const data: { label: string; value: number; timestamp: number; endTimestamp: number }[] = [];

    // Fixed 30 day view for the card
    const bucketCount = 20;
    const todayDayIndex = localDayIndex(now);

    for (let i = bucketCount - 1; i >= 0; i--) {
      const end = new Date(now);
      end.setDate(end.getDate() - i);
      end.setHours(23, 59, 59, 999);
      
      const start = new Date(end);
      start.setHours(0, 0, 0, 0);

      data.push({ 
        label: i % 5 === 0 ? end.toLocaleDateString('default', { month: 'short', day: 'numeric' }) : "", 
        value: 0, 
        timestamp: start.getTime(),
        endTimestamp: end.getTime(),
      });
    }

    const lastSessionWithEx = [...localFullHistory].reverse().find((s) => 
      s.exercises.find((e) => getExerciseIdentityKey(e) === normalizedExerciseKey)
    );
    const targetUnit =
      lastSessionWithEx?.exercises.find(
        (e) => getExerciseIdentityKey(e) === normalizedExerciseKey
      )?.weightUnit || "kg";

    localFullHistory.forEach((session) => {
      const sessionDate = new Date(session.completedAt || session.startedAt);
      const exercise = session.exercises.find(
        (e) => getExerciseIdentityKey(e) === normalizedExerciseKey
      );

      if (exercise) {
        // Identity/bodyweight resolution depends only on the exercise, not the set,
        // so resolve it once per exercise instead of once per set.
        const exerciseIsBodyweight = isBodyweightStrengthExercise(exercise);

        let totalVolume = 0;
        exercise.sets.forEach(s => {
          if (s.completedAt && s.reps !== null && Number.isFinite(s.reps)) {
            const effectiveLoad = resolveEffectiveLoadForKnownBodyweight(
              exerciseIsBodyweight,
              s.weight,
              exercise.weightUnit || "kg",
              targetUnit,
              analyticsBodyweight,
              analyticsBodyweightUnit
            );
            if (effectiveLoad !== null) totalVolume += effectiveLoad * s.reps;
          }
        });

        // Buckets are evenly spaced, single-day windows, so the target bucket can be
        // computed directly instead of linearly scanning every bucket per session.
        const daysAgo = todayDayIndex - localDayIndex(sessionDate);
        const bucketIndex = bucketCount - 1 - daysAgo;
        if (bucketIndex >= 0 && bucketIndex < bucketCount) {
          data[bucketIndex].value += totalVolume;
        }
      }
    });

    return { buckets: data, unit: targetUnit };
  }, [localFullHistory, normalizedExerciseKey, analyticsBodyweight, analyticsBodyweightUnit]);

  // Chart geometry only depends on processedData, so it's derived once per data
  // change instead of being recomputed (and re-allocated) on every render.
  const chartGeometry = useMemo(() => {
    const { buckets, unit } = processedData;
    const maxVolume = Math.max(100, ...buckets.map(d => d.value));
    const chartWidth = SCREEN_WIDTH - 64; // Card padding + margin
    const barWidth = (chartWidth / buckets.length) * 0.7;
    const gap = (chartWidth - (buckets.length * barWidth)) / (buckets.length - 1);

    const activePoints = buckets
      .map((d, i) => {
        if (d.value === 0) return null;
        const x = i * (barWidth + gap) + barWidth / 2;
        const normalized = d.value / maxVolume;
        const y = CHART_HEIGHT - (normalized * (CHART_HEIGHT - 40)) - 20;
        return { x, y };
      })
      .filter((p): p is { x: number; y: number } => p !== null);

    let linePath = "";
    if (activePoints.length >= 2) {
      linePath = `M ${activePoints[0].x} ${activePoints[0].y}`;
      for (let i = 0; i < activePoints.length - 1; i++) {
        const p0 = activePoints[i];
        const p1 = activePoints[i + 1];
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
        if (i === 0) linePath += ` L ${midX} ${midY}`;
        else linePath += ` Q ${p0.x} ${p0.y}, ${midX} ${midY}`;
      }
      linePath += ` L ${activePoints[activePoints.length - 1].x} ${activePoints[activePoints.length - 1].y}`;
    }

    return { buckets, unit, maxVolume, chartWidth, barWidth, gap, activePoints, linePath };
  }, [processedData]);

  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator color={COLORS.ACCENT_BLUE} />
      </View>
    );
  }

  if (localFullHistory.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No history found for this exercise</Text>
      </View>
    );
  }

  const { buckets, unit, maxVolume, chartWidth, barWidth, gap, linePath } = chartGeometry;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>VOLUME TREND ({unit.toUpperCase()})</Text>
        <Text style={styles.headerValue}>{Math.round(maxVolume)} MAX</Text>
      </View>
      <Svg width={chartWidth} height={CHART_HEIGHT}>
        {buckets.map((d, i) => {
          const barHeight = (d.value / maxVolume) * (CHART_HEIGHT - 40);
          const x = i * (barWidth + gap);
          const y = CHART_HEIGHT - barHeight - 20;
          return (
            <G key={i}>
              <Rect 
                x={x} 
                y={y} 
                width={barWidth} 
                height={Math.max(2, barHeight)} 
                fill={d.value === 0 ? "rgba(255,255,255,0.03)" : "rgba(11, 130, 255, 0.4)"} 
                rx={barWidth / 2} 
              />
              {d.label ? (
                <SvgText x={x + barWidth / 2} y={CHART_HEIGHT - 5} fill={COLORS.TEXT_TERTIARY} fontSize="8" fontWeight="800" textAnchor="middle" fontFamily={FONT_FAMILIES.MONO}>{d.label.toUpperCase()}</SvgText>
              ) : null}
            </G>
          );
        })}
        {linePath ? (
          <Path d={linePath} fill="none" stroke={COLORS.ACCENT_GREEN} strokeWidth={2} opacity={0.8} strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
      </Svg>
    </View>
  );
}

// Mounted permanently as a pager page inside ExerciseCard, so without memo it
// re-renders on every ExerciseCard render (e.g. every keystroke) even while hidden.
export default React.memo(ExerciseHistoryGraph);

const styles = StyleSheet.create({
  container: {
    paddingTop: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerText: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 10,
    fontWeight: "900",
    fontFamily: FONT_FAMILIES.MONO,
    letterSpacing: 1,
  },
  headerValue: {
    color: COLORS.ACCENT_BLUE,
    fontSize: 10,
    fontWeight: "900",
    fontFamily: FONT_FAMILIES.MONO,
  },
  emptyContainer: {
    height: CHART_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 12,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
});
