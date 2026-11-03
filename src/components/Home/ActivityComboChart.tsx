import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Line, Polyline } from "react-native-svg";
import { COLORS, SPACE, SURFACE, TYPE } from "@/constants/theme";
import type { ActivityChartPoint } from "@/utils/activitySummary";

interface ActivityComboChartProps {
  points: ActivityChartPoint[];
  width: number;
  height?: number;
}

const BAR_WIDTH = 18;
const PADDING = SPACE.md;
const LABEL_WIDTH = 44;
const LABEL_BAND = 30;

/** Minutes-per-bucket bars with a trend line, for the dashboard. */
export default function ActivityComboChart({
  points,
  width,
  height = 132,
}: ActivityComboChartProps) {
  const inset = BAR_WIDTH / 2 + SPACE.xs;
  const chartCeil = useMemo(
    () =>
      Math.ceil(
        Math.max(
          points.reduce((best, p) => Math.max(best, p.minutes), 0),
          1,
        ) * 1.15,
      ),
    [points],
  );

  if (points.length === 0) return <View style={[styles.shell, { width }]} />;

  const drawWidth = Math.max(width - PADDING * 2, 0);
  const step = points.length > 1 ? Math.max(drawWidth - inset * 2, 0) / (points.length - 1) : 0;
  const linePoints = points.map((p, i) => ({
    x: inset + i * step,
    y: height - Math.max(8, (p.minutes / chartCeil) * (height - 8)),
  }));
  const line = linePoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <View style={[styles.shell, { width }]}>
      {[0, 50, 100].map((top) => (
        <View key={top} style={[styles.guide, { top: PADDING + top }]} />
      ))}

      <View style={styles.yAxis} pointerEvents="none">
        <Text style={[TYPE.caption, styles.axisText]}>{chartCeil}m</Text>
        <Text style={[TYPE.caption, styles.axisText]}>{Math.round(chartCeil / 2)}</Text>
        <Text style={[TYPE.caption, styles.axisText]}>0</Text>
      </View>

      <Svg width={drawWidth} height={height} style={styles.svg}>
        {points.map((p, i) => (
          <Line
            key={p.key}
            x1={linePoints[i].x}
            y1={height}
            x2={linePoints[i].x}
            y2={linePoints[i].y}
            stroke={SURFACE.raisedStrong}
            strokeWidth={BAR_WIDTH}
          />
        ))}
        <Polyline
          points={line}
          fill="none"
          stroke={COLORS.ACCENT_BLUE}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {linePoints.map((p, i) => (
          <Line
            key={`dot-${i}`}
            x1={p.x}
            y1={p.y}
            x2={p.x}
            y2={p.y - 0.5}
            stroke={COLORS.ACCENT_BLUE}
            strokeWidth={4}
            strokeLinecap="round"
          />
        ))}
      </Svg>

      <View style={styles.labels} pointerEvents="none">
        {points.map((p, i) => (
          <View
            key={p.key}
            style={[
              styles.label,
              { width: LABEL_WIDTH, left: PADDING + linePoints[i].x - LABEL_WIDTH / 2 },
            ]}
          >
            <Text style={[TYPE.monoSmall, styles.labelText]}>{p.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    height: 190,
    paddingTop: PADDING,
    paddingBottom: SPACE.sm,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  guide: {
    position: "absolute",
    left: PADDING,
    right: PADDING,
    borderTopWidth: 1,
    borderColor: SURFACE.raisedStrong,
  },
  svg: { position: "absolute", left: PADDING, bottom: LABEL_BAND },
  yAxis: {
    position: "absolute",
    left: PADDING,
    top: PADDING,
    bottom: LABEL_BAND,
    justifyContent: "space-between",
  },
  axisText: { paddingLeft: SPACE.xs, zIndex: 10 },
  labels: { position: "absolute", left: 0, right: 0, bottom: SPACE.sm, height: SPACE.lg },
  label: { position: "absolute", alignItems: "center" },
  labelText: { color: COLORS.TEXT_TERTIARY, textAlign: "center" },
});
