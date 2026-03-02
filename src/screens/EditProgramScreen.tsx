'use client';

import React, { useCallback, useMemo, useState, useEffect } from "react";
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
  Modal,
} from "react-native";
import { X, Check, Plus, Layout, Play, Save, Trash2 } from "lucide-react-native";
import { useAppRouter, useAppParams } from "@/utils/navigation";
import { showAlert, showConfirm } from "@/utils/alerts";
import { useProgramStore } from "@/stores/programStore";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import ExerciseEditor, {
  type ExerciseFormData,
} from "@/components/ExerciseEditor";
import { generateId } from "@/utils/id";

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
    weightUnit: "kg",
  };
}

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
  const deleteProgram = useProgramStore((s) => s.deleteProgram);
  const activeSession = useWorkoutSessionStore((s) => s.activeSession);
  const startFromProgram = useWorkoutSessionStore((s) => s.startFromProgram);

  // Local state for full edit lifecycle
  const [localName, setLocalName] = useState("");
  const [localExercises, setLocalExercises] = useState<ExerciseFormData[]>([]);
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    if (program) {
      setLocalName(program.name || "");
      setLocalExercises((program.exercises || []).map(e => ({
        id: e.id,
        name: e.name || "",
        defaultSets: e.defaultSets || 3,
        restSeconds: e.restSeconds || 90,
        notes: e.notes || "",
        weightUnit: e.weightUnit || "kg",
      })));
    }
  }, [program?._id]);

  // ── Exercise callbacks ──

  const handleUpdateExercise = useCallback(
    (exId: string, updates: Partial<Omit<ExerciseFormData, "id">>) => {
      setLocalExercises((prev) =>
        prev.map((e) => (e.id === exId ? { ...e, ...updates } : e))
      );
    },
    []
  );

  const handleRemoveExercise = useCallback((exId: string) => {
    setLocalExercises((prev) => prev.filter((e) => e.id !== exId));
  }, []);

  const handleAddExercise = useCallback(() => {
    setLocalExercises((prev) => [...prev, createEmptyExercise()]);
  }, []);

  // ── Actions ──────────────────────────────────

  const validate = (): boolean => {
    if (!id) return false;
    const trimmedName = (localName || "").trim();
    if (trimmedName === "") {
      showAlert("Error", "Please enter a program name.");
      return false;
    }

    if (localExercises.length === 0) {
      showAlert("Error", "Add at least one exercise before saving.");
      return false;
    }

    const emptyNameIdx = localExercises.findIndex((e) => (e.name || "").trim() === "");
    if (emptyNameIdx !== -1) {
      showAlert("Error", `Exercise ${emptyNameIdx + 1} needs a name.`);
      return false;
    }
    return true;
  };

  const performUpdate = () => {
    if (!id || !program) return null;
    
    try {
      // Handle renames in history before updating template
      const renameExerciseInHistory = useWorkoutSessionStore.getState().renameExerciseInHistory;
      localExercises.forEach(newEx => {
        const oldEx = (program.exercises || []).find(e => e.id === newEx.id);
        if (oldEx && oldEx.name && newEx.name && oldEx.name.toLowerCase() !== newEx.name.toLowerCase()) {
          renameExerciseInHistory(oldEx.name, newEx.name);
        }
      });

      const updates: any = {
        name: (localName || "").trim(),
        exercises: localExercises.map(e => ({
          id: e.id,
          name: (e.name || "").trim(),
          defaultSets: e.defaultSets || 3,
          restSeconds: e.restSeconds || 90,
          notes: (e.notes || "").trim(),
          weightUnit: e.weightUnit || "kg",
        })),
      };
      updateProgram(id, updates);
      return { ...program, ...updates };
    } catch (err) {
      console.error("performUpdate failed:", err);
      throw err;
    }
  };

  const handleJustSave = () => {
    if (!validate()) return;
    try {
      performUpdate();
      setShowOptions(false);
      // Give UI a moment to settle before navigating back
      setTimeout(() => {
        router.back();
      }, 100);
    } catch (err) {
      showAlert("Error", "An unexpected error occurred while saving.");
    }
  };

  const handleSaveAndStart = () => {
    if (!validate()) return;
    try {
      const updatedProgram = performUpdate();
      setShowOptions(false);

      if (activeSession) {
        showConfirm(
          "Active Workout",
          "You already have a workout in progress. Discard it and start this one?",
          () => {
            if (updatedProgram) startFromProgram(updatedProgram as any);
            router.push("/workout");
          }
        );
      } else {
        if (updatedProgram) startFromProgram(updatedProgram as any);
        router.push("/workout");
      }
    } catch (err) {
      showAlert("Error", "An unexpected error occurred while saving.");
    }
  };

  const handleDeleteRoutine = useCallback(() => {
    if (!id) return;
    setShowOptions(false);
    showConfirm(
      "Delete Routine",
      `Are you sure you want to delete "${localName}"? This cannot be undone.`,
      () => {
        deleteProgram(id);
        router.push("/programs/");
      }
    );
  }, [id, localName, deleteProgram, router]);

  const handleCancel = useCallback(() => {
    showConfirm(
      "Discard Changes",
      "Are you sure you want to discard your edits?",
      () => router.back()
    );
  }, [router]);

  // ── Guard ────────────────────────────────────

  if (!program) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Not Found</Text>
        </View>
      </View>
    );
  }

  // ── Render ───────────────────────────────────

  const renderExercise = ({ item, index }: { item: ExerciseFormData; index: number }) => (
    <View style={{ paddingHorizontal: UI.LAYOUT_PADDING }}>
      <ExerciseEditor
        exercise={item}
        index={index}
        onUpdate={handleUpdateExercise}
        onRemove={handleRemoveExercise}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      {/* Header Area stays fixed at top */}
      <View style={styles.header}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerLabel}>Editor Mode</Text>
          <Text style={styles.headerTitle}>Edit Routine</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable 
            onPress={handleCancel} 
            style={({ pressed }) => [UI.SHARED.iconBtn, pressed && { opacity: 0.7 }]}
          >
            <X size={24} color={COLORS.DANGER} />
          </Pressable>
          <Pressable 
            onPress={() => setShowOptions(true)} 
            style={({ pressed }) => [UI.SHARED.actionBtn, pressed && { transform: [{scale: 0.96}] }]}
          >
            <Check size={24} color={COLORS.TEXT_PRIMARY} strokeWidth={3} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={localExercises}
        renderItem={renderExercise}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            {/* Routine Name Metadata */}
            <View style={styles.metaSection}>
              <Text style={UI.SHARED.sectionLabel}>Routine Name</Text>
              <View style={styles.nameInputContainer}>
                <Layout size={24} color={COLORS.TEXT_TERTIARY} />
                <TextInput
                  style={styles.nameInput}
                  value={localName}
                  onChangeText={setLocalName}
                  placeholder="Push Day"
                  placeholderTextColor={COLORS.TEXT_TERTIARY}
                />
              </View>
            </View>
            
            <Text style={[UI.SHARED.sectionLabel, { paddingHorizontal: UI.LAYOUT_PADDING }]}>Exercise Stack</Text>
          </View>
        }
        ListFooterComponent={
          <View style={{ paddingHorizontal: UI.LAYOUT_PADDING }}>
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
          </View>
        }
      />

      {/* Save Options Bottom Sheet */}
      <Modal
        visible={showOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOptions(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setShowOptions(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Save Changes</Text>
            
            <Pressable 
              style={({ pressed }) => [styles.optionBtn, pressed && { backgroundColor: '#1D1D21' }]} 
              onPress={handleJustSave}
            >
              <View style={[styles.optionIcon, { backgroundColor: 'rgba(11, 130, 255, 0.1)' }]}>
                <Save size={20} color={COLORS.ACCENT_BLUE} />
              </View>
              <View>
                <Text style={styles.optionLabel}>Just Save</Text>
                <Text style={styles.optionDesc}>Update routine and return home</Text>
              </View>
            </Pressable>

            <Pressable 
              style={({ pressed }) => [styles.optionBtn, pressed && { backgroundColor: '#1D1D21' }]} 
              onPress={handleSaveAndStart}
            >
              <View style={[styles.optionIcon, { backgroundColor: 'rgba(11, 130, 255, 0.1)' }]}>
                <Play size={20} color={COLORS.ACCENT_BLUE} fill={COLORS.ACCENT_BLUE} />
              </View>
              <View>
                <Text style={styles.optionLabel}>Save & Start Training</Text>
                <Text style={styles.optionDesc}>Update and launch live session</Text>
              </View>
            </Pressable>

            <View style={styles.modalDivider} />

            <Pressable 
              style={({ pressed }) => [styles.optionBtn, pressed && { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]} 
              onPress={handleDeleteRoutine}
            >
              <View style={[styles.optionIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <Trash2 size={20} color={COLORS.DANGER} />
              </View>
              <View>
                <Text style={[styles.optionLabel, { color: COLORS.DANGER }]}>Delete Routine</Text>
                <Text style={styles.optionDesc}>Permanently remove this program</Text>
              </View>
            </Pressable>

            <Pressable 
              style={styles.modalCancelBtn} 
              onPress={() => setShowOptions(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },
  header: {
    paddingHorizontal: UI.LAYOUT_PADDING,
    paddingTop: UI.HEADER_TOP,
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
    gap: UI.GAP,
  },
  metaSection: {
    paddingHorizontal: UI.LAYOUT_PADDING,
    marginBottom: 32,
  },
  nameInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.CARD_BG,
    paddingHorizontal: 24,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
    height: 80,
  },
  nameInput: {
    flex: 1,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 24,
    fontWeight: "900",
    marginLeft: 16,
    padding: 0,
    letterSpacing: -1,
    fontFamily: FONT_FAMILIES.MEDIUM,
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: 32,
  },
  listContent: {
    paddingBottom: 60,
  },
  addBtn: {
    flexDirection: "row",
    backgroundColor: "#141416",
    borderWidth: 1.5,
    borderColor: "rgba(11, 130, 255, 0.2)",
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.CARD_BG,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 32,
  },
  modalTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 24,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLabel: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  optionDesc: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  modalCancelBtn: {
    marginTop: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalCancelText: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 15,
    fontWeight: '700',
  },
  modalDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 12,
  }
});
