'use client';

import React, { useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  LayoutAnimation,
} from "react-native";
import { ChevronLeft, ChevronRight, Search, BarChart2, Pin } from "lucide-react-native";
import Svg, { Rect } from "react-native-svg";
import { useAppRouter } from "@/utils/navigation";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import { toTitleCase } from "@/utils/string";
import { Swipeable } from "@/src/components/Swipeable";

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
  const history = useWorkoutSessionStore((s) => s.history);
  const pinnedExerciseNames = useWorkoutSessionStore((s) => s.pinnedExerciseNames || []);
  const togglePinExercise = useWorkoutSessionStore((s) => s.togglePinExercise);
  const [search, setSearch] = React.useState("");
  const [scrollEnabled, setScrollEnabled] = React.useState(true);

  const exerciseStats = useMemo(() => {
    const exerciseMap = new Map<string, number[]>();
    const originalNameMap = new Map<string, string>();
    
    history.forEach(session => {
      session.exercises.forEach(ex => {
        const lowerName = ex.name.toLowerCase();
        if (!exerciseMap.has(lowerName)) {
          exerciseMap.set(lowerName, []);
          originalNameMap.set(lowerName, ex.name);
        }
        
        let vol = 0;
        ex.sets.forEach(s => {
          if (s.completedAt && s.weight && s.reps) vol += s.weight * s.reps;
        });
        
        const currentData = exerciseMap.get(lowerName)!;
        if (currentData.length < 10) {
          currentData.unshift(vol);
        }
      });
    });

    return Array.from(exerciseMap.keys())
      .filter(lowerName => lowerName.includes(search.toLowerCase()))
      .sort((a, b) => {
        const aPinned = pinnedExerciseNames.includes(a);
        const bPinned = pinnedExerciseNames.includes(b);
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return a.localeCompare(b);
      })
      .map(lowerName => ({
        name: originalNameMap.get(lowerName) || lowerName,
        isPinned: pinnedExerciseNames.includes(lowerName),
        recentVolume: exerciseMap.get(lowerName) || []
      }));
  }, [history, search, pinnedExerciseNames]);

  const handlePin = useCallback((name: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    togglePinExercise(name);
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

      {/* List */}
      <FlatList
        data={exerciseStats}
        keyExtractor={(item) => item.name}
        contentContainerStyle={styles.listContent}
        scrollEnabled={scrollEnabled}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <BarChart2 size={48} color={COLORS.BORDER_LIGHT} strokeWidth={1} />
            <Text style={styles.emptyText}>
              {search ? "No matches found" : "Complete a workout first to see stats"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Swipeable 
            onDelete={() => {}} // No delete on insights page
            onPin={() => handlePin(item.name)} 
            onToggleScroll={setScrollEnabled}
          >
            <Pressable
              style={({ pressed }) => [
                UI.SHARED.card,
                { padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 0, borderRadius: 0 },
                pressed && { backgroundColor: COLORS.CARD_HOVER }
              ]}
              onPress={() => router.push(`/exercises/${encodeURIComponent(item.name)}/volume`)}
            >
              <View style={styles.itemInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.itemName}>{toTitleCase(item.name)}</Text>
                  {item.isPinned && (
                    <Pin size={14} color={COLORS.ACCENT_BLUE} fill={COLORS.ACCENT_BLUE} />
                  )}
                </View>
                <Text style={styles.itemSub}>View full trends</Text>
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
    marginBottom: 20,
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
