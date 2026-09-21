import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect, G, Text as SvgText } from "react-native-svg";
import { workoutRepo } from "@/db";
import { useDbQuery } from "@/db/dbVersion";
import { COLORS, FONT_FAMILIES, LAYOUT, SPACE, SURFACE, TYPE } from "@/constants/theme";
import { normalizeExerciseIdentityKey } from "@/utils/exerciseIdentity";
import { useUiPreferencesStore } from "@/stores/uiPreferencesStore";
import { makeLoadResolver } from "@/utils/bodyweightAnalytics";
import { buildSmoothPath, calendarDayIndex } from "@/utils/chart";

const CHART_HEIGHT = 160;
const DAYS = 20;

/** Volume per day for the last 20 days of one exercise. Lives inside ExerciseCard's HISTORY tab. */
function ExerciseHistoryGraph({ exerciseKey }: { exerciseKey: string }) {
  const key = normalizeExerciseIdentityKey(exerciseKey);
  const analyticsBodyweight = useUiPreferencesStore((s) => s.analyticsBodyweight);
  const analyticsBodyweightUnit = useUiPreferencesStore((s) => s.analyticsBodyweightUnit);

  const sinceIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - (DAYS - 1));
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);
  const rows = useDbQuery(() => workoutRepo.exerciseHistory(key, sinceIso), [key, sinceIso]);
  const latest = useDbQuery(() => workoutRepo.latestExercise(key), [key]);

  const chart = useMemo(() => {
    const unit = latest?.weightUnit || "kg";
    const now = new Date();
    const todayIndex = calendarDayIndex(now);
    const buckets = Array.from({ length: DAYS }, (_, i) => {
      const day = new Date(now);
      day.setDate(day.getDate() - (DAYS - 1 - i));
      return {
        label:
          i % 5 === 0 ? day.toLocaleDateString("default", { month: "short", day: "numeric" }) : "",
        value: 0,
      };
    });

    for (const row of rows) {
      const resolveLoad = makeLoadResolver(
        row.exercise,
        unit,
        analyticsBodyweight,
        analyticsBodyweightUnit,
      );
      let volume = 0;
      for (const s of row.exercise.sets) {
        if (!s.completedAt || s.reps === null) continue;
        const load = resolveLoad(s.weight);
        if (load !== null) volume += load * s.reps;
      }
      const index = DAYS - 1 - (todayIndex - calendarDayIndex(new Date(row.completedAt)));
      if (index >= 0 && index < DAYS) buckets[index].value += volume;
    }

    const maxVolume = Math.max(100, ...buckets.map((b) => b.value));
    const chartWidth = LAYOUT.screenWidth - 64;
    const barWidth = (chartWidth / DAYS) * 0.7;
    const gap = (chartWidth - DAYS * barWidth) / (DAYS - 1);
    const points = buckets.flatMap((b, i) =>
      b.value === 0
        ? []
        : [
            {
              x: i * (barWidth + gap) + barWidth / 2,
              y: CHART_HEIGHT - (b.value / maxVolume) * (CHART_HEIGHT - 40) - 20,
            },
          ],
    );
    return {
      unit,
      buckets,
      maxVolume,
      chartWidth,
      barWidth,
      gap,
      linePath: buildSmoothPath(points),
    };
  }, [rows, latest, analyticsBodyweight, analyticsBodyweightUnit]);

  if (!latest) {
    return (
      <View style={styles.empty}>
        <Text style={TYPE.caption}>No history for this exercise yet</Text>
      </View>
    );
  }

  const { unit, buckets, maxVolume, chartWidth, barWidth, gap, linePath } = chart;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={TYPE.label}>Volume trend ({unit})</Text>
        <Text style={[TYPE.label, { color: COLORS.ACCENT_BLUE }]}>{Math.round(maxVolume)} max</Text>
      </View>
      <Svg width={chartWidth} height={CHART_HEIGHT}>
        {buckets.map((b, i) => {
          const barHeight = (b.value / maxVolume) * (CHART_HEIGHT - 40);
          const x = i * (barWidth + gap);
          return (
            <G key={i}>
              <Rect
                x={x}
                y={CHART_HEIGHT - barHeight - 20}
                width={barWidth}
                height={Math.max(2, barHeight)}
                fill={b.value === 0 ? SURFACE.raised : SURFACE.blueBorder}
                rx={barWidth / 2}
              />
              {b.label ? (
                <SvgText
                  x={x + barWidth / 2}
                  y={CHART_HEIGHT - 5}
                  fill={COLORS.TEXT_TERTIARY}
                  fontSize="8"
                  fontWeight="800"
                  textAnchor="middle"
                  fontFamily={FONT_FAMILIES.MONO}
                >
                  {b.label.toUpperCase()}
                </SvgText>
              ) : null}
            </G>
          );
        })}
        {linePath ? (
          <Path
            d={linePath}
            fill="none"
            stroke={COLORS.ACCENT_GREEN}
            strokeWidth={2}
            opacity={0.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </Svg>
    </View>
  );
}

// Mounted permanently as a pager page inside ExerciseCard; memo keeps it from re-rendering per keystroke.
export default React.memo(ExerciseHistoryGraph);

const styles = StyleSheet.create({
  container: { paddingTop: SPACE.sm },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: SPACE.lg },
  empty: { height: CHART_HEIGHT, justifyContent: "center", alignItems: "center" },
});
