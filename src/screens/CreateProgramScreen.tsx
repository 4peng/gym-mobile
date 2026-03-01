'use client';

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { X, Check, Plus, Layout } from "lucide-react-native";
import { useAppRouter } from "@/utils/navigation";
import { showAlert, showConfirm } from "@/utils/alerts";
import { useProgramStore } from "@/stores/programStore";
import { generateId } from "@/utils/id";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import ExerciseEditor, {
  type ExerciseFormData,
} from "@/components/ExerciseEditor";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function createEmptyExercise(): ExerciseFormData {
  return {
    id: generateId(),
    name: "",
    defaultSets: 3,
    restSeconds: 90,
    notes: "",
  };
}

// ──────────────────────────────────────────────
// CreateProgramScreen
// ──────────────────────────────────────────────

export default function CreateProgramScreen() {
  const addProgramWithExercises = useProgramStore(
    (s) => s.addProgramWithExercises
  );
  const router = useAppRouter();

  const [programName, setProgramName] = useState("");
  const [exercises, setExercises] = useState<ExerciseFormData[]>([]);

  // ── Exercise callbacks (stable references) ──

  const handleUpdateExercise = useCallback(
    (id: string, updates: Partial<Omit<ExerciseFormData, "id">>) => {
      setExercises((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
      );
    },
    []
  );

  const handleRemoveExercise = useCallback((id: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleAddExercise = useCallback(() => {
    setExercises((prev) => [...prev, createEmptyExercise()]);
  }, []);

  // ── Save ─────────────────────────────────────

  const handleSave = useCallback(() => {
    const trimmedName = programName.trim();
    if (trimmedName === "") {
      showAlert("Error", "Please enter a program name.");
      return;
    }

    // Validate: at least one exercise
    if (exercises.length === 0) {
      showAlert("Error", "Add at least one exercise before saving.");
      return;
    }

    // Validate: all exercises have names
    const emptyNameIdx = exercises.findIndex((e) => e.name.trim() === "");
    if (emptyNameIdx !== -1) {
      showAlert("Error", `Exercise ${emptyNameIdx + 1} needs a name.`);
      return;
    }

    addProgramWithExercises(
      trimmedName,
      exercises.map((e) => ({
        name: e.name.trim(),
        defaultSets: e.defaultSets,
        restSeconds: e.restSeconds,
        notes: e.notes.trim(),
      }))
    );

    router.back();
  }, [programName, exercises, addProgramWithExercises, router]);

  const handleCancel = useCallback(() => {
    if (programName.trim() !== "" || exercises.length > 0) {
      showConfirm(
        "Discard Changes",
        "Your unsaved changes will be lost. Discard?",
        () => router.back()
      );
    } else {
      router.back();
    }
  }, [programName, exercises, router]);

  // ── Render ───────────────────────────────────

  const renderExercise = useCallback(
    ({ item, index }: { item: ExerciseFormData; index: number }) => (
      <ExerciseEditor
        exercise={item}
        index={index}
        onUpdate={handleUpdateExercise}
        onRemove={handleRemoveExercise}
      />
    ),
    [handleUpdateExercise, handleRemoveExercise]
  );

  const keyExtractor = useCallback((item: ExerciseFormData) => item.id, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Dynamic Header Area */}
      <View style={styles.header}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerLabel}>Setup Mode</Text>
          <Text style={styles.headerTitle}>New Routine</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable 
            onPress={handleCancel} 
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
          >
            <X size={24} color={COLORS.TEXT_SECONDARY} />
          </Pressable>
          <Pressable 
            onPress={handleSave} 
            style={({ pressed }) => [styles.saveBtn, pressed && { transform: [{scale: 0.96}] }]}
          >
            <Check size={24} color={COLORS.TEXT_PRIMARY} strokeWidth={3} />
          </Pressable>
        </View>
      </View>

      {/* Program Metadata */}
      <View style={styles.metaSection}>
        <Text style={styles.sectionLabel}>Identification</Text>
        <View style={styles.nameInputContainer}>
          <Layout size={20} color={COLORS.TEXT_TERTIARY} />
          <TextInput
            style={styles.nameInput}
            value={programName}
            onChangeText={setProgramName}
            placeholder="Routine name"
            placeholderTextColor={COLORS.TEXT_TERTIARY}
            autoFocus
          />
        </View>
      </View>

      {/* Exercises Section */}
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionLabel}>Exercise Stack</Text>
        <FlatList
          data={exercises}
          renderItem={renderExercise}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Plus size={32} color={COLORS.BORDER_LIGHT} />
              </View>
              <Text style={styles.emptyText}>Empty Routine</Text>
              <Text style={styles.emptySubtext}>
                No exercises added.
              </Text>
            </View>
          }
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
  },
  headerTitleGroup: {
    flex: 1,
  },
  headerLabel: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2,
    fontFamily: FONT_FAMILIES.MEDIUM,
    marginBottom: 4,
  },
  headerTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1.5,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  headerActions: {
    flexDirection: "row",
    gap: 12,
  },
  iconBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#1D1D21",
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.ACCENT_BLUE,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.ACCENT_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
    fontSize: 24,
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

  // Empty state
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#141416",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    marginBottom: 20,
  },
  emptyText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  emptySubtext: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 15,
    textAlign: "center",
    fontFamily: FONT_FAMILIES.MEDIUM,
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
