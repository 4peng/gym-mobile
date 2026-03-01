'use client';

import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { ChevronLeft, Play, Plus, Layout } from "lucide-react-native";
import { useAppRouter, useAppParams } from "@/utils/navigation";
import { showAlert, showConfirm } from "@/utils/alerts";
import { useProgramStore, type ExerciseInput } from "@/stores/programStore";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import ExerciseEditor, {
  type ExerciseFormData,
} from "@/components/ExerciseEditor";
import type { ProgramExercise } from "@/types";
import { generateId } from "@/utils/id";

// ──────────────────────────────────────────────
// EditProgramScreen
// ──────────────────────────────────────────────

export default function EditProgramScreen() {
  const { id } = useAppParams<{ id: string }>();
  const router = useAppRouter();

  const program = useProgramStore((s) =>
    s.programs.find((p) => p._id === id)
  );
  const updateProgram = useProgramStore((s) => s.updateProgram);
  const updateExercise = useProgramStore((s) => s.updateExercise);
  const removeExercise = useProgramStore((s) => s.removeExercise);
  const addExercise = useProgramStore((s) => s.addExercise);

  const activeSession = useWorkoutSessionStore((s) => s.activeSession);
  const startFromProgram = useWorkoutSessionStore((s) => s.startFromProgram);

  const handleStart = useCallback(() => {
    if (!program) return;
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
  }, [activeSession, program, startFromProgram, router]);

  const exerciseFormData: ExerciseFormData[] = useMemo(() => {
    if (!program) return [];
    return program.exercises.map((e: ProgramExercise) => ({
      id: e.id,
      name: e.name,
      defaultSets: e.defaultSets,
      restSeconds: e.restSeconds,
      notes: e.notes,
    }));
  }, [program]);

  // ── Handlers ─────────────────────────────────

  const handleNameChange = useCallback(
    (text: string) => {
      if (!id) return;
      updateProgram(id, { name: text });
    },
    [id, updateProgram]
  );

  const handleUpdateExercise = useCallback(
    (exerciseId: string, updates: Partial<Omit<ExerciseFormData, "id">>) => {
      if (!id) return;
      updateExercise(id, exerciseId, updates);
    },
    [id, updateExercise]
  );

  const handleRemoveExercise = useCallback(
    (exerciseId: string) => {
      if (!id) return;
      showConfirm(
        "Remove Exercise",
        "Remove this exercise from the program?",
        () => removeExercise(id, exerciseId)
      );
    },
    [id, removeExercise]
  );

  const handleAddExercise = useCallback(() => {
    if (!id) return;
    const input: ExerciseInput = {
      name: "",
      defaultSets: 3,
      restSeconds: 90,
      notes: "",
    };
    addExercise(id, input);
  }, [id, addExercise]);

  const handleBack = useCallback(() => {
    // Validate before leaving: warn if any exercise has empty name
    if (program) {
      const emptyIdx = program.exercises.findIndex(
        (e) => e.name.trim() === ""
      );
      if (emptyIdx !== -1) {
        showAlert(
          "Incomplete Exercise",
          `Exercise ${emptyIdx + 1} needs a name. Remove it or add a name before leaving.`
        );
        return;
      }
    }
    router.back();
  }, [program, router]);

  // ── Guard ────────────────────────────────────

  if (!program) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <ChevronLeft size={24} color={COLORS.TEXT_SECONDARY} />
          </Pressable>
          <Text style={styles.headerTitle}>Not Found</Text>
          <View style={{ width: 52 }} />
        </View>
      </View>
    );
  }

  // ── Render ───────────────────────────────────

  const renderExercise = ({ item, index }: { item: ExerciseFormData; index: number }) => (
    <ExerciseEditor
      exercise={item}
      index={index}
      onUpdate={handleUpdateExercise}
      onRemove={handleRemoveExercise}
    />
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header Area */}
      <View style={styles.header}>
        <Pressable 
          onPress={handleBack} 
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
        >
          <ChevronLeft size={24} color={COLORS.TEXT_SECONDARY} />
        </Pressable>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerLabel}>Editor Mode</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>Edit Routine</Text>
        </View>
        <Pressable 
          onPress={handleStart} 
          style={({ pressed }) => [styles.playBtn, pressed && { transform: [{scale: 0.96}] }]}
        >
          <Play size={22} color={COLORS.ACCENT_BLUE} fill={COLORS.ACCENT_BLUE} />
        </Pressable>
      </View>

      {/* Program Metadata */}
      <View style={styles.metaSection}>
        <Text style={styles.sectionLabel}>Identification</Text>
        <View style={styles.nameInputContainer}>
          <Layout size={20} color={COLORS.TEXT_TERTIARY} />
          <TextInput
            style={styles.nameInput}
            value={program.name}
            onChangeText={handleNameChange}
            placeholder="Routine name"
            placeholderTextColor={COLORS.TEXT_TERTIARY}
          />
        </View>
      </View>

      {/* Exercises Section */}
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionLabel}>Exercise Stack ({program.exercises.length})</Text>
        <FlatList
          data={exerciseFormData}
          renderItem={renderExercise}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            <Pressable 
              onPress={handleAddExercise} 
              style={({ pressed }) => [
                styles.addBtn,
                pressed && { backgroundColor: "#1D1D21", transform: [{scale: 0.99}] }
              ]}
            >
              <Plus size={20} color={COLORS.ACCENT_BLUE} strokeWidth={3} />
              <Text style={styles.addBtnText}>Add Exercise</Text>
            </Pressable>
          }
        />
      </View>
    </KeyboardAvoidingView>
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
    paddingBottom: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  headerTitleGroup: {
    flex: 1,
  },
  headerLabel: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2,
    fontFamily: FONT_FAMILIES.MEDIUM,
    marginBottom: 4,
  },
  headerTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  iconBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#1D1D21",
    justifyContent: "center",
    alignItems: "center",
  },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#1D1D21",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(11, 130, 255, 0.2)",
  },

  // Meta Section
  metaSection: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionLabel: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 16,
    fontFamily: FONT_FAMILIES.MEDIUM,
    paddingHorizontal: 24,
  },
  nameInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.CARD_BG,
    paddingHorizontal: 24,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
  },
  nameInput: {
    flex: 1,
    color: COLORS.ACCENT_YELLOW,
    fontSize: 22,
    fontWeight: "900",
    paddingVertical: 20,
    paddingLeft: 16,
    letterSpacing: -1,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },

  // List
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 60,
  },

  // Add Button
  addBtn: {
    flexDirection: "row",
    backgroundColor: "#141416",
    borderWidth: 1.5,
    borderColor: COLORS.BORDER_LIGHT,
    borderStyle: "dashed",
    borderRadius: 24,
    paddingVertical: 24,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  addBtnText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
});
