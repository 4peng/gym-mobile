'use client';

import React, { useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  LayoutAnimation,
} from "react-native";
import { Play, Plus, Trash2, ChevronRight, Activity, BarChart2 } from "lucide-react-native";
import { useAppRouter } from "@/utils/navigation";
import { showConfirm } from "@/utils/alerts";
import { useProgramStore } from "@/stores/programStore";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import type { Program } from "@/types";

// ──────────────────────────────────────────────
// ProgramTile (Memoized)
// ──────────────────────────────────────────────

interface ProgramTileProps {
  program: Program;
  onPress: (id: string) => void;
  onStart: (program: Program) => void;
  onDelete: (id: string, name: string) => void;
}

const ProgramTile = React.memo<ProgramTileProps>(function ProgramTile({
  program,
  onPress,
  onStart,
  onDelete,
}) {
  const handlePress = useCallback(() => onPress(program._id), [program._id, onPress]);
  const handleStart = useCallback(() => onStart(program), [program, onStart]);
  const handleDelete = useCallback(() => onDelete(program._id, program.name), [program._id, program.name, onDelete]);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.tile,
        pressed && styles.tilePressed
      ]}
    >
      <View style={styles.tileHeader}>
        <View style={styles.tileMainInfo}>
          <Text style={styles.programName} numberOfLines={1}>{program.name}</Text>
          <View style={styles.metaRow}>
            <Activity size={12} color={COLORS.TEXT_TERTIARY} />
            <Text style={styles.metaText}>
              {program.exercises.length} {program.exercises.length === 1 ? "Exercise" : "Exercises"}
            </Text>
          </View>
        </View>
        <ChevronRight size={20} color={COLORS.BORDER_LIGHT} />
      </View>

      <View style={styles.tileActions}>
        <Pressable
          onPress={handleStart}
          style={({ pressed }) => [
            styles.tileStartBtn,
            pressed && styles.tileStartBtnPressed
          ]}
        >
          <Play size={16} color={COLORS.ACCENT_BLUE} fill={COLORS.ACCENT_BLUE} />
          <Text style={styles.tileStartText}>Start Session</Text>
        </Pressable>
        
        <Pressable
          onPress={handleDelete}
          hitSlop={12}
          style={({ pressed }) => [
            styles.tileDeleteBtn,
            pressed && { opacity: 0.5 }
          ]}
        >
          <Trash2 size={18} color={COLORS.DANGER} />
        </Pressable>
      </View>
    </Pressable>
  );
});

// ──────────────────────────────────────────────
// ProgramsListScreen
// ──────────────────────────────────────────────

export default function ProgramsListScreen() {
  const programs = useProgramStore((s) => s.programs);
  const deleteProgram = useProgramStore((s) => s.deleteProgram);
  
  const activeSession = useWorkoutSessionStore((s) => s.activeSession);
  const startQuickSession = useWorkoutSessionStore((s) => s.startQuickSession);
  const startFromProgram = useWorkoutSessionStore((s) => s.startFromProgram);
  
  const router = useAppRouter();

  const handlePress = useCallback((id: string) => router.push(`/programs/${id}`), [router]);

  const handleStartProgram = useCallback((program: Program) => {
    if (activeSession) {
      showConfirm(
        "Active Workout",
        "You already have a workout in progress. Discard it and start this one?",
        () => {
          startFromProgram(program);
          router.push("/workout");
        }
      );
    } else {
      startFromProgram(program);
      router.push("/workout");
    }
  }, [activeSession, startFromProgram, router]);

  const handleQuickStart = useCallback(() => {
    if (activeSession) {
      router.push("/workout");
    } else {
      startQuickSession();
      router.push("/workout");
    }
  }, [activeSession, startQuickSession, router]);

  const handleDelete = useCallback((id: string, name: string) => {
    showConfirm(
      "Delete Program",
      `Are you sure you want to delete "${name}"? This cannot be undone.`,
      () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        deleteProgram(id);
      }
    );
  }, [deleteProgram]);

  const handleCreate = useCallback(() => router.push("/programs/create"), [router]);

  const renderItem = useCallback(({ item }: { item: Program }) => (
    <ProgramTile
      program={item}
      onPress={handlePress}
      onStart={handleStartProgram}
      onDelete={handleDelete}
    />
  ), [handlePress, handleStartProgram, handleDelete]);

  return (
    <View style={styles.container}>
      {/* Dynamic Header Area */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Daily Training</Text>
          <Text style={styles.headerTitle}>My Programs</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable 
            onPress={() => router.push("/stats")} 
            style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.7 }]}
          >
            <BarChart2 size={24} color={COLORS.TEXT_SECONDARY} />
          </Pressable>
          <Pressable 
            onPress={handleQuickStart} 
            style={({ pressed }) => [styles.quickStartIcon, pressed && { opacity: 0.7 }]}
          >
            <Play size={24} color={COLORS.ACCENT_BLUE} fill={COLORS.ACCENT_BLUE} />
          </Pressable>
        </View>
      </View>

      {/* Active Session Card (If exists) */}
      {activeSession && (
        <View style={styles.activeContainer}>
          <Text style={styles.sectionLabel}>Active Session</Text>
          <Pressable
            style={({ pressed }) => [
              styles.activeBanner,
              pressed && { opacity: 0.85 }
            ]}
            onPress={() => router.push("/workout")}
          >
            <View style={styles.activeIndicator} />
            <Text style={styles.activeBannerText}>Workout in progress—resume now</Text>
            <ChevronRight size={16} color={COLORS.ACCENT_BLUE} />
          </Pressable>
        </View>
      )}

      {/* Main List */}
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionLabel}>Available Routines</Text>
        {programs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Activity size={48} color={COLORS.BORDER_LIGHT} strokeWidth={1} />
            <Text style={styles.emptyText}>No programs yet.</Text>
            <Text style={styles.emptySubtext}>Create your first custom workout to get started.</Text>
          </View>
        ) : (
          <FlatList
            data={programs}
            renderItem={renderItem}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Floating Action Button */}
      <Pressable 
        onPress={handleCreate} 
        style={({ pressed }) => [
          styles.fab,
          pressed && { transform: [{ scale: 0.95 }], opacity: 0.9 }
        ]}
      >
        <Plus size={28} color={COLORS.TEXT_PRIMARY} strokeWidth={3} />
      </Pressable>
    </View>
  );
}

// ──────────────────────────────────────────────
// Styles (Premium Minimalist)
// ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: 70,
    paddingBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  greeting: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 2,
    fontFamily: FONT_FAMILIES.MEDIUM,
    marginBottom: 4,
  },
  headerTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -2,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  headerIconBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#1D1D21",
    justifyContent: "center",
    alignItems: "center",
  },
  quickStartIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#1D1D21",
    justifyContent: "center",
    alignItems: "center",
  },

  // Section Labels
  sectionLabel: {
    paddingHorizontal: 24,
    color: COLORS.TEXT_TERTIARY,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 16,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },

  // Active Session
  activeContainer: {
    marginBottom: 32,
  },
  activeBanner: {
    backgroundColor: "#121214",
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginHorizontal: 24,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(11, 130, 255, 0.2)",
  },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.ACCENT_BLUE,
    marginRight: 12,
  },
  activeBannerText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },

  // List
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
  },

  // Tile Design
  tile: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 28,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
    // Subtle shadow for depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 5,
  },
  tilePressed: {
    backgroundColor: COLORS.CARD_HOVER,
    transform: [{ scale: 0.99 }],
  },
  tileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  tileMainInfo: {
    flex: 1,
  },
  programName: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -1,
    fontFamily: FONT_FAMILIES.MEDIUM,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  tileActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tileStartBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#1D1D21",
    paddingVertical: 14,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  tileStartBtnPressed: {
    backgroundColor: "#27272A",
  },
  tileStartText: {
    color: COLORS.ACCENT_BLUE,
    fontSize: 14,
    fontWeight: "900",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  tileDeleteBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    marginTop: 60,
  },
  emptyText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 20,
    marginBottom: 8,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  emptySubtext: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },

  // FAB
  fab: {
    position: "absolute",
    bottom: 40,
    right: 30,
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.ACCENT_BLUE,
    justifyContent: "center",
    alignItems: "center",
    // Premium shadow
    shadowColor: COLORS.ACCENT_BLUE,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
