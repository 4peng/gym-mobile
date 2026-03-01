'use client';

import React, { useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
} from "react-native";
import { ChevronLeft, ChevronRight, Search, BarChart2 } from "lucide-react-native";
import Svg, { Rect } from "react-native-svg";
import { useAppRouter } from "@/utils/navigation";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";

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
  const [search, setSearch] = React.useState("");

  const exerciseStats = useMemo(() => {
    const exerciseMap = new Map<string, number[]>();
    
    // Last 10 sessions for mini chart
    history.slice(0, 20).forEach(session => {
      session.exercises.forEach(ex => {
        if (!exerciseMap.has(ex.name)) {
          exerciseMap.set(ex.name, []);
        }
        
        let vol = 0;
        ex.sets.forEach(s => {
          if (s.completedAt && s.weight && s.reps) vol += s.weight * s.reps;
        });
        
        const currentData = exerciseMap.get(ex.name)!;
        if (currentData.length < 10) {
          currentData.unshift(vol);
        }
      });
    });

    return Array.from(exerciseMap.keys())
      .sort()
      .filter(name => name.toLowerCase().includes(search.toLowerCase()))
      .map(name => ({
        name,
        recentVolume: exerciseMap.get(name) || []
      }));
  }, [history, search]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <BarChart2 size={48} color={COLORS.BORDER_LIGHT} strokeWidth={1} />
            <Text style={styles.emptyText}>
              {search ? "No matches found" : "Complete a workout first to see stats"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.item,
              pressed && { backgroundColor: COLORS.CARD_HOVER }
            ]}
            onPress={() => router.push(`/exercises/${encodeURIComponent(item.name)}/volume`)}
          >
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemSub}>View full trends</Text>
            </View>
            
            <MiniChart data={item.recentVolume} />
            
            <ChevronRight size={20} color={COLORS.BORDER_LIGHT} style={{ marginLeft: 16 }} />
          </Pressable>
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
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1D1D21",
    justifyContent: "center",
    alignItems: "center",
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
    marginHorizontal: 24,
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
    paddingVertical: 14,
    marginLeft: 10,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  item: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.02)",
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
