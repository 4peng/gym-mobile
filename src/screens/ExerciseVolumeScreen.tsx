'use client';

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ScrollView,
} from "react-native";
import { ChevronLeft } from "lucide-react-native";
import Svg, { Rect, Line, Path, Text as SvgText } from "react-native-svg";
import { useAppRouter } from "@/utils/navigation";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
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
  const history = useWorkoutSessionStore((s) => s.history);
  const [range, setRange] = useState<TimeRange>("30D");

  // ── Data Processing ────────────────────────
  
  const processedData = useMemo(() => {
    const now = new Date();
    const data: { label: string; value: number; timestamp: number }[] = [];
    
    let bucketCount = 0;
    let bucketType: 'day' | 'week' | 'month' = 'day';

    if (range === "30D") {
      bucketCount = 30;
      bucketType = 'day';
    } else if (range === "6M") {
      bucketCount = 24; // 24 weeks
      bucketType = 'week';
    } else {
      bucketCount = 12; // 12 months
      bucketType = 'month';
    }

    // Initialize buckets
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

    // Determine target unit for normalization
    const lastSessionWithEx = [...history].reverse().find(s => 
      s.exercises.find(e => e.name.toLowerCase() === exerciseName.toLowerCase())
    );
    const targetUnit = lastSessionWithEx?.exercises.find(e => e.name.toLowerCase() === exerciseName.toLowerCase())?.weightUnit || "kg";

    history.forEach((session) => {
      const sessionDate = new Date(session.completedAt || session.startedAt);
      const exercise = session.exercises.find(
        (e) => e.name.toLowerCase() === exerciseName.toLowerCase()
      );

      if (exercise) {
        let sessionVolume = 0;
        exercise.sets.forEach(s => {
          if (s.completedAt && s.weight !== null && s.reps !== null) {
            const normalizedWeight = convertWeight(s.weight, exercise.weightUnit || "kg", targetUnit) || 0;
            sessionVolume += normalizedWeight * s.reps;
          }
        });
        
        const bucketIdx = data.findIndex((b, idx) => {
          const nextBucketTs = data[idx + 1]?.timestamp || Infinity;
          return sessionDate.getTime() >= b.timestamp && sessionDate.getTime() < nextBucketTs;
        });

        if (bucketIdx !== -1) {
          data[bucketIdx].value += sessionVolume;
        }
      }
    });

    return { buckets: data, unit: targetUnit };
  }, [history, exerciseName, range]);

  const { buckets, unit } = processedData;
  const maxVolume = Math.max(100, ...buckets.map(d => d.value));
  const chartWidth = SCREEN_WIDTH - (CHART_PADDING_HORIZONTAL * 2);
  const barWidth = Math.max(4, (chartWidth / buckets.length) * 0.6);
  const gap = (chartWidth - (buckets.length * barWidth)) / (buckets.length - 1);

  const growthPoints = buckets.map((d, i) => {
    const x = i * (barWidth + gap) + barWidth / 2;
    const normalized = Math.min(d.value / maxVolume, 1);
    const y = CHART_HEIGHT - (normalized * 120 + 40); 
    return { x, y };
  });

  const linePath = growthPoints.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = growthPoints[i - 1];
    const cpX = (prev.x + p.x) / 2;
    return `${acc} Q ${cpX} ${prev.y}, ${p.x} ${p.y}`;
  }, "");

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
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

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>
          Volume Trends:{"\n"}
          <Text style={{ color: COLORS.ACCENT_GREEN }}>{exerciseName}</Text>
        </Text>

        <Text style={styles.subtitle}>
          Tracking your total weight moved ({unit}) per period. Consistent volume increases are a key indicator of progress.
        </Text>

        <View style={styles.chartContainer}>
          <Svg width={chartWidth} height={CHART_HEIGHT}>
            {[0, 0.5, 1].map((v) => (
              <Line
                key={v}
                x1="0"
                y1={CHART_HEIGHT - (v * 150 + 20)}
                x2={chartWidth}
                y2={CHART_HEIGHT - (v * 150 + 20)}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
            ))}

            <SvgText
              x="0"
              y={CHART_HEIGHT - 130}
              fill={COLORS.TEXT_TERTIARY}
              fontSize="10"
              fontWeight="bold"
              fontFamily={FONT_FAMILIES.MEDIUM}
            >
              Progress Curve
            </SvgText>

            {buckets.map((d, i) => {
              const barHeight = (d.value / maxVolume) * (CHART_HEIGHT - 60);
              const x = i * (barWidth + gap);
              return (
                <Rect
                  key={i}
                  x={x}
                  y={CHART_HEIGHT - barHeight - 20}
                  width={barWidth}
                  height={Math.max(2, barHeight)}
                  fill={d.value === 0 ? "rgba(255,255,255,0.05)" : COLORS.ACCENT_BLUE}
                  rx={barWidth / 2}
                />
              );
            })}

            <Path d={linePath} fill="none" stroke={COLORS.ACCENT_GREEN} strokeWidth={2} opacity={0.6} />
          </Svg>

          <Text style={styles.xAxisLabel}>
            Total volume ({unit}) over the last {range === "30D" ? "30 days" : range === "6M" ? "6 months" : "year"}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1D1D21",
    justifyContent: "center",
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
  content: { paddingHorizontal: 24, paddingBottom: 120 },
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
  chartContainer: { alignItems: "center", marginTop: 20 },
  xAxisLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 20,
    fontFamily: FONT_FAMILIES.MEDIUM,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 50,
    paddingTop: 20,
    backgroundColor: COLORS.BG,
  },
  ctaButton: {
    backgroundColor: COLORS.TEXT_PRIMARY,
    paddingVertical: 18,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaButtonText: {
    color: COLORS.BG,
    fontSize: 16,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
});
