import React, { useMemo, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  LayoutAnimation,
} from "react-native";
import { ChevronLeft, ChevronRight, Search, BarChart2, Pin, Filter } from "lucide-react-native";
import Svg, { Rect } from "react-native-svg";
import { useAppRouter } from "@/utils/navigation";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { useUiPreferencesStore } from "@/stores/uiPreferencesStore";
import { workoutStorage } from "@/storage/workoutStorage";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import { toTitleCase } from "@/utils/string";
import { Swipeable } from "@/src/components/Swipeable";
import { WorkoutSession } from "@/src/types";
import {
  DETAILED_MODE_MUSCLE_GROUPS,
  expandPrimaryMusclesForDetailedMode,
  MUSCLE_GROUPS,
  MUSCLE_LABELS,
  MuscleGroup,
} from "@/constants/muscles";
import { getExerciseIdentityKey } from "@/utils/exerciseIdentity";
import { isBodyweightStrengthExercise, type WeightUnit } from "@/utils/bodyweightAnalytics";
import { convertWeight } from "@/utils/conversions";

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

// ──────────────────────────────────────────────
// Mini Chart Component
// ──────────────────────────────────────────────

const MiniChart = ({ data }: { data: number[] }) => {
  const max = Math.max(1, ...data);
  const width = 60;
  const height = 30;
  const barWidth = 4;
  const gap = 2;

  return (
    <View style={styles.miniChart}>
      <Svg width={width} height={height}>
        {data.map((val, i) => {
          const h = (val / max) * height;
          return (
            <Rect
              key={i}
              x={i * (barWidth + gap)}
              y={height - h}
              width={barWidth}
              height={Math.max(1, h)}
              fill={COLORS.ACCENT_GREEN}
              rx={1}
              opacity={0.8}
            />
          );
        })}
      </Svg>
    </View>
  );
};

// ──────────────────────────────────────────────
// ExerciseListStatsScreen
// ──────────────────────────────────────────────

export default function ExerciseListStatsScreen() {
  const router = useAppRouter();
  const rawHistory = useWorkoutSessionStore((s) => s.history);
  const historyIndex = useWorkoutSessionStore((s) => s.historyIndex);
  const pinnedExerciseNamesRaw = useWorkoutSessionStore((s) => s.pinnedExerciseNames);
  const pinnedExerciseNames = useMemo(
    () => pinnedExerciseNamesRaw || [],
    [pinnedExerciseNamesRaw]
  );
  const togglePinExercise = useWorkoutSessionStore((s) => s.togglePinExercise);
  const showDetailedMuscleGroups = useUiPreferencesStore(
    (s) => s.showDetailedMuscleGroups
  );
  const analyticsBodyweight = useUiPreferencesStore((s) => s.analyticsBodyweight);
  const analyticsBodyweightUnit = useUiPreferencesStore((s) => s.analyticsBodyweightUnit);
  const [search, setSearch] = React.useState("");
  const [selectedMuscles, setSelectedMuscles] = React.useState<MuscleGroup[]>([]);
  const [scrollEnabled, setScrollEnabled] = React.useState(true);
  const selectableMuscles: readonly MuscleGroup[] = showDetailedMuscleGroups
    ? (DETAILED_MODE_MUSCLE_GROUPS as readonly MuscleGroup[])
    : (MUSCLE_GROUPS as readonly MuscleGroup[]);
  // Shards already fetched from disk, keyed by session _id, so repeated
  // hydration passes never re-request a shard we already have in memory.
  const hydratedShardsRef = useRef<Map<string, WorkoutSession>>(new Map());
  const [diskShards, setDiskShards] = React.useState<WorkoutSession[]>([]);

  /**
   * Shard Hydration Strategy:
   * The store only keeps ~15 sessions in RAM, so we load the remaining
   * shards from disk to make sure the aggregate stats reflect the entire
   * history. This only needs to run when the set of known session ids
   * actually grows/shrinks (historyIndex.length) — not on every store
   * write, which would otherwise re-read every shard from disk each time
   * (e.g. on every pin toggle or unrelated store mutation).
   */
  // Depend on the historyIndex ARRAY (not just its length): its reference is
  // stable across per-keystroke store writes (those mutate activeSession/history,
  // not historyIndex) but changes whenever a session is added OR removed — so
  // this stays perf-safe while correctly reacting to deletions and same-length
  // membership swaps (e.g. a sync that drops N deleted ids and adds N new ones).
  useEffect(() => {
    let isMounted = true;
    // Evict cached shards whose session is no longer in the index (deleted),
    // so removed workouts stop contributing to aggregates.
    const validIds = new Set(historyIndex);
    for (const id of Array.from(hydratedShardsRef.current.keys())) {
      if (!validIds.has(id)) hydratedShardsRef.current.delete(id);
    }
    const loadShards = async () => {
      try {
        const cachedIds = new Set(rawHistory.map((s) => s._id));
        const missingIds = historyIndex.filter(
          (id) => !cachedIds.has(id) && !hydratedShardsRef.current.has(id)
        );
        if (missingIds.length > 0) {
          const shards = await workoutStorage.getBatch(missingIds);
          shards.forEach((s) => hydratedShardsRef.current.set(s._id, s));
        }
        if (isMounted) {
          setDiskShards(Array.from(hydratedShardsRef.current.values()));
        }
      } catch (err) {
        console.error("Failed to hydrate shards for exercise stats:", err);
      }
    };

    loadShards();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyIndex]);

  const fullHistory = useMemo(() => {
    // Only merge cached shards that are still live in the index — guards
    // against a deleted session lingering in diskShards before the effect
    // eviction publishes.
    const validIds = new Set(historyIndex);
    const cachedIds = new Set(rawHistory.map((s) => s._id));
    const extraShards = diskShards.filter(
      (s) => validIds.has(s._id) && !cachedIds.has(s._id)
    );
    return [...rawHistory, ...extraShards];
  }, [rawHistory, diskShards, historyIndex]);

  const history = useMemo(
    () => fullHistory.filter((session) => !session.deletedAt),
    [fullHistory]
  );

  useEffect(() => {
    const allowed = new Set(selectableMuscles);
    setSelectedMuscles((prev) => prev.filter((m) => allowed.has(m)));
  }, [selectableMuscles]);

  const toggleMuscleFilter = useCallback((muscle: MuscleGroup | "all") => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (muscle === "all") {
      setSelectedMuscles([]);
      return;
    }
    setSelectedMuscles((prev) =>
      prev.includes(muscle)
        ? prev.filter((m) => m !== muscle)
        : [...prev, muscle]
    );
  }, []);

  const exerciseStats = useMemo(() => {
    const exerciseMap = new Map<string, number[]>();
    const originalNameMap = new Map<string, string>();
    const musclesMap = new Map<string, MuscleGroup[]>();
    
    history.forEach(session => {
      session.exercises.forEach(ex => {
        const identityKey = getExerciseIdentityKey(ex);
        if (!exerciseMap.has(identityKey)) {
          exerciseMap.set(identityKey, []);
          originalNameMap.set(identityKey, ex.name);
          musclesMap.set(
            identityKey,
            showDetailedMuscleGroups
              ? expandPrimaryMusclesForDetailedMode(ex.muscles || [])
              : ex.muscles || []
          );
        }
        
        // Resolved once per exercise (not per set) since it only depends on
        // the exercise's identity, not on any individual set's data.
        const exWeightUnit = ex.weightUnit || "kg";
        const exIsBodyweight = isBodyweightStrengthExercise(ex);

        let vol = 0;
        ex.sets.forEach(s => {
          if (!s.completedAt || s.reps === null || !Number.isFinite(s.reps)) return;
          const effectiveLoad = resolveEffectiveLoadForKnownBodyweight(
            exIsBodyweight,
            s.weight,
            exWeightUnit,
            exWeightUnit,
            analyticsBodyweight,
            analyticsBodyweightUnit
          );
          if (effectiveLoad === null || !Number.isFinite(effectiveLoad)) return;
          vol += effectiveLoad * s.reps;
        });
        
        const currentData = exerciseMap.get(identityKey)!;
        if (currentData.length < 10) {
          currentData.unshift(vol);
        }
      });
    });

    return Array.from(exerciseMap.keys())
      .filter((identityKey) => {
        const displayName = (originalNameMap.get(identityKey) || identityKey).toLowerCase();
        const matchesSearch = displayName.includes(search.toLowerCase());
        const muscles = musclesMap.get(identityKey) || [];
        const matchesMuscle =
          selectedMuscles.length === 0 ||
          selectedMuscles.some((selected) => muscles.includes(selected));
        return matchesSearch && matchesMuscle;
      })
      .sort((a, b) => {
        const aPinned = pinnedExerciseNames.includes(a);
        const bPinned = pinnedExerciseNames.includes(b);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return (originalNameMap.get(a) || a).localeCompare(originalNameMap.get(b) || b);
      })
      .map((identityKey) => ({
        key: identityKey,
        name: originalNameMap.get(identityKey) || identityKey,
        isPinned: pinnedExerciseNames.includes(identityKey),
        recentVolume: exerciseMap.get(identityKey) || [],
        muscles: musclesMap.get(identityKey) || []
      }));
  }, [
    analyticsBodyweight,
    analyticsBodyweightUnit,
    history,
    search,
    pinnedExerciseNames,
    selectedMuscles,
    showDetailedMuscleGroups,
  ]);

  const handlePin = useCallback((identityKey: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    togglePinExercise(identityKey);
  }, [togglePinExercise]);

  const renderMuscleFilterItem = useCallback(
    ({ item }: { item: string }) => {
      const isAllChip = item === "all";
      const isActive = isAllChip
        ? selectedMuscles.length === 0
        : selectedMuscles.includes(item as MuscleGroup);
      return (
        <Pressable
          onPress={() => toggleMuscleFilter(item as MuscleGroup | "all")}
          style={[
            styles.filterPill,
            isActive && styles.filterPillActive
          ]}
        >
          <Text style={[
            styles.filterText,
            isActive && styles.filterTextActive
          ]}>
            {isAllChip ? "All" : MUSCLE_LABELS[item as MuscleGroup]}
          </Text>
        </Pressable>
      );
    },
    [selectedMuscles, toggleMuscleFilter]
  );

  const renderExerciseItem = useCallback(
    ({ item }: { item: (typeof exerciseStats)[number] }) => (
      <Swipeable
        onDelete={() => {}} // No delete on insights page
        onPin={() => handlePin(item.key)}
        onToggleScroll={setScrollEnabled}
      >
        <Pressable
          style={({ pressed }) => [
            UI.SHARED.card,
            { padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 0, borderRadius: 0 },
            pressed && { backgroundColor: COLORS.CARD_HOVER }
          ]}
          onPress={() => router.push(`/exercises/${encodeURIComponent(item.key)}/volume`)}
        >
          <View style={styles.itemInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.itemName}>{toTitleCase(item.name)}</Text>
              {item.isPinned && (
                <Pin size={14} color={COLORS.ACCENT_BLUE} fill={COLORS.ACCENT_BLUE} />
              )}
            </View>
            <View style={styles.muscleRow}>
              {item.muscles.length > 0 ? (
                item.muscles.map((m, i) => (
                  <Text key={m} style={styles.muscleLabel}>
                    {MUSCLE_LABELS[m]}{i < item.muscles.length - 1 ? " • " : ""}
                  </Text>
                ))
              ) : (
                <Text style={styles.itemSub}>No category</Text>
              )}
            </View>
          </View>

          <MiniChart data={item.recentVolume} />

          <ChevronRight size={20} color={COLORS.BORDER_LIGHT} style={{ marginLeft: 16 }} />
        </Pressable>
      </Swipeable>
    ),
    [handlePin, router, setScrollEnabled]
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={UI.SHARED.iconBtn}>
          <ChevronLeft size={28} color={COLORS.TEXT_PRIMARY} />
        </Pressable>
        <Text style={styles.title}>Exercise Stats</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={18} color={COLORS.TEXT_TERTIARY} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises..."
          placeholderTextColor={COLORS.TEXT_TERTIARY}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Muscle Filter */}
      <View style={styles.filterWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={["all", ...selectableMuscles]}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterContainer}
          renderItem={renderMuscleFilterItem}
        />
      </View>

      {/* List */}
      <FlatList
        data={exerciseStats}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        scrollEnabled={scrollEnabled}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <BarChart2 size={48} color={COLORS.BORDER_LIGHT} strokeWidth={1} />
            <Text style={styles.emptyText}>
              {search || selectedMuscles.length > 0 ? "No matches found" : "Complete a workout first to see stats"}
            </Text>
          </View>
        }
        renderItem={renderExerciseItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },
  header: {
    paddingTop: UI.HEADER_TOP - 10,
    paddingHorizontal: UI.LAYOUT_PADDING,
    paddingBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.CARD_BG,
    borderRadius: UI.RADIUS_CONTAINER,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
  },
  searchInput: {
    flex: 1,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    paddingVertical: 12,
    marginLeft: 10,
    fontFamily: FONT_FAMILIES.MEDIUM,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  filterWrapper: {
    marginBottom: 20,
  },
  filterContainer: {
    paddingHorizontal: UI.LAYOUT_PADDING,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: UI.RADIUS_ITEM,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  filterPillActive: {
    backgroundColor: 'rgba(11, 130, 255, 0.15)',
    borderColor: 'rgba(11, 130, 255, 0.3)',
  },
  filterText: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 13,
    fontWeight: '800',
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  filterTextActive: {
    color: COLORS.ACCENT_BLUE,
  },
  listContent: {
    paddingHorizontal: UI.LAYOUT_PADDING,
    paddingBottom: 40,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  itemSub: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 12,
    fontWeight: "600",
  },
  muscleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  muscleLabel: {
    color: COLORS.ACCENT_BLUE,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  miniChart: {
    backgroundColor: "rgba(74, 222, 128, 0.05)",
    padding: 8,
    borderRadius: UI.RADIUS_ITEM,
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 100,
  },
  emptyText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 20,
    textAlign: "center",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
});
