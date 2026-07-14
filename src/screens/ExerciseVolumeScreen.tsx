import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  FlatList,
  Alert,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  PanResponder,
} from "react-native";
import { Calendar, Check, X, ChevronDown, TrendingUp } from "lucide-react-native";
import Svg, { Path, Line, Text as SvgText, Rect, G } from "react-native-svg";
import { useAppRouter } from "@/utils/navigation";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { workoutStorage } from "@/storage/workoutStorage";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import MuscleSelector from "@/src/components/MuscleSelector";
import { MuscleGroup, MUSCLE_LABELS } from "@/constants/muscles";
import { toTitleCase } from "@/utils/string";
import { Swipeable } from "@/src/components/Swipeable";
import { HapticFeedback } from "@/src/utils/haptics";
import { WorkoutExercise, WorkoutSession } from "@/src/types";
import { getExerciseIdentityKey, normalizeExerciseIdentityKey } from "@/utils/exerciseIdentity";
import { useUiPreferencesStore } from "@/stores/uiPreferencesStore";
import { isBodyweightStrengthExercise, type WeightUnit } from "@/utils/bodyweightAnalytics";
import { convertWeight } from "@/utils/conversions";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_HEIGHT = 220;
const CHART_PADDING_HORIZONTAL = 40;
const MS_PER_DAY = 86400000;

type TimeRange = "30D" | "6M" | "1Y";

interface ExerciseVolumeScreenProps {
  exerciseKey: string;
}

interface VolumeBucket {
  label: string;
  value: number;
  timestamp: number;
  endTimestamp: number;
  hasPR: boolean;
}

/**
 * Calendar-day index (UTC-based so it's immune to local DST shifts) for a
 * given Date's Y/M/D components. Used to place a session into its trailing
 * chart bucket via direct index math instead of scanning every bucket.
 */
function calendarDayIndex(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS_PER_DAY);
}

function isFiniteWeight(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Builds a per-exercise weight resolver. This hoists the identity/bodyweight
 * checks (isBodyweightStrengthExercise + the bodyweight conversion) out of
 * the per-set loops — they only depend on the exercise itself, the target
 * unit, and the analytics bodyweight, never on the individual set — so they
 * should be computed once per exercise, not once per set. The returned
 * closure produces numerically identical results to calling
 * resolveEffectiveStrengthLoad(exercise, weight, ...) for every set.
 */
function makeLoadResolver(
  exercise: WorkoutExercise,
  targetUnit: WeightUnit,
  analyticsBodyweight: number | null,
  analyticsBodyweightUnit: WeightUnit
) {
  const loggedWeightUnit: WeightUnit = exercise.weightUnit || "kg";
  const isBW = isBodyweightStrengthExercise(exercise);
  const hasBodyweight = isFiniteWeight(analyticsBodyweight);
  const convertedBodyweight =
    isBW && hasBodyweight
      ? convertWeight(analyticsBodyweight, analyticsBodyweightUnit, targetUnit) ?? analyticsBodyweight
      : 0;

  return (loggedWeight: number | null): number | null => {
    if (!isBW) {
      return isFiniteWeight(loggedWeight)
        ? convertWeight(loggedWeight, loggedWeightUnit, targetUnit)
        : loggedWeight;
    }

    const extraLoad = isFiniteWeight(loggedWeight)
      ? convertWeight(loggedWeight, loggedWeightUnit, targetUnit) ?? loggedWeight
      : 0;

    if (!hasBodyweight) return extraLoad;
    return convertedBodyweight + extraLoad;
  };
}

// ── Chart (isolated so touch-scrubbing doesn't re-render the whole screen) ──

interface VolumeChartProps {
  buckets: VolumeBucket[];
  unit: string;
  range: TimeRange;
}

const VolumeChart = React.memo(function VolumeChart({ buckets, unit, range }: VolumeChartProps) {
  const [activeBucketIdx, setActiveBucketIdx] = useState<number | null>(null);

  const maxVolume = Math.max(100, ...buckets.map((d) => d.value));
  const chartWidth = SCREEN_WIDTH - CHART_PADDING_HORIZONTAL * 2;
  const barWidth = Math.max(4, (chartWidth / buckets.length) * 0.6);
  const gap = (chartWidth - buckets.length * barWidth) / (buckets.length - 1);
  const yLabel = `VOLUME (${unit.toUpperCase()})`;

  const activePoints = useMemo(() => {
    return buckets
      .map((d, i) => {
        if (d.value === 0) return null;
        const x = 40 + i * (barWidth + gap) + barWidth / 2;
        const normalized = d.value / maxVolume;
        const y = CHART_HEIGHT - normalized * (CHART_HEIGHT - 60) - 20;
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

  const selectedBucket = activeBucketIdx !== null ? buckets[activeBucketIdx] : null;

  const chartPanResponder = useMemo(
    () =>
      PanResponder.create({
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
            setActiveBucketIdx((prev) => {
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
            setActiveBucketIdx((prev) => {
              if (prev !== resolvedIndex) {
                HapticFeedback.selection();
                return resolvedIndex;
              }
              return prev;
            });
          }
        },
      }),
    [buckets, barWidth, gap]
  );

  return (
    <View style={styles.chartContainer}>
      <View style={styles.tooltipPlaceholder}>
        {selectedBucket && (
          <View style={styles.minimalTooltip}>
            <Text style={styles.minimalTooltipDate}>
              {range === "30D"
                ? new Date(selectedBucket.timestamp).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })
                : `${new Date(selectedBucket.timestamp).toLocaleDateString('default', { month: 'short', day: 'numeric' })} - ${new Date(selectedBucket.endTimestamp).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`}
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
  );
});

// ── Log row (memoized; owns its own edit state so editing/scrolling doesn't
// re-render the rest of the list) ──

interface SessionLogEntry {
  id: string;
  sessionIds: Set<string>;
  date: string;
  rawDate: Date;
  volume: number;
  sets: any[];
  isPR: boolean;
}

interface LogRowProps {
  log: SessionLogEntry;
  unit: string;
  onDeleteSession: (ids: Set<string>) => void;
  onEditDate: (ids: Set<string>, currentIso: string) => void;
  onSaveEdit: (sessionId: string, exerciseId: string, setId: string, weight: number, reps: number) => void;
  onToggleScroll: (enabled: boolean) => void;
}

const LogRow = React.memo(function LogRow({ log, unit, onDeleteSession, onEditDate, onSaveEdit, onToggleScroll }: LogRowProps) {
  const [editingSet, setEditingSet] = useState<{ setId: string; weight: string; reps: string } | null>(null);

  const handleStartEdit = (setId: string, weight: number | null, reps: number | null) => {
    setEditingSet({ setId, weight: (weight ?? 0).toString(), reps: (reps ?? 0).toString() });
  };

  const handleSave = () => {
    if (!editingSet) return;
    const target = log.sets.find((s: any) => s.id === editingSet.setId);
    if (target) {
      const w = Number(editingSet.weight.trim().replace(",", "."));
      const r = Number(editingSet.reps.trim());
      if (Number.isFinite(w) && Number.isFinite(r)) {
        onSaveEdit(target.sessionId, target.exerciseId, target.id, w, r);
      }
    }
    setEditingSet(null);
  };

  return (
    <Swipeable onDelete={() => onDeleteSession(log.sessionIds)} onToggleScroll={onToggleScroll}>
      <View style={[
        UI.SHARED.card,
        { marginBottom: 0, borderRadius: UI.RADIUS_CONTAINER },
        log.isPR && { borderColor: COLORS.ACCENT_YELLOW, borderWidth: 3 }
      ]}>
        <View style={styles.logCardHeader}>
          <Pressable onPress={() => onEditDate(log.sessionIds, log.rawDate.toISOString())} style={({ pressed }) => [styles.dateRow, pressed && { opacity: 0.6 }]}><Calendar size={14} color={COLORS.TEXT_TERTIARY} /><Text style={styles.logDate}>{log.date}</Text></Pressable>
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
                  <TextInput style={styles.editInput} value={editingSet?.weight ?? ""} onChangeText={(v) => setEditingSet((prev) => (prev ? { ...prev, weight: v } : prev))} keyboardType="decimal-pad" autoFocus />
                  <Text style={styles.setTagX}>×</Text>
                  <TextInput style={styles.editInput} value={editingSet?.reps ?? ""} onChangeText={(v) => setEditingSet((prev) => (prev ? { ...prev, reps: v } : prev))} keyboardType="numeric" />
                  <Pressable onPress={handleSave} style={styles.editIcon}><Check size={16} color={COLORS.ACCENT_GREEN} /></Pressable>
                  <Pressable onPress={() => setEditingSet(null)} style={styles.editIcon}><X size={16} color={COLORS.DANGER} /></Pressable>
                </View>
              );
            }
            return <Pressable key={s.id} style={({ pressed }) => [styles.setTag, pressed && { backgroundColor: COLORS.CARD_HOVER }]} onPress={() => handleStartEdit(s.id, s.weight, s.reps)}><Text style={styles.setTagText}>{s.weight} <Text style={styles.setTagX}>×</Text> {s.reps}</Text></Pressable>;
          })}
        </View>
      </View>
    </Swipeable>
  );
});

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

  const [localFullHistory, setLocalFullHistory] = useState<WorkoutSession[]>([]);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [range, setRange] = useState<TimeRange>("30D");
  const [displayLimit, setDisplayLimit] = useState(10);
  const [muscleSelectorVisible, setMuscleSelectorVisible] = useState(false);
  const normalizedExerciseKey = normalizeExerciseIdentityKey(exerciseKey);

  // Ids we've already merged into `localFullHistory` (either from the RAM
  // cache or a disk shard fetch), keyed to the exercise we hydrated them for.
  const hydratedIdsRef = useRef<Set<string>>(new Set());
  const hydratedExerciseKeyRef = useRef<string>(normalizedExerciseKey);

  /**
   * Shard Hydration Strategy:
   * Since the main store only keeps ~15 sessions in RAM, we manually
   * load ALL relevant shards from disk to ensure the chart is complete.
   *
   * This intentionally does NOT depend on `historyCache`/`history` (the
   * store's `history` array reference changes on every store write, e.g.
   * editing a single set), which used to force a full disk re-read of every
   * shard for this exercise on every keystroke. Instead we only re-hydrate
   * when the exercise changes or the number of known session ids changes
   * (a session was added or removed); in-place edits to already-hydrated
   * sessions (weight/reps, date, muscles) are applied optimistically to
   * `localFullHistory` by their respective handlers below.
   */
  useEffect(() => {
    let isMounted = true;

    const loadShards = async () => {
      try {
        if (hydratedExerciseKeyRef.current !== normalizedExerciseKey) {
          hydratedExerciseKeyRef.current = normalizedExerciseKey;
          hydratedIdsRef.current = new Set();
        }

        const validIds = new Set(historyIndex);
        const cachedById = new Map(historyCache.map((s) => [s._id, s] as const));

        // Ids present in the index that we haven't hydrated yet and aren't
        // already sitting in the RAM cache (which we can read directly).
        const missingIds = historyIndex.filter(
          (id) => !cachedById.has(id) && !hydratedIdsRef.current.has(id)
        );

        const shards = missingIds.length > 0 ? await workoutStorage.getBatch(missingIds) : [];

        if (!isMounted) return;

        const nextHydrated = new Set<string>();
        hydratedIdsRef.current.forEach((id) => {
          if (validIds.has(id)) nextHydrated.add(id);
        });
        missingIds.forEach((id) => nextHydrated.add(id));
        historyIndex.forEach((id) => {
          if (cachedById.has(id)) nextHydrated.add(id);
        });
        hydratedIdsRef.current = nextHydrated;

        setLocalFullHistory((prev) => {
          const byId = new Map(prev.map((s) => [s._id, s] as const));

          // Drop sessions no longer present in the index (deleted elsewhere).
          Array.from(byId.keys()).forEach((id) => {
            if (!validIds.has(id)) byId.delete(id);
          });

          // Refresh/insert sessions currently loaded in RAM.
          cachedById.forEach((session, id) => {
            byId.set(id, session);
          });

          // Insert newly fetched disk shards.
          shards.forEach((session) => {
            byId.set(session._id, session);
          });

          return Array.from(byId.values())
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
        });
      } catch (err) {
        console.error("Failed to hydrate shards for trends:", err);
      }
    };

    loadShards();
    return () => {
      isMounted = false;
    };
    // Depend on the historyIndex ARRAY, not just its length: its reference is
    // stable across per-keystroke store writes but changes on any add/remove,
    // so a same-length membership swap (sync dropping N + adding N) still prunes
    // deleted sessions from the trend. Stays perf-safe (no keystroke churn).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedExerciseKey, historyIndex]);

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
    // Optimistic patch: updateMusclesInHistory doesn't touch historyIndex,
    // so the hydration effect above won't refire for this change.
    setLocalFullHistory((prev) =>
      prev.map((session) => ({
        ...session,
        exercises: session.exercises.map((ex) =>
          getExerciseIdentityKey(ex) === normalizedExerciseKey ? { ...ex, muscles: [...muscles] } : ex
        ),
      }))
    );
  };

  const handleMusclesChangeAndClose = (muscles: MuscleGroup[]) => {
    handleMusclesChange(muscles);
    setMuscleSelectorVisible(false);
  };

  // ── Data Processing ────────────────────────

  const processedData = useMemo(() => {
    const now = new Date();
    const data: VolumeBucket[] = [];

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

    const lastSessionWithEx = [...history].reverse().find((s) =>
      s.exercises.find((e) => getExerciseIdentityKey(e) === normalizedExerciseKey)
    );
    const targetUnit: WeightUnit =
      lastSessionWithEx?.exercises.find(
        (e) => getExerciseIdentityKey(e) === normalizedExerciseKey
      )?.weightUnit || "kg";

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

    const todayDayIndex = calendarDayIndex(now);

    // Single pass over history: computes the all-time 1RM, groups completed
    // sets by date for the log list, and totals chart-bucket volume together
    // (previously two separate passes over the same sessions/sets, each
    // re-deriving the exercise's identity/bodyweight resolution per set).
    const logsByDate: { [key: string]: any } = {};

    history.forEach((session) => {
      const sessionDate = new Date(session.completedAt || session.startedAt);
      const dateKey = `${sessionDate.getFullYear()}-${(sessionDate.getMonth() + 1).toString().padStart(2, '0')}-${sessionDate.getDate().toString().padStart(2, '0')}`;

      const sessionExercises = session.exercises.filter(
        (e) => getExerciseIdentityKey(e) === normalizedExerciseKey
      );

      sessionExercises.forEach(exercise => {
        // Resolved once per exercise instead of once per set.
        const resolveLoad = makeLoadResolver(exercise, targetUnit, analyticsBodyweight, analyticsBodyweightUnit);

        let totalExerciseVolume = 0;
        const completedSets: any[] = [];

        exercise.sets.forEach(s => {
          if (s.reps === null || !Number.isFinite(s.reps)) return;

          const effectiveLoad = resolveLoad(s.weight);
          if (effectiveLoad === null || !Number.isFinite(effectiveLoad)) return;

          // Global (all-time) 1RM estimate — considers every set with valid
          // reps regardless of completion, matching the original first pass.
          const current1RM = effectiveLoad * (1 + s.reps / 30);
          if (current1RM > max1RM) max1RM = current1RM;

          // Volume totals only count completed sets.
          if (s.completedAt) {
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

          // Add to chart buckets via direct index math instead of scanning
          // every bucket looking for a timestamp match.
          const dayDiff = todayDayIndex - calendarDayIndex(sessionDate);
          if (dayDiff >= 0) {
            const bucketOffset = Math.floor(dayDiff / windowSizeDays);
            if (bucketOffset < bucketCount) {
              data[bucketCount - 1 - bucketOffset].value += totalExerciseVolume;
            }
          }
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

  const handleDeleteSession = useCallback((ids: Set<string>) => {
    Alert.alert("Delete Daily Log", "Are you sure you want to remove all logs for this date?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => ids.forEach(id => deleteHistorySession(id)) }
    ]);
  }, [deleteHistorySession]);

  const handleEditDate = useCallback((ids: Set<string>, currentIso: string) => {
    const currentDate = new Date(currentIso).toISOString().split('T')[0];
    Alert.prompt("Edit Date", "Enter new date (YYYY-MM-DD):", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Save",
        onPress: (newDate?: string) => {
          if (newDate && /^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
            const newIsoById = new Map<string, string>();
            ids.forEach(id => {
              const session = history.find(s => s._id === id);
              if (session) {
                const oldTime = (session.completedAt || session.startedAt).split('T')[1] || "12:00:00.000Z";
                const newIso = `${newDate}T${oldTime}`;
                newIsoById.set(id, newIso);
                updateSessionDate(id, newIso);
              }
            });

            if (newIsoById.size > 0) {
              // Optimistic patch: updateSessionDate doesn't touch historyIndex,
              // so the hydration effect won't refire for this change.
              setLocalFullHistory((prev) => {
                const next = prev.map((session) =>
                  newIsoById.has(session._id)
                    ? { ...session, completedAt: newIsoById.get(session._id) }
                    : session
                );
                return next.sort((a, b) => {
                  const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
                  const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
                  return bTime - aTime;
                });
              });
            }
          }
        }
      }
    ], "plain-text", currentDate);
  }, [history, updateSessionDate]);

  const handleSaveEditForRow = useCallback((sessionId: string, exerciseId: string, setId: string, weight: number, reps: number) => {
    updateHistorySet(sessionId, exerciseId, setId, "weight", weight);
    updateHistorySet(sessionId, exerciseId, setId, "reps", reps);
    // Optimistic patch straight to local state — avoids relying on the
    // hydration effect to refire and re-read every shard from disk.
    setLocalFullHistory((prev) =>
      prev.map((session) => {
        if (session._id !== sessionId) return session;
        return {
          ...session,
          exercises: session.exercises.map((ex) =>
            ex.id === exerciseId
              ? { ...ex, sets: ex.sets.map((s) => (s.id === setId ? { ...s, weight, reps } : s)) }
              : ex
          ),
        };
      })
    );
  }, [updateHistorySet]);

  const handleEndReached = useCallback(() => {
    setDisplayLimit((prev) => (sessionLogs.length > prev ? prev + 10 : prev));
  }, [sessionLogs.length]);

  const visibleLogs = useMemo(() => sessionLogs.slice(0, displayLimit), [sessionLogs, displayLimit]);

  const renderHeader = (
    <>
      <Text style={styles.title}>Volume Trends:{"\n"}<Text style={{ color: COLORS.ACCENT_GREEN }}>{toTitleCase(displayName)}</Text></Text>

      {/* Muscle Category Trigger */}
      <View style={styles.categorySection}>
        <Pressable onPress={() => setMuscleSelectorVisible(true)}>
          <View style={styles.muscleTrigger}>
            <Text style={styles.muscleTriggerLabel}>Exercise Categories</Text>
            <Text style={styles.muscleTriggerValue} numberOfLines={1}>
              {currentMuscles.length > 0
                ? currentMuscles.map(m => MUSCLE_LABELS[m]).join(', ')
                : 'None selected'}
            </Text>
          </View>
        </Pressable>
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

      <VolumeChart key={range} buckets={buckets} unit={unit} range={range} />

      <View style={styles.logsSection}>
        <View style={styles.disclosureContainer}>
          <TrendingUp size={14} color={COLORS.TEXT_TERTIARY} />
          <Text style={styles.disclosureText}>
            EST. 1RM is calculated using the Epley Formula (Weight × (1 + reps/30)).
            This estimation is most accurate for sets under 10 reps.
          </Text>
        </View>

        <Text style={[UI.SHARED.sectionLabel, { marginBottom: 16 }]}>Daily History</Text>
      </View>
    </>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={UI.SHARED.iconBtn}>
            <ChevronDown size={28} color={COLORS.TEXT_PRIMARY} />
          </Pressable>
          <View style={styles.rangeSelector}>
            {(["30D", "6M", "1Y"] as TimeRange[]).map((r) => (
              <Pressable key={r} onPress={() => setRange(r)} style={[styles.rangeBtn, range === r && styles.rangeBtnActive]}>
                <Text style={[styles.rangeText, range === r && styles.rangeTextActive]}>{r}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <FlatList
          data={visibleLogs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <LogRow
              log={item}
              unit={unit}
              onDeleteSession={handleDeleteSession}
              onEditDate={handleEditDate}
              onSaveEdit={handleSaveEditForRow}
              onToggleScroll={setScrollEnabled}
            />
          )}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={<View style={styles.emptyLogs}><Text style={styles.emptyLogsText}>No recorded sessions found</Text></View>}
          ListFooterComponent={sessionLogs.length > displayLimit ? <View style={styles.footerLoader}><ActivityIndicator size="small" color={COLORS.ACCENT_BLUE} /></View> : null}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          scrollEnabled={scrollEnabled}
        />

        {/* Render modal outside the list */}
        <MuscleSelector
          visible={muscleSelectorVisible}
          onClose={() => setMuscleSelectorVisible(false)}
          selectedMuscles={currentMuscles}
          onSelect={handleMusclesChangeAndClose}
          label="Exercise Categories"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: { paddingTop: UI.HEADER_TOP - 10, paddingHorizontal: UI.LAYOUT_PADDING, paddingBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rangeSelector: { flexDirection: "row", backgroundColor: COLORS.CARD_BG, borderRadius: UI.RADIUS_ITEM, padding: 4 },
  rangeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: UI.RADIUS_ITEM },
  rangeBtnActive: { backgroundColor: COLORS.BG },
  rangeText: { color: COLORS.TEXT_TERTIARY, fontSize: 12, fontWeight: "800" },
  rangeTextActive: { color: COLORS.TEXT_PRIMARY },
  content: { paddingHorizontal: UI.LAYOUT_PADDING, paddingBottom: 120 },
  title: { color: COLORS.TEXT_PRIMARY, fontSize: 32, fontWeight: "900", letterSpacing: -1, lineHeight: 38, fontFamily: FONT_FAMILIES.MEDIUM, marginTop: 20, marginBottom: 24 },
  categorySection: {
    marginBottom: 32,
  },
  muscleTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: UI.RADIUS_CONTAINER,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  muscleTriggerLabel: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  muscleTriggerValue: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONT_FAMILIES.MEDIUM,
    flex: 1,
    marginLeft: 12,
    textAlign: 'right',
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
  statItem: { flex: 1 },
  statLabel: { color: COLORS.TEXT_TERTIARY, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4, fontFamily: FONT_FAMILIES.MEDIUM },
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
     borderRadius: UI.RADIUS_ITEM,
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
  setTag: { backgroundColor: COLORS.CARD_BG, paddingHorizontal: 10, paddingVertical: 6, borderRadius: UI.RADIUS_ITEM },
  setTagText: { color: COLORS.TEXT_PRIMARY, fontSize: 13, fontWeight: "700", fontFamily: FONT_FAMILIES.MONO },
  setTagX: { color: COLORS.TEXT_TERTIARY, fontSize: 10, marginHorizontal: 4, fontFamily: FONT_FAMILIES.MONO },
  editRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.CARD_BG, borderRadius: UI.RADIUS_ITEM, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.ACCENT_BLUE },
  editInput: { color: COLORS.TEXT_PRIMARY, fontFamily: FONT_FAMILIES.MONO, fontSize: 13, fontWeight: "700", width: 35, textAlign: "center", padding: 0 },
  editIcon: { marginLeft: 8, padding: 4 },
  emptyLogs: { padding: 40, alignItems: "center" },
  emptyLogsText: { color: COLORS.TEXT_TERTIARY, fontSize: 14, fontWeight: "600" },
  footerLoader: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  loadMoreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, marginTop: 8 },
  loadMoreText: { color: COLORS.TEXT_SECONDARY, fontSize: 14, fontWeight: "700", fontFamily: FONT_FAMILIES.MEDIUM },
});
