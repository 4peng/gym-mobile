'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowUpDown, Check, ChevronRight, Play, Plus, Save, Trash2, X } from "lucide-react-native";

import { showAlert } from "@/utils/alerts";
import { COLORS, withAlpha } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import ExerciseEditor, { type ExerciseFormData } from "@/components/ExerciseEditor";
import ExerciseReorderModal from "@/components/Workout/ExerciseReorderModal";
import ExercisePickerModal from "@/components/ExercisePickerModal";
import {
  buildRoutineDraft,
  createEmptyExercise,
  createRoutineSnapshot,
  validateRoutineDraft,
} from "@/shared/programs.js";
import { generateId } from "@/utils/id";
import type { ExerciseDefinition } from "@/types";
import { inferTrackingModeFromExerciseDefinition } from "@/utils/exerciseTracking";

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

const SHEET_ANIMATION_DURATION = 180;

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
  const [reorderVisible, setReorderVisible] = useState(false);
  const [exercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);

  const optionsAnimation = useRef(new Animated.Value(0)).current;

  const isCreateLike = mode === "create" || mode === "duplicate";

  // Seed the form from props only once, on initial mount. `initialName`/
  // `initialExercises` are derived from the programs store and can change
  // identity mid-edit (e.g. a background sync merge) — re-running this on
  // every such change would clobber in-progress unsaved edits.
  const hasSeededRef = useRef(false);
  useEffect(() => {
    if (hasSeededRef.current) return;
    hasSeededRef.current = true;
    setName(initialName);
    setExercises(initialExercises);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialSnapshot = useMemo(
    () => createRoutineSnapshot(initialName, initialExercises),
    [initialExercises, initialName]
  );
  const currentSnapshot = useMemo(() => createRoutineSnapshot(name, exercises), [exercises, name]);
  const hasChanges = currentSnapshot !== initialSnapshot;

  const exerciseCount = exercises.length;
  const totalPlannedSets = useMemo(
    () => exercises.reduce((total, exercise) => total + (exercise.defaultSets?.length || 0), 0),
    [exercises]
  );

  const animateSheet = useCallback((toValue: number, onComplete?: () => void) => {
    Animated.timing(optionsAnimation, {
      toValue,
      duration: SHEET_ANIMATION_DURATION,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onComplete?.();
      }
    });
  }, [optionsAnimation]);

  const openOptions = useCallback(() => {
    setOptionsVisible(true);
    animateSheet(1);
  }, [animateSheet]);

  const closeOptions = useCallback(() => {
    animateSheet(0, () => setOptionsVisible(false));
  }, [animateSheet]);

  const handleUpdateExercise = useCallback(
    (id: string, updates: Partial<Omit<ExerciseFormData, "id">>) => {
      setExercises((prev) => prev.map((exercise) => (exercise.id === id ? { ...exercise, ...updates } : exercise)));
    },
    []
  );

  const handleRemoveExercise = useCallback((id: string) => {
    setExercises((prev) => prev.filter((exercise) => exercise.id !== id));
  }, []);

  const handleAddExerciseFromPicker = useCallback((definition: ExerciseDefinition) => {
    const nextExercise = createEmptyExercise(generateId) as ExerciseFormData;
    nextExercise.exerciseDefinitionId = definition.id;
    nextExercise.trackingMode = inferTrackingModeFromExerciseDefinition(definition);
    nextExercise.name = definition.name;
    nextExercise.muscles = definition.muscles;
    setExercises((prev) => [...prev, nextExercise]);
    setExercisePickerVisible(false);
  }, []);

  const reorderItems = useMemo(
    () => exercises.map((exercise) => ({ id: exercise.id, name: exercise.name })),
    [exercises]
  );

  const handleReorderSave = useCallback((exerciseIds: string[]) => {
    setExercises((prev) => {
      const byId = new Map(prev.map((exercise) => [exercise.id, exercise]));
      const reordered = exerciseIds
        .map((id) => byId.get(id))
        .filter((exercise): exercise is ExerciseFormData => !!exercise);

      return reordered.length === prev.length ? reordered : prev;
    });
  }, []);

  const validate = useCallback((): boolean => {
    const error = validateRoutineDraft(name, exercises);
    if (!error) {
      return true;
    }

    showAlert("Error", error);
    return false;
  }, [exercises, name]);

  const doSave = useCallback(() => {
    if (!validate()) return;
    onSave(buildRoutineDraft(name, exercises) as RoutineDraft);
  }, [exercises, name, onSave, validate]);

  const doSaveAndStart = useCallback(() => {
    if (!validate() || !onSaveAndStart) return;
    onSaveAndStart(buildRoutineDraft(name, exercises) as RoutineDraft);
  }, [exercises, name, onSaveAndStart, validate]);

  const doDelete = useCallback(() => {
    if (!onDelete) return;
    onDelete(buildRoutineDraft(name, exercises) as RoutineDraft);
  }, [exercises, name, onDelete]);

  const handlePrimaryAction = useCallback(() => {
    if (isCreateLike) {
      doSave();
      return;
    }

    openOptions();
  }, [doSave, isCreateLike, openOptions]);

  const handleCancel = useCallback(() => {
    onCancel(buildRoutineDraft(name, exercises) as RoutineDraft, hasChanges);
  }, [exercises, hasChanges, name, onCancel]);

  const optionsTranslateY = optionsAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 0],
  });

  const optionsOpacity = optionsAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.topBar}>
          <Pressable onPress={handleCancel} style={({ pressed }) => [UI.SHARED.dangerBtn, pressed && styles.hudPressed]}>
            <X size={20} color={COLORS.DANGER} strokeWidth={2.8} />
          </Pressable>

          <View style={styles.hudReadout}>
            <Text style={styles.hudReadoutTitle}>{isCreateLike ? "New Routine" : "Edit Routine"}</Text>
            <Text style={styles.hudReadoutMeta}>{hasChanges ? "Unsaved changes" : "All changes saved"}</Text>
          </View>

          <Pressable onPress={handlePrimaryAction} style={({ pressed }) => [UI.SHARED.actionBtn, pressed && styles.hudPressed]}>
            <Check size={20} color={COLORS.ACCENT_GREEN} strokeWidth={2.8} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerArea}>
            <View style={styles.titleRow}>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="Routine Name"
                placeholderTextColor={withAlpha(COLORS.TEXT_TERTIARY, 0.4)}
                autoFocus={isCreateLike}
              />
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryVal}>{exerciseCount}</Text>
                <Text style={styles.summaryLbl}>Exercises</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryVal}>{totalPlannedSets}</Text>
                <Text style={styles.summaryLbl}>Sets</Text>
              </View>
            </View>

            <View style={styles.actionGrid}>
              <Pressable
                onPress={() => setExercisePickerVisible(true)}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
              >
                <Plus size={18} color={COLORS.ACCENT_BLUE} />
                <Text style={styles.actionBtnText}>Add Exercise</Text>
              </Pressable>

              <Pressable
                onPress={() => setReorderVisible(true)}
                disabled={exercises.length < 2}
                style={({ pressed }) => [
                  styles.actionBtn,
                  exercises.length < 2 && styles.actionBtnDisabled,
                  pressed && exercises.length >= 2 && styles.pressed,
                ]}
              >
                <ArrowUpDown size={18} color={COLORS.TEXT_PRIMARY} />
                <Text style={[styles.actionBtnText, { color: COLORS.TEXT_PRIMARY }]}>Reorder</Text>
              </Pressable>
            </View>
          </View>
          {exercises.map((item, index) => (
            <View key={item.id} style={styles.exerciseWrap}>
              <ExerciseEditor
                exercise={item}
                index={index}
                onUpdate={handleUpdateExercise}
                onRemove={handleRemoveExercise}
              />
            </View>
          ))}

          {exercises.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No exercises yet</Text>
            </View>
          )}

          <View style={styles.listFooterSpacer} />
        </ScrollView>
      </SafeAreaView>

      {optionsVisible ? (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeOptions}>
            <Animated.View style={[styles.backdrop, { opacity: optionsOpacity }]} />
          </Pressable>

          <Animated.View
            style={[
              styles.optionsSheet,
              { opacity: optionsOpacity, transform: [{ translateY: optionsTranslateY }] },
            ]}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Routine Options</Text>
              <Pressable onPress={closeOptions}>
                <X size={20} color={COLORS.TEXT_TERTIARY} />
              </Pressable>
            </View>

            <OptionItem
              icon={<Save size={20} color={COLORS.ACCENT_BLUE} />}
              title="Save Changes"
              subtitle="Update template and return to list"
              onPress={() => { closeOptions(); doSave(); }}
            />

            {onSaveAndStart ? (
              <OptionItem
                icon={<Play size={20} color={COLORS.ACCENT_GREEN} fill={COLORS.ACCENT_GREEN} />}
                title="Save and Start"
                subtitle="Launch this routine immediately"
                onPress={() => { closeOptions(); doSaveAndStart(); }}
              />
            ) : null}

            {onDelete ? (
              <OptionItem
                icon={<Trash2 size={20} color={COLORS.DANGER} />}
                title="Delete Routine"
                subtitle="Permanently remove this program"
                danger
                onPress={() => { closeOptions(); doDelete(); }}
              />
            ) : null}
          </Animated.View>
        </>
      ) : null}

      <ExerciseReorderModal
        visible={reorderVisible}
        exercises={reorderItems}
        onClose={() => setReorderVisible(false)}
        onSave={handleReorderSave}
      />

      <ExercisePickerModal
        visible={exercisePickerVisible}
        onClose={() => setExercisePickerVisible(false)}
        onSelect={handleAddExerciseFromPicker}
        title="Add Exercise"
        subtitle="Search library or create custom"
      />
    </KeyboardAvoidingView>
  );
}

interface OptionItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  danger?: boolean;
}

function OptionItem({ icon, title, subtitle, onPress, danger }: OptionItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.optionItem, pressed && styles.pressed]}
    >
      <View style={[styles.optionIcon, danger && styles.optionIconDanger]}>
        {icon}
      </View>
      <View style={styles.optionCopy}>
        <Text style={[styles.optionTitle, danger && { color: COLORS.DANGER }]}>{title}</Text>
        <Text style={styles.optionSubtitle}>{subtitle}</Text>
      </View>
      <ChevronRight size={16} color={COLORS.TEXT_TERTIARY} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },
  safeArea: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 126,
  },
  headerArea: {
    paddingVertical: 24,
  },
  titleRow: {
    marginBottom: 16,
  },
  nameInput: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 28,
    fontFamily: FONT_FAMILIES.MEDIUM,
    fontWeight: "700",
    padding: 0,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: withAlpha(COLORS.CARD_BG, 0.5),
    padding: 12,
    borderRadius: UI.RADIUS_ITEM,
    borderWidth: 1,
    borderColor: withAlpha(COLORS.TEXT_PRIMARY, 0.05),
    marginBottom: 20,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryVal: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontFamily: FONT_FAMILIES.MONO,
    fontWeight: "700",
  },
  summaryLbl: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 11,
    fontFamily: FONT_FAMILIES.MEDIUM,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: withAlpha(COLORS.TEXT_PRIMARY, 0.1),
  },
  actionGrid: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    backgroundColor: withAlpha(COLORS.TEXT_PRIMARY, 0.05),
    borderRadius: UI.RADIUS_ITEM,
    borderWidth: 1,
    borderColor: withAlpha(COLORS.TEXT_PRIMARY, 0.08),
  },
  actionBtnDisabled: {
    opacity: 0.3,
  },
  actionBtnText: {
    color: COLORS.ACCENT_BLUE,
    fontSize: 14,
    fontFamily: FONT_FAMILIES.MEDIUM,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.6,
  },
  exerciseWrap: {
    marginBottom: 0,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: "center",
    borderWidth: 1,
    borderColor: withAlpha(COLORS.TEXT_PRIMARY, 0.05),
    borderStyle: "dashed",
    borderRadius: UI.RADIUS_ITEM,
  },
  emptyTitle: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 14,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  listFooterSpacer: {
    height: 40,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  optionsSheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 24,
    borderRadius: UI.RADIUS_HUD,
    backgroundColor: COLORS.CARD_BG,
    borderWidth: 1,
    borderColor: withAlpha(COLORS.TEXT_PRIMARY, 0.1),
    padding: 20,
    paddingBottom: 30,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontFamily: FONT_FAMILIES.MEDIUM,
    fontWeight: "700",
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 16,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: UI.RADIUS_ITEM,
    backgroundColor: withAlpha(COLORS.TEXT_PRIMARY, 0.05),
    justifyContent: "center",
    alignItems: "center",
  },
  optionIconDanger: {
    backgroundColor: withAlpha(COLORS.DANGER, 0.1),
  },
  optionCopy: {
    flex: 1,
  },
  optionTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontFamily: FONT_FAMILIES.MEDIUM,
    fontWeight: "600",
  },
  optionSubtitle: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 12,
    fontFamily: FONT_FAMILIES.MEDIUM,
    marginTop: 2,
  },
  hudPressed: {
    opacity: 0.8,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: withAlpha(COLORS.TEXT_PRIMARY, 0.08),
    backgroundColor: COLORS.BG,
  },
  hudReadout: {
    flex: 1,
    paddingHorizontal: 8,
  },
  hudReadoutTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontFamily: FONT_FAMILIES.MEDIUM,
    fontWeight: "700",
  },
  hudReadoutMeta: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 11,
    fontFamily: FONT_FAMILIES.MEDIUM,
    marginTop: 1,
  },
});
