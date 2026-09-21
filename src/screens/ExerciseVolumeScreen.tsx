import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Calendar, ChevronDown, TrendingUp } from "lucide-react-native";
import Svg, { G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { useRouter } from "expo-router";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { useUiPreferencesStore } from "@/stores/uiPreferencesStore";
import { workoutRepo, type ExerciseRow } from "@/db";
import { useDbQuery } from "@/db/dbVersion";
import {
  COLORS,
  FONT_FAMILIES,
  LAYOUT,
  RADIUS,
  SPACE,
  SURFACE,
  TYPE,
  UI,
  withAlpha,
} from "@/constants/theme";
import MuscleSelector from "@/components/MuscleSelector";
import { formatMuscleLabels, type MuscleGroup } from "@/constants/muscles";
import { toTitleCase } from "@/utils/string";
import { Swipeable } from "@/components/Swipeable";
import { HapticFeedback } from "@/utils/haptics";
import { normalizeExerciseIdentityKey } from "@/utils/exerciseIdentity";
import { makeLoadResolver, type WeightUnit } from "@/utils/bodyweightAnalytics";
import { buildSmoothPath, calendarDayIndex } from "@/utils/chart";
import { withDatePart } from "@/utils/timestamps";
import { promptForDate, showConfirm } from "@/utils/alerts";
import { EditableSetTag } from "@/components/Workout/EditableSetTag";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { EmptyState } from "@/components/ui/EmptyState";
import type { WorkoutSet } from "@/types";

const CHART_HEIGHT = 220;
const CHART_LEFT = 40;
const CHART_WIDTH = LAYOUT.screenWidth - CHART_LEFT * 2;
const RANGES = [
  { value: "30D", label: "30D", buckets: 30, days: 1 },
  { value: "6M", label: "6M", buckets: 24, days: 7 },
  { value: "1Y", label: "1Y", buckets: 12, days: 30 },
] as const;
type TimeRange = (typeof RANGES)[number]["value"];
const PAGE = 10;

interface VolumeBucket {
  label: string;
  value: number;
  start: number;
  end: number;
  isPeak: boolean;
}

interface LoggedSet extends WorkoutSet {
  sessionId: string;
  exerciseId: string;
}

interface DayLog {
  id: string;
  sessionIds: string[];
  date: Date;
  volume: number;
  sets: LoggedSet[];
  isPR: boolean;
}

// ── Chart (memoised so scrubbing doesn't re-render the list) ──

const VolumeChart = React.memo(function VolumeChart({
  buckets,
  unit,
  range,
}: {
  buckets: VolumeBucket[];
  unit: string;
  range: TimeRange;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const maxVolume = Math.max(100, ...buckets.map((b) => b.value));
  const barWidth = Math.max(4, (CHART_WIDTH / buckets.length) * 0.6);
  const gap = (CHART_WIDTH - buckets.length * barWidth) / (buckets.length - 1);
  const xAt = (i: number) => CHART_LEFT + i * (barWidth + gap);

  const linePath = useMemo(
    () =>
      buildSmoothPath(
        buckets.flatMap((b, i) =>
          b.value === 0
            ? []
            : [
                {
                  x: CHART_LEFT + i * (barWidth + gap) + barWidth / 2,
                  y: CHART_HEIGHT - (b.value / maxVolume) * (CHART_HEIGHT - 60) - 20,
                },
              ],
        ),
      ),
    [buckets, barWidth, gap, maxVolume],
  );

  /** Nearest bucket with data to a touch x (overlay sits 60px left of the svg origin). */
  const bucketAt = useCallback(
    (locationX: number) => {
      const raw = Math.max(
        0,
        Math.min(buckets.length - 1, Math.round((locationX - 60) / (barWidth + gap))),
      );
      let best = -1;
      let dist = Infinity;
      buckets.forEach((b, i) => {
        if (b.value > 0 && Math.abs(i - raw) < dist) {
          dist = Math.abs(i - raw);
          best = i;
        }
      });
      return best;
    },
    [buckets, barWidth, gap],
  );

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const idx = bucketAt(e.nativeEvent.locationX);
          if (idx === -1) return;
          setActiveIdx((prev) => {
            HapticFeedback.selection();
            return prev === idx ? null : idx;
          });
        },
        onPanResponderMove: (e) => {
          const idx = bucketAt(e.nativeEvent.locationX);
          if (idx === -1) return;
          setActiveIdx((prev) => {
            if (prev !== idx) HapticFeedback.selection();
            return idx;
          });
        },
      }),
    [bucketAt],
  );

  const selected = activeIdx !== null ? buckets[activeIdx] : null;
  const fmt = (ts: number, withYear: boolean) =>
    new Date(ts).toLocaleDateString("default", {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
    });

  return (
    <View style={styles.chart}>
      <View style={styles.tooltip}>
        {selected && (
          <>
            <Text style={TYPE.label}>
              {range === "30D"
                ? fmt(selected.start, true)
                : `${fmt(selected.start, false)} - ${fmt(selected.end, true)}`}
            </Text>
            <Text style={TYPE.monoLarge}>
              {Math.round(selected.value)} {unit.toUpperCase()}
            </Text>
          </>
        )}
      </View>

      <View style={{ alignItems: "center" }}>
        <Svg width={CHART_WIDTH + 60} height={CHART_HEIGHT + 40}>
          <SvgText
            x={CHART_LEFT - 5}
            y="10"
            fill={COLORS.TEXT_TERTIARY}
            fontSize="9"
            fontWeight="900"
            fontFamily={FONT_FAMILIES.MONO}
            letterSpacing="0.5"
          >
            VOLUME ({unit.toUpperCase()})
          </SvgText>
          {[0, 0.5, 1].map((v) => {
            const y = CHART_HEIGHT - (v * 150 + 20);
            const label = Math.round(v * maxVolume);
            return (
              <G key={v}>
                <Line
                  x1={CHART_LEFT}
                  y1={y}
                  x2={CHART_WIDTH + CHART_LEFT}
                  y2={y}
                  stroke={SURFACE.raisedStrong}
                  strokeWidth="1"
                />
                <SvgText
                  x={CHART_LEFT - 8}
                  y={y + 4}
                  fill={COLORS.TEXT_TERTIARY}
                  fontSize="10"
                  fontWeight="800"
                  textAnchor="end"
                  fontFamily={FONT_FAMILIES.MONO}
                >
                  {label >= 1000 ? `${(label / 1000).toFixed(1)}k` : label}
                </SvgText>
              </G>
            );
          })}
          {buckets.map((b, i) => {
            const barHeight = (b.value / maxVolume) * (CHART_HEIGHT - 60);
            const active = activeIdx === i;
            return (
              <G key={i}>
                <Rect
                  x={xAt(i)}
                  y={CHART_HEIGHT - barHeight - 20}
                  width={barWidth}
                  height={Math.max(2, barHeight)}
                  fill={
                    b.value === 0
                      ? SURFACE.raisedStrong
                      : active
                        ? COLORS.ACCENT_BLUE
                        : withAlpha(COLORS.ACCENT_BLUE, 0.6)
                  }
                  rx={barWidth / 2}
                />
                {b.isPeak && (
                  <SvgText
                    x={xAt(i) + barWidth / 2}
                    y={CHART_HEIGHT - barHeight - 28}
                    fill={active ? COLORS.ACCENT_YELLOW : withAlpha(COLORS.ACCENT_YELLOW, 0.8)}
                    fontSize="10"
                    fontWeight="900"
                    textAnchor="middle"
                  >
                    ★
                  </SvgText>
                )}
                {b.label ? (
                  <SvgText
                    x={xAt(i) + barWidth / 2}
                    y={CHART_HEIGHT + 10}
                    fill={COLORS.TEXT_TERTIARY}
                    fontSize="9"
                    fontWeight="800"
                    textAnchor="middle"
                    fontFamily={FONT_FAMILIES.MONO}
                  >
                    {b.label}
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
              strokeWidth={2.5}
              opacity={0.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </Svg>
        <View {...pan.panHandlers} style={styles.touchOverlay} />
      </View>
    </View>
  );
});

// ── Log row ──

const LogRow = React.memo(function LogRow({
  log,
  unit,
  onDelete,
  onEditDate,
  onSaveSet,
  onToggleScroll,
}: {
  log: DayLog;
  unit: string;
  onDelete: (ids: string[]) => void;
  onEditDate: (ids: string[], iso: string) => void;
  onSaveSet: (set: LoggedSet, weight: number, reps: number) => void;
  onToggleScroll: (enabled: boolean) => void;
}) {
  return (
    <Swipeable
      onDelete={() => onDelete(log.sessionIds)}
      onToggleScroll={onToggleScroll}
      marginBottom={SPACE.md}
    >
      <View style={[UI.card, styles.logCard, log.isPR && { borderColor: COLORS.ACCENT_YELLOW }]}>
        <View style={UI.rowBetween}>
          <Pressable
            onPress={() => onEditDate(log.sessionIds, log.date.toISOString())}
            style={({ pressed }) => [UI.row, { gap: SPACE.sm - 2 }, pressed && UI.pressed]}
          >
            <Calendar size={14} color={COLORS.TEXT_TERTIARY} />
            <Text style={TYPE.bodyMuted}>
              {log.date.toLocaleDateString("default", { month: "short", day: "numeric" })}
            </Text>
          </Pressable>
          <View style={[UI.row, { gap: SPACE.md }]}>
            {log.isPR && (
              <View style={styles.prBadge}>
                <Text style={[TYPE.label, { color: COLORS.ACCENT_YELLOW }]}>PR</Text>
              </View>
            )}
            <Text
              style={[TYPE.mono, { color: log.isPR ? COLORS.ACCENT_YELLOW : COLORS.ACCENT_BLUE }]}
            >
              {Math.round(log.volume)} {unit}
            </Text>
          </View>
        </View>
        <View style={styles.sets}>
          {log.sets.map((s) => (
            <EditableSetTag
              key={s.id}
              weight={s.weight}
              reps={s.reps}
              onSave={(w, r) => onSaveSet(s, w, r)}
            />
          ))}
        </View>
      </View>
    </Swipeable>
  );
});

// ── Screen ──

export default function ExerciseVolumeScreen({ exerciseKey }: { exerciseKey: string }) {
  const router = useRouter();
  const deleteHistorySession = useWorkoutSessionStore((s) => s.deleteHistorySession);
  const updateHistorySet = useWorkoutSessionStore((s) => s.updateHistorySet);
  const updateSessionDate = useWorkoutSessionStore((s) => s.updateSessionDate);
  const updateMusclesInHistory = useWorkoutSessionStore((s) => s.updateMusclesInHistory);
  const analyticsBodyweight = useUiPreferencesStore((s) => s.analyticsBodyweight);
  const analyticsBodyweightUnit = useUiPreferencesStore((s) => s.analyticsBodyweightUnit);

  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [range, setRange] = useState<TimeRange>("30D");
  const [limit, setLimit] = useState(PAGE);
  const [muscleSelectorVisible, setMuscleSelectorVisible] = useState(false);

  const key = normalizeExerciseIdentityKey(exerciseKey);
  const rows = useDbQuery(() => workoutRepo.exerciseHistory(key), [key]);
  const latest = rows[0]?.exercise ?? null;
  const displayName = latest?.name || exerciseKey;
  const currentMuscles = (latest?.muscles ?? []) as MuscleGroup[];

  const data = useMemo(() => {
    const unit: WeightUnit = latest?.weightUnit || "kg";
    const spec = RANGES.find((r) => r.value === range)!;
    const now = new Date();
    const todayIndex = calendarDayIndex(now);

    const buckets: VolumeBucket[] = Array.from({ length: spec.buckets }, (_, i) => {
      const offset = spec.buckets - 1 - i;
      const end = new Date(now);
      end.setDate(end.getDate() - offset * spec.days);
      end.setHours(23, 59, 59, 999);
      const start = new Date(end);
      start.setDate(start.getDate() - spec.days + 1);
      start.setHours(0, 0, 0, 0);
      const showLabel = range === "1Y" || (range === "30D" ? offset % 7 === 0 : offset % 4 === 0);
      const label = showLabel
        ? end.toLocaleDateString(
            "default",
            range === "1Y" ? { month: "short" } : { month: "short", day: "numeric" },
          )
        : "";
      return { label, value: 0, start: start.getTime(), end: end.getTime(), isPeak: false };
    });

    let max1RM = 0;
    const logsByDay = new Map<string, DayLog>();

    for (const row of rows as ExerciseRow[]) {
      const date = new Date(row.completedAt);
      const dayKey = date.toISOString().slice(0, 10);
      const resolveLoad = makeLoadResolver(
        row.exercise,
        unit,
        analyticsBodyweight,
        analyticsBodyweightUnit,
      );
      let volume = 0;
      const sets: LoggedSet[] = [];
      for (const s of row.exercise.sets) {
        if (s.reps === null) continue;
        const load = resolveLoad(s.weight);
        if (load === null) continue;
        max1RM = Math.max(max1RM, load * (1 + s.reps / 30)); // Epley, over every set with reps
        if (s.completedAt) {
          volume += load * s.reps;
          sets.push({ ...s, sessionId: row.workoutId, exerciseId: row.exercise.id });
        }
      }
      if (sets.length === 0) continue;

      const log = logsByDay.get(dayKey) ?? {
        id: dayKey,
        sessionIds: [],
        date,
        volume: 0,
        sets: [],
        isPR: false,
      };
      log.volume += volume;
      log.sets.push(...sets);
      if (!log.sessionIds.includes(row.workoutId)) log.sessionIds.push(row.workoutId);
      logsByDay.set(dayKey, log);

      const dayDiff = todayIndex - calendarDayIndex(date);
      const bucketOffset = Math.floor(dayDiff / spec.days);
      if (dayDiff >= 0 && bucketOffset < spec.buckets)
        buckets[spec.buckets - 1 - bucketOffset].value += volume;
    }

    const logs = Array.from(logsByDay.values());
    const maxDaily = logs.reduce((m, l) => Math.max(m, l.volume), 0);
    logs.forEach((l) => (l.isPR = maxDaily > 0 && l.volume === maxDaily));
    logs.sort((a, b) =>
      a.isPR !== b.isPR ? (a.isPR ? -1 : 1) : b.date.getTime() - a.date.getTime(),
    );
    const peak = Math.max(...buckets.map((b) => b.value));
    if (peak > 0) buckets.forEach((b) => (b.isPeak = b.value === peak));
    const lastVolume = logs.length
      ? logs.reduce((latestLog, l) => (l.date > latestLog.date ? l : latestLog)).volume
      : 0;

    return { unit, buckets, logs, stats: { max1RM, maxDaily, lastVolume } };
  }, [rows, latest, range, analyticsBodyweight, analyticsBodyweightUnit]);

  const handleDelete = useCallback(
    (ids: string[]) =>
      showConfirm("Delete daily log", "Remove every session logged on this date?", () =>
        ids.forEach(deleteHistorySession),
      ),
    [deleteHistorySession],
  );
  const handleEditDate = useCallback(
    (ids: string[], iso: string) =>
      promptForDate(iso, (day) => {
        const sessions = workoutRepo.getMany(ids);
        sessions.forEach((s) =>
          updateSessionDate(s._id, withDatePart(s.completedAt || s.startedAt, day)),
        );
      }),
    [updateSessionDate],
  );
  const handleSaveSet = useCallback(
    (set: LoggedSet, weight: number, reps: number) => {
      updateHistorySet(set.sessionId, set.exerciseId, set.id, "weight", weight);
      updateHistorySet(set.sessionId, set.exerciseId, set.id, "reps", reps);
    },
    [updateHistorySet],
  );

  const { unit, buckets, logs, stats } = data;
  const StatTile = ({ label, value }: { label: string; value: number }) => (
    <View style={{ flex: 1 }}>
      <Text style={TYPE.label}>{label}</Text>
      <Text style={[TYPE.monoLarge, { fontSize: 24 }]}>
        {Math.round(value)}
        <Text style={[TYPE.monoSmall, { color: COLORS.TEXT_TERTIARY }]}> {unit}</Text>
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView style={UI.screen} behavior="padding">
      <View style={styles.header}>
        <IconButton onPress={() => router.back()}>
          <ChevronDown size={26} color={COLORS.TEXT_PRIMARY} />
        </IconButton>
        <View style={{ width: 200 }}>
          <SegmentedControl compact options={RANGES} value={range} onChange={setRange} />
        </View>
      </View>

      <FlatList
        data={logs.slice(0, limit)}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <LogRow
            log={item}
            unit={unit}
            onDelete={handleDelete}
            onEditDate={handleEditDate}
            onSaveSet={handleSaveSet}
            onToggleScroll={setScrollEnabled}
          />
        )}
        ListHeaderComponent={
          <>
            <Text style={[TYPE.title, styles.title]}>
              Volume trends{"\n"}
              <Text style={{ color: COLORS.ACCENT_GREEN }}>{toTitleCase(displayName)}</Text>
            </Text>

            <Pressable
              onPress={() => setMuscleSelectorVisible(true)}
              style={({ pressed }) => [UI.inset, styles.muscleTrigger, pressed && UI.pressed]}
            >
              <Text style={TYPE.label}>Categories</Text>
              <Text style={[TYPE.body, { flex: 1, textAlign: "right" }]} numberOfLines={1}>
                {currentMuscles.length ? formatMuscleLabels(currentMuscles, ", ") : "None selected"}
              </Text>
            </Pressable>

            <View style={styles.statsRow}>
              <StatTile label="Est. 1RM" value={stats.max1RM} />
              <StatTile label="Max daily" value={stats.maxDaily} />
              <StatTile label="Last log" value={stats.lastVolume} />
            </View>

            <VolumeChart key={range} buckets={buckets} unit={unit} range={range} />

            <View style={[UI.inset, styles.disclosure]}>
              <TrendingUp size={14} color={COLORS.TEXT_TERTIARY} />
              <Text style={[TYPE.caption, { flex: 1, lineHeight: 16 }]}>
                Est. 1RM uses the Epley formula, weight × (1 + reps / 30), and is most accurate
                under 10 reps.
              </Text>
            </View>
            <SectionLabel style={{ marginBottom: SPACE.lg }}>Daily history</SectionLabel>
          </>
        }
        ListEmptyComponent={<EmptyState title="No recorded sessions" />}
        onEndReached={() => logs.length > limit && setLimit((l) => l + PAGE)}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        scrollEnabled={scrollEnabled}
      />

      <MuscleSelector
        visible={muscleSelectorVisible}
        onClose={() => setMuscleSelectorVisible(false)}
        selectedMuscles={currentMuscles}
        onSelect={(muscles) => updateMusclesInHistory(key, muscles)}
        label="Exercise categories"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: LAYOUT.headerTop,
    paddingHorizontal: LAYOUT.gutter,
    paddingBottom: SPACE.sm + 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  content: { paddingHorizontal: LAYOUT.gutter, paddingBottom: 120 },
  title: { fontSize: 32, lineHeight: 38, marginTop: SPACE.xl, marginBottom: SPACE.xxl },
  muscleTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.container,
    marginBottom: SPACE.xxxl,
  },
  statsRow: { flexDirection: "row", gap: SPACE.sm, marginBottom: SPACE.xxxl + SPACE.sm },
  chart: { alignItems: "center", marginBottom: SPACE.xxxl + SPACE.sm },
  tooltip: {
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACE.sm + 2,
    gap: SPACE.xs,
  },
  touchOverlay: {
    position: "absolute",
    left: -20,
    top: 0,
    width: CHART_WIDTH + 100,
    height: CHART_HEIGHT + 40,
  },
  disclosure: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm + 2,
    padding: SPACE.md,
    marginTop: SPACE.xl,
    marginBottom: SPACE.xxl,
  },
  logCard: { padding: SPACE.lg, gap: SPACE.md },
  prBadge: {
    backgroundColor: SURFACE.yellowTint,
    paddingHorizontal: SPACE.sm - 2,
    paddingVertical: 2,
    borderRadius: RADIUS.sm - 2,
    borderWidth: 1,
    borderColor: SURFACE.yellowBorder,
  },
  sets: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
});
