import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BarChart2, ChevronRight, Pin, Search } from "lucide-react-native";
import Svg, { Rect } from "react-native-svg";
import { useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { useUiPreferencesStore } from "@/stores/uiPreferencesStore";
import { workoutRepo } from "@/db";
import { useDbQuery } from "@/db/dbVersion";
import { COLORS, LAYOUT, RADIUS, SPACE, SURFACE, TYPE, UI } from "@/constants/theme";
import { toTitleCase } from "@/utils/string";
import { Swipeable } from "@/components/Swipeable";
import { Chip } from "@/components/ui/Chip";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  DETAILED_MODE_MUSCLE_GROUPS,
  expandPrimaryMusclesForDetailedMode,
  MUSCLE_LABELS,
  MuscleGroup,
  PRIMARY_MUSCLE_GROUPS,
} from "@/constants/muscles";
import { makeLoadResolver } from "@/utils/bodyweightAnalytics";

const RECENT = 10;

function MiniChart({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  return (
    <View style={styles.miniChart}>
      <Svg width={60} height={30}>
        {data.map((v, i) => {
          const h = (v / max) * 30;
          return (
            <Rect
              key={i}
              x={i * 6}
              y={30 - h}
              width={4}
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
}

interface ExerciseStat {
  key: string;
  name: string;
  isPinned: boolean;
  recentVolume: number[];
  muscles: MuscleGroup[];
}

/** Every exercise ever logged, with a 10-session volume sparkline. Swipe right to pin. */
export default function ExerciseListStatsScreen() {
  const router = useRouter();
  const pinned = useWorkoutSessionStore(useShallow((s) => s.pinnedExerciseNames));
  const togglePinExercise = useWorkoutSessionStore((s) => s.togglePinExercise);
  const showDetailed = useUiPreferencesStore((s) => s.showDetailedMuscleGroups);
  const analyticsBodyweight = useUiPreferencesStore((s) => s.analyticsBodyweight);
  const analyticsBodyweightUnit = useUiPreferencesStore((s) => s.analyticsBodyweightUnit);

  const [search, setSearch] = useState("");
  const [selectedMuscles, setSelectedMuscles] = useState<MuscleGroup[]>([]);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const selectable: readonly MuscleGroup[] = showDetailed
    ? DETAILED_MODE_MUSCLE_GROUPS
    : PRIMARY_MUSCLE_GROUPS;

  useEffect(() => {
    const allowed = new Set(selectable);
    setSelectedMuscles((prev) => prev.filter((m) => allowed.has(m)));
  }, [selectable]);

  const rows = useDbQuery(() => workoutRepo.recentExercises(RECENT));

  const stats = useMemo((): ExerciseStat[] => {
    const byKey = new Map<string, ExerciseStat>();
    for (const row of rows) {
      const ex = row.exercise;
      let stat = byKey.get(row.identityKey);
      if (!stat) {
        stat = {
          key: row.identityKey,
          name: ex.name,
          isPinned: pinned.includes(row.identityKey),
          recentVolume: [],
          muscles: showDetailed
            ? expandPrimaryMusclesForDetailedMode(ex.muscles || [])
            : ex.muscles || [],
        };
        byKey.set(row.identityKey, stat);
      }
      const unit = ex.weightUnit || "kg";
      const resolveLoad = makeLoadResolver(ex, unit, analyticsBodyweight, analyticsBodyweightUnit);
      let volume = 0;
      for (const s of ex.sets) {
        if (!s.completedAt || s.reps === null) continue;
        const load = resolveLoad(s.weight);
        if (load !== null) volume += load * s.reps;
      }
      stat.recentVolume.unshift(volume); // rows arrive newest first; chart reads oldest → newest
    }

    const q = search.toLowerCase();
    return Array.from(byKey.values())
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) &&
          (selectedMuscles.length === 0 || selectedMuscles.some((m) => s.muscles.includes(m))),
      )
      .sort((a, b) =>
        a.isPinned !== b.isPinned ? (a.isPinned ? -1 : 1) : a.name.localeCompare(b.name),
      );
  }, [
    rows,
    pinned,
    showDetailed,
    analyticsBodyweight,
    analyticsBodyweightUnit,
    search,
    selectedMuscles,
  ]);

  const toggleMuscle = useCallback((m: MuscleGroup | "all") => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedMuscles((prev) =>
      m === "all" ? [] : prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
  }, []);

  return (
    <View style={UI.screen}>
      <ScreenHeader title="Exercise stats" back />

      <View style={[UI.inset, styles.search]}>
        <Search size={18} color={COLORS.TEXT_TERTIARY} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises..."
          placeholderTextColor={COLORS.TEXT_TERTIARY}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={["all", ...selectable] as (MuscleGroup | "all")[]}
        keyExtractor={(m) => m}
        contentContainerStyle={styles.chips}
        style={styles.chipRow}
        renderItem={({ item }) => (
          <Chip
            label={item === "all" ? "All" : MUSCLE_LABELS[item]}
            active={item === "all" ? selectedMuscles.length === 0 : selectedMuscles.includes(item)}
            onPress={() => toggleMuscle(item)}
          />
        )}
      />

      <FlatList
        data={stats}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        scrollEnabled={scrollEnabled}
        ListEmptyComponent={
          <EmptyState
            icon={<BarChart2 size={48} color={COLORS.BORDER_LIGHT} strokeWidth={1} />}
            title={search || selectedMuscles.length ? "No matches" : "No stats yet"}
            subtitle={search || selectedMuscles.length ? undefined : "Complete a workout first."}
          />
        }
        renderItem={({ item }) => (
          <Swipeable
            onPin={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              togglePinExercise(item.key);
            }}
            onToggleScroll={setScrollEnabled}
            borderRadius={RADIUS.container}
            marginBottom={SPACE.md}
          >
            <Pressable
              style={({ pressed }) => [
                UI.card,
                styles.item,
                pressed && { backgroundColor: COLORS.CARD_HOVER },
              ]}
              onPress={() => router.push(`/exercises/${encodeURIComponent(item.key)}/volume`)}
            >
              <View style={{ flex: 1, gap: SPACE.xs }}>
                <View style={[UI.row, { gap: SPACE.sm }]}>
                  <Text style={[TYPE.body, { fontSize: 17 }]}>{toTitleCase(item.name)}</Text>
                  {item.isPinned && (
                    <Pin size={14} color={COLORS.ACCENT_BLUE} fill={COLORS.ACCENT_BLUE} />
                  )}
                </View>
                <Text
                  style={[
                    TYPE.label,
                    { color: item.muscles.length ? COLORS.ACCENT_BLUE : COLORS.TEXT_TERTIARY },
                  ]}
                >
                  {item.muscles.length
                    ? item.muscles.map((m) => MUSCLE_LABELS[m]).join(" · ")
                    : "No category"}
                </Text>
              </View>
              <MiniChart data={item.recentVolume} />
              <ChevronRight size={20} color={COLORS.BORDER_LIGHT} />
            </Pressable>
          </Swipeable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: LAYOUT.gutter,
    marginBottom: SPACE.lg,
    paddingHorizontal: SPACE.lg,
    backgroundColor: COLORS.CARD_BG,
    borderRadius: RADIUS.container,
  },
  searchInput: { ...TYPE.body, flex: 1, paddingVertical: SPACE.md, marginLeft: SPACE.sm + 2 },
  chipRow: { flexGrow: 0, marginBottom: SPACE.xl },
  chips: { paddingHorizontal: LAYOUT.gutter, gap: SPACE.sm },
  list: { paddingHorizontal: LAYOUT.gutter, paddingBottom: SPACE.xxxl + SPACE.sm },
  item: { padding: SPACE.xl, flexDirection: "row", alignItems: "center", gap: SPACE.lg },
  miniChart: { backgroundColor: SURFACE.greenTint, padding: SPACE.sm, borderRadius: RADIUS.item },
});
