'use client';

import React, { useMemo, useCallback, useEffect } from "react";
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
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import { toTitleCase } from "@/utils/string";
import { Swipeable } from "@/src/components/Swipeable";
import {
  DETAILED_MODE_MUSCLE_GROUPS,
  expandPrimaryMusclesForDetailedMode,
  MUSCLE_GROUPS,
  MUSCLE_LABELS,
  MuscleGroup,
} from "@/constants/muscles";
import { getExerciseIdentityKey } from "@/utils/exerciseIdentity";
import { resolveEffectiveStrengthLoad } from "@/utils/bodyweightAnalytics";

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
  const pinnedExerciseNames = useWorkoutSessionStore((s) => s.pinnedExerciseNames || []);
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
  const history = useMemo(
    () => rawHistory.filter((session) => !session.deletedAt),
    [rawHistory]
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
        
        let vol = 0;
        ex.sets.forEach(s => {
          if (!s.completedAt || s.reps === null || !Number.isFinite(s.reps)) return;
          const effectiveLoad = resolveEffectiveStrengthLoad(
            ex,
            s.weight,
            ex.weightUnit || "kg",
            ex.weightUnit || "kg",
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
          renderItem={({ item }) => {
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
          }}
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
        renderItem={({ item }) => (
          <Swipeable 
            onDelete={() => {}} // No delete on insights page
            onPin={() => handlePin(item.key)} 
            onToggleScroll={setScrollEnabled}
            style={{ marginBottom: 16 }}
            borderRadius={0}
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
        )}
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
    marginHorizontal: UI.LAYOUT_PADDING,
    paddingHorizontal: 16,
    borderRadius: 16,
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
    borderRadius: 12,
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
    borderRadius: 8,
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
