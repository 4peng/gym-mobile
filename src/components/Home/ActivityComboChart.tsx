import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Line, Polyline } from "react-native-svg";
import { COLORS, withAlpha } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import type { ActivityChartPoint } from "@/utils/activitySummary";

interface ActivityComboChartProps {
  points: ActivityChartPoint[];
  width: number;
  height?: number;
}

export default function ActivityComboChart({
  points,
  width,
  height = 132,
}: ActivityComboChartProps) {
  const barWidth = 18;
  const padding = 12;
  const horizontalInset = barWidth / 2 + 4;
  const labelWidth = 44;

  const chartMax = useMemo(
    () => Math.max(points.reduce((best, point) => Math.max(best, point.minutes), 0), 1),
    [points]
  );
  const chartCeil = Math.ceil(chartMax * 1.15); // Add 15% headroom

  const drawWidth = Math.max(width - padding * 2, 0);
  const plotWidth = Math.max(drawWidth - horizontalInset * 2, 0);
  const chartStep = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  const linePoints = points.map((point, index) => {
    const x = horizontalInset + index * chartStep;
    const normalized = point.minutes / chartCeil;
    const y = height - Math.max(8, normalized * (height - 8));
    return { x, y };
  });

  const linePath = linePoints.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = [
    `${linePoints[0].x},${height}`,
    ...linePoints.map((p) => `${p.x},${p.y}`),
    `${linePoints[linePoints.length - 1].x},${height}`,
  ].join(" ");

  return (
    <View style={[styles.shell, { width }]}>
      <View style={styles.guide} />
      <View style={[styles.guide, { top: 62 }]} />
      <View style={[styles.guide, { top: 112 }]} />

      <View style={styles.yAxisLabels} pointerEvents="none">
        <Text style={styles.yAxisText}>{chartCeil}m</Text>
        <Text style={styles.yAxisText}>{Math.round(chartCeil / 2)}</Text>
        <Text style={styles.yAxisText}>0</Text>
      </View>

      <Svg width={drawWidth} height={height} style={styles.svg}>
        {/* Bars */}
        {points.map((point, index) => {
          const x = horizontalInset + index * chartStep;
          const barHeight = Math.max(8, (point.minutes / chartCeil) * (height - 8));

          return (
            <Line
              key={point.key}
              x1={x}
              y1={height}
              x2={x}
              y2={height - barHeight}
              stroke={withAlpha(COLORS.ACCENT_BLUE, 0.2)}
              strokeWidth={barWidth}
              strokeLinecap="butt"
            />
          );
        })}

        {/* Area under line */}
        <Polyline
          points={areaPath}
          fill={withAlpha(COLORS.ACCENT_GREEN, 0.05)}
          stroke="transparent"
        />

        {/* The primary line */}
        <Polyline
          points={linePath}
          fill="none"
          stroke={COLORS.ACCENT_GREEN}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data point dots */}
        {linePoints.map((point, i) => (
          <Line
            key={`dot-${i}`}
            x1={point.x}
            y1={point.y}
            x2={point.x}
            y2={point.y - 0.5}
            stroke={COLORS.ACCENT_GREEN}
            strokeWidth={4}
            strokeLinecap="round"
          />
        ))}
      </Svg>

      <View style={styles.labelLayer} pointerEvents="none">
        {points.map((point, index) => (
          <View
            key={point.key}
            style={[
              styles.labelItem,
              {
                width: labelWidth,
                left: padding + linePoints[index].x - labelWidth / 2,
              },
            ]}
          >
            <Text style={styles.labelText}>{point.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    height: 190,
    borderRadius: UI.RADIUS_ITEM,
    backgroundColor: COLORS.BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    paddingTop: 12,
    paddingBottom: 10,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  guide: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 12,
    borderTopWidth: 1,
    borderColor: withAlpha(COLORS.TEXT_PRIMARY, 0.05),
  },
  svg: {
    position: "absolute",
    left: 12,
    bottom: 30,
  },
  yAxisLabels: {
    position: "absolute",
    left: 12,
    top: 12,
    bottom: 30,
    justifyContent: "space-between",
  },
  yAxisText: {
    color: withAlpha(COLORS.TEXT_TERTIARY, 0.5),
    fontSize: 9,
    fontFamily: FONT_FAMILIES.MONO,
    paddingLeft: 4,
    zIndex: 10,
  },
  labelLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 10,
    height: 16,
  },
  labelItem: {
    position: "absolute",
    alignItems: "center",
  },
  labelText: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 11,
    fontFamily: FONT_FAMILIES.MONO,
    textAlign: "center",
  },
});
