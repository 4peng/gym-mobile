'use client';

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { X, Check, Plus, Layout, Play, Save, Trash2 } from "lucide-react-native";
import { showAlert } from "@/utils/alerts";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import ExerciseEditor, { type ExerciseFormData } from "@/components/ExerciseEditor";
import { generateId } from "@/utils/id";

type Mode = "create" | "edit" | "duplicate";

export interface RoutineDraft {
  name: string;
  exercises: ExerciseFormData[];
}

interface RoutineEditorScreenProps {
  mode: Mode;
  initialName?: string;
  initialExercises?: ExerciseFormData[];
  onCancel: (draft: RoutineDraft, hasChanges: boolean) => void;
  onSave: (draft: RoutineDraft) => void;
  onSaveAndStart?: (draft: RoutineDraft) => void;
  onDelete?: (draft: RoutineDraft) => void;
}

function createEmptyExercise(): ExerciseFormData {
  return {
    id: generateId(),
    name: "",
    defaultSets: 3,
    restSeconds: 90,
    notes: "",
    weightUnit: "kg",
    muscles: [],
  };
}

function normalizeDraftSnapshot(name: string, exercises: ExerciseFormData[]): string {
  return JSON.stringify({
    name: name.trim(),
    exercises: exercises.map((e) => ({
      id: e.id,
      name: (e.name || "").trim(),
      defaultSets: e.defaultSets || 3,
      restSeconds: e.restSeconds || 90,
      notes: (e.notes || "").trim(),
      weightUnit: e.weightUnit || "kg",
      muscles: e.muscles || [],
    })),
  });
}

function buildDraft(name: string, exercises: ExerciseFormData[]): RoutineDraft {
  return {
    name: name.trim(),
    exercises: exercises.map((e) => ({
      ...e,
      name: (e.name || "").trim(),
      defaultSets: e.defaultSets || 3,
      restSeconds: e.restSeconds || 90,
      notes: (e.notes || "").trim(),
      weightUnit: e.weightUnit || "kg",
      muscles: e.muscles || [],
    })),
  };
}

export default function RoutineEditorScreen({
  mode,
  initialName = "",
  initialExercises = [],
  onCancel,
  onSave,
  onSaveAndStart,
  onDelete,
}: RoutineEditorScreenProps) {
  const [name, setName] = useState(initialName);
  const [exercises, setExercises] = useState<ExerciseFormData[]>(initialExercises);
  const [showOptions, setShowOptions] = useState(false);

  const isCreateLike = mode === "create" || mode === "duplicate";

  useEffect(() => {
    setName(initialName);
    setExercises(initialExercises);
  }, [initialName, initialExercises]);

  const initialSnapshot = useMemo(
    () => normalizeDraftSnapshot(initialName, initialExercises),
    [initialName, initialExercises]
  );
  const currentSnapshot = useMemo(
    () => normalizeDraftSnapshot(name, exercises),
    [name, exercises]
  );
  const hasChanges = currentSnapshot !== initialSnapshot;

  const handleUpdateExercise = useCallback(
    (id: string, updates: Partial<Omit<ExerciseFormData, "id">>) => {
      setExercises((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
    },
    []
  );

  const handleRemoveExercise = useCallback((id: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleAddExercise = useCallback(() => {
    setExercises((prev) => [...prev, createEmptyExercise()]);
  }, []);

  const validate = useCallback((): boolean => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showAlert("Error", "Please enter a program name.");
      return false;
    }
    if (exercises.length === 0) {
      showAlert("Error", "Add at least one exercise before saving.");
      return false;
    }
    const emptyNameIdx = exercises.findIndex((e) => (e.name || "").trim() === "");
    if (emptyNameIdx !== -1) {
      showAlert("Error", `Exercise ${emptyNameIdx + 1} needs a name.`);
      return false;
    }
    return true;
  }, [name, exercises]);

  const doSave = useCallback(() => {
    if (!validate()) return;
    onSave(buildDraft(name, exercises));
  }, [validate, onSave, name, exercises]);

  const doSaveAndStart = useCallback(() => {
    if (!validate() || !onSaveAndStart) return;
    onSaveAndStart(buildDraft(name, exercises));
  }, [validate, onSaveAndStart, name, exercises]);

  const doDelete = useCallback(() => {
    if (!onDelete) return;
    onDelete(buildDraft(name, exercises));
  }, [onDelete, name, exercises]);

  const handlePrimaryAction = useCallback(() => {
    if (isCreateLike) {
      doSave();
      return;
    }
    setShowOptions(true);
  }, [isCreateLike, doSave]);

  const handleCancel = useCallback(() => {
    onCancel(buildDraft(name, exercises), hasChanges);
  }, [onCancel, name, exercises, hasChanges]);

  const renderExercise = useCallback(
    ({ item, index }: { item: ExerciseFormData; index: number }) => (
      <View style={{ paddingHorizontal: UI.LAYOUT_PADDING }}>
        <ExerciseEditor
          exercise={item}
          index={index}
          onUpdate={handleUpdateExercise}
          onRemove={handleRemoveExercise}
        />
      </View>
    ),
    [handleUpdateExercise, handleRemoveExercise]
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <FlatList
        data={exercises}
        renderItem={renderExercise}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={styles.headerTitleGroup}>
                <Text style={styles.headerLabel}>
                  {mode === "edit" ? "Editor Mode" : "Setup Mode"}
                </Text>
                <Text style={styles.headerTitle}>
                  {mode === "edit"
                    ? "Edit Routine"
                    : mode === "duplicate"
                      ? "Duplicate Routine"
                      : "New Routine"}
                </Text>
              </View>
              <View style={styles.headerActions}>
                <Pressable
                  onPress={handleCancel}
                  style={({ pressed }) => [UI.SHARED.iconBtn, pressed && { opacity: 0.7 }]}
                >
                  <X size={24} color={COLORS.DANGER} />
                </Pressable>
                <Pressable
                  onPress={handlePrimaryAction}
                  style={({ pressed }) => [UI.SHARED.actionBtn, pressed && { transform: [{ scale: 0.96 }] }]}
                >
                  <Check size={24} color={COLORS.TEXT_PRIMARY} strokeWidth={3} />
                </Pressable>
              </View>
            </View>

            <View style={styles.metaSection}>
              <Text style={UI.SHARED.sectionLabel}>Routine Name</Text>
              <View style={styles.nameInputContainer}>
                <Layout size={24} color={COLORS.TEXT_TERTIARY} />
                <TextInput
                  style={styles.nameInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Push Day"
                  placeholderTextColor={COLORS.TEXT_TERTIARY}
                  autoFocus={isCreateLike}
                />
              </View>
            </View>

            <Text style={[UI.SHARED.sectionLabel, { paddingHorizontal: UI.LAYOUT_PADDING }]}>
              Exercise Stack
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={{ paddingHorizontal: UI.LAYOUT_PADDING }}>
            <Pressable
              onPress={handleAddExercise}
              style={({ pressed }) => [styles.emptyContainer, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.emptyIconCircle}>
                <Plus size={32} color={COLORS.ACCENT_BLUE} strokeWidth={2.5} />
              </View>
              <Text style={styles.emptyText}>Empty Routine</Text>
              <Text style={styles.emptySubtext}>Tap here to add your first exercise</Text>
            </Pressable>
          </View>
        }
        ListFooterComponent={
          exercises.length > 0 ? (
            <View style={{ paddingHorizontal: UI.LAYOUT_PADDING }}>
              <Pressable
                onPress={handleAddExercise}
                style={({ pressed }) => [
                  styles.addBtn,
                  pressed && { backgroundColor: "#1D1D21", transform: [{ scale: 0.99 }] },
                ]}
              >
                <Plus size={20} color={COLORS.ACCENT_BLUE} strokeWidth={3} />
                <Text style={styles.addBtnText}>Add Exercise</Text>
              </Pressable>
            </View>
          ) : null
        }
      />

      {mode === "edit" && (onSaveAndStart || onDelete) ? (
        <Modal
          visible={showOptions}
          transparent
          animationType="fade"
          onRequestClose={() => setShowOptions(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowOptions(false)}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Save Changes</Text>

              <Pressable
                style={({ pressed }) => [styles.optionBtn, pressed && { backgroundColor: "#1D1D21" }]}
                onPress={() => {
                  setShowOptions(false);
                  doSave();
                }}
              >
                <View style={[styles.optionIcon, { backgroundColor: "rgba(11, 130, 255, 0.1)" }]}>
                  <Save size={20} color={COLORS.ACCENT_BLUE} />
                </View>
                <View>
                  <Text style={styles.optionLabel}>Just Save</Text>
                  <Text style={styles.optionDesc}>Update routine and return home</Text>
                </View>
              </Pressable>

              {onSaveAndStart ? (
                <Pressable
                  style={({ pressed }) => [styles.optionBtn, pressed && { backgroundColor: "#1D1D21" }]}
                  onPress={() => {
                    setShowOptions(false);
                    doSaveAndStart();
                  }}
                >
                  <View style={[styles.optionIcon, { backgroundColor: "rgba(11, 130, 255, 0.1)" }]}>
                    <Play size={20} color={COLORS.ACCENT_BLUE} fill={COLORS.ACCENT_BLUE} />
                  </View>
                  <View>
                    <Text style={styles.optionLabel}>Save & Start Training</Text>
                    <Text style={styles.optionDesc}>Update and launch live session</Text>
                  </View>
                </Pressable>
              ) : null}

              {onDelete ? (
                <>
                  <View style={styles.modalDivider} />
                  <Pressable
                    style={({ pressed }) => [
                      styles.optionBtn,
                      pressed && { backgroundColor: "rgba(239, 68, 68, 0.1)" },
                    ]}
                    onPress={() => {
                      setShowOptions(false);
                      doDelete();
                    }}
                  >
                    <View style={[styles.optionIcon, { backgroundColor: "rgba(239, 68, 68, 0.1)" }]}>
                      <Trash2 size={20} color={COLORS.DANGER} />
                    </View>
                    <View>
                      <Text style={[styles.optionLabel, { color: COLORS.DANGER }]}>Delete Routine</Text>
                      <Text style={styles.optionDesc}>Permanently remove this program</Text>
                    </View>
                  </Pressable>
                </>
              ) : null}

              <Pressable style={styles.modalCancelBtn} onPress={() => setShowOptions(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      ) : null}
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
    textAlignVertical: "center",
    lineHeight: 32,
  },
  listContent: {
    paddingBottom: 120,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 32,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.BORDER_LIGHT,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(11, 130, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 2,
    borderColor: COLORS.ACCENT_BLUE,
    borderStyle: "solid",
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
  addBtn: {
    flexDirection: "row",
    backgroundColor: "rgba(11, 130, 255, 0.05)",
    borderWidth: 1,
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
    color: COLORS.ACCENT_BLUE,
    fontSize: 16,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.CARD_BG,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 32,
  },
  modalTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 24,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  optionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    gap: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  optionLabel: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  optionDesc: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  modalCancelBtn: {
    marginTop: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  modalCancelText: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 15,
    fontWeight: "700",
  },
  modalDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginVertical: 12,
  },
});
