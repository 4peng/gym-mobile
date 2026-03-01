'use client';

import React, { useCallback, useMemo, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  InteractionManager,
  Platform,
  LayoutAnimation,
  KeyboardAvoidingView,
} from "react-native";
import { 
  X, 
  Check, 
  Plus, 
  Trash2, 
  Clock, 
  StickyNote, 
  ChevronRight,
  Dumbbell,
  CheckCircle2,
  Zap,
  Type
} from "lucide-react-native";
import { useAppRouter } from "@/utils/navigation";
import { showAlert, showConfirm } from "@/utils/alerts";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import { toTitleCase } from "@/utils/string";
import type { WorkoutExercise, WorkoutSet } from "@/types";
import {
  resolveExercisePlaceholders,
  resolveSetOnComplete,
  type SetPlaceholder,
} from "@/utils/placeholders";
import {
  configureNotificationHandler,
  requestNotificationPermissions,
} from "@/utils/notifications";
import FloatingRestTimer from "@/components/FloatingRestTimer";
import LiveWorkoutTimer from "@/components/LiveWorkoutTimer";
import { formatSecondsToMMSS, parseMMSSToSeconds } from "@/utils/conversions";
import RestTimerPicker from "@/components/RestTimerPicker";

// ──────────────────────────────────────────────
// SetRow (memoized)
// ──────────────────────────────────────────────

interface SetRowProps {
  set: WorkoutSet;
  index: number;
  placeholder: SetPlaceholder;
  exerciseId: string;
  exerciseName: string;
  restSeconds: number;
  weightUnit: "kg" | "lbs";
}

const SetRow = React.memo<SetRowProps>(function SetRow({
  set,
  index,
  placeholder,
  exerciseId,
  exerciseName,
  restSeconds,
  weightUnit,
}) {
  const updateSet = useWorkoutSessionStore((s) => s.updateSet);
  const toggleSetCompletion = useWorkoutSessionStore((s) => s.toggleSetCompletion);
  const removeSet = useWorkoutSessionStore((s) => s.removeSet);
  const startRestTimer = useWorkoutSessionStore((s) => s.startRestTimer);

  const isCompleted = !!set.completedAt;

  const handleWeightChange = useCallback(
    (text: string) => {
      const val = text === "" ? null : parseFloat(text);
      if (val !== null && isNaN(val)) return;
      updateSet(exerciseId, set.id, "weight", val);
    },
    [exerciseId, set.id, updateSet]
  );

  const handleRepsChange = useCallback(
    (text: string) => {
      const val = text === "" ? null : parseInt(text, 10);
      if (val !== null && isNaN(val)) return;
      updateSet(exerciseId, set.id, "reps", val);
    },
    [exerciseId, set.id, updateSet]
  );

  const handleToggleComplete = useCallback(() => {
    if (!isCompleted) {
      const resolved = resolveSetOnComplete(set, placeholder);
      if (set.weight === null) updateSet(exerciseId, set.id, "weight", resolved.weight);
      if (set.reps === null) updateSet(exerciseId, set.id, "reps", resolved.reps);
      
      if (restSeconds > 0) {
        startRestTimer(exerciseId, restSeconds, toTitleCase(exerciseName));
      }
    }
    
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    toggleSetCompletion(exerciseId, set.id);
  }, [set, isCompleted, placeholder, exerciseId, updateSet, toggleSetCompletion, restSeconds, exerciseName, startRestTimer]);

  const handleRemove = useCallback(() => {
    removeSet(exerciseId, set.id);
  }, [exerciseId, set.id, removeSet]);

  return (
    <View style={[styles.setRow, isCompleted && styles.setRowCompleted]}>
      {/* Index Column (15%) */}
      <View style={styles.indexCol}>
        <View style={[styles.setIndexContainer, isCompleted ? { backgroundColor: "rgba(16, 217, 75, 0.1)" } : { backgroundColor: "rgba(250, 204, 0, 0.1)" }]}>
          <Text style={[styles.setIndex, isCompleted ? { color: COLORS.ACCENT_GREEN } : { color: COLORS.ACCENT_YELLOW }]}>{index + 1}</Text>
        </View>
      </View>

      {/* Weight Column (30%) */}
      <View style={styles.weightCol}>
        <View style={[styles.setInputGroup, isCompleted ? { borderColor: "rgba(16, 217, 75, 0.2)" } : { borderColor: "rgba(250, 204, 0, 0.2)" }]}>
          <TextInput
            style={[UI.SHARED.numericInput, isCompleted ? { color: COLORS.ACCENT_GREEN } : { color: COLORS.ACCENT_YELLOW }]}
            keyboardType="decimal-pad"
            value={set.weight !== null ? String(set.weight) : ""}
            placeholder={placeholder.weight !== null ? String(placeholder.weight) : "—"}
            placeholderTextColor={COLORS.TEXT_TERTIARY}
            onChangeText={handleWeightChange}
            editable={!isCompleted}
          />
        </View>
      </View>

      {/* Reps Column (30%) */}
      <View style={styles.repsCol}>
        <View style={[styles.setInputGroup, isCompleted ? { borderColor: "rgba(16, 217, 75, 0.2)" } : { borderColor: "rgba(250, 204, 0, 0.2)" }]}>
          <TextInput
            style={[UI.SHARED.numericInput, isCompleted ? { color: COLORS.ACCENT_GREEN } : { color: COLORS.ACCENT_YELLOW }]}
            keyboardType="number-pad"
            value={set.reps !== null ? String(set.reps) : ""}
            placeholder={placeholder.reps !== null ? String(placeholder.reps) : "—"}
            placeholderTextColor={COLORS.TEXT_TERTIARY}
            onChangeText={handleRepsChange}
            editable={!isCompleted}
          />
        </View>
      </View>

      {/* Action Column (25%) */}
      <View style={styles.actionCol}>
        <Pressable 
          onPress={handleToggleComplete} 
          style={({ pressed }) => [
            isCompleted ? styles.checkMarkCircle : styles.completeBtn,
            pressed && { transform: [{scale: 0.92}], opacity: 0.8 }
          ]}
        >
          {isCompleted ? (
            <Check size={14} color={COLORS.BG} strokeWidth={4} />
          ) : (
            <Check size={18} color={COLORS.ACCENT_GREEN} strokeWidth={3} />
          )}
        </Pressable>

        {!isCompleted && (
          <Pressable onPress={handleRemove} hitSlop={12} style={styles.removeSetBtn}>
            <X size={16} color={COLORS.DANGER} strokeWidth={3} />
          </Pressable>
        )}
      </View>
    </View>
  );
});

// ──────────────────────────────────────────────
// ExerciseCard (memoized)
// ──────────────────────────────────────────────

interface ExerciseCardProps {
  exercise: WorkoutExercise;
}

const ExerciseCard = React.memo<ExerciseCardProps>(function ExerciseCard({
  exercise,
}) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const addSet = useWorkoutSessionStore((s) => s.addSet);
  const removeExercise = useWorkoutSessionStore((s) => s.removeExercise);
  const updateExerciseField = useWorkoutSessionStore((s) => s.updateExerciseField);
  const toggleExerciseUnit = useWorkoutSessionStore((s) => s.toggleExerciseUnit);
  const history = useWorkoutSessionStore((s) => s.history);

  const handleRestSave = useCallback((seconds: number) => {
    updateExerciseField(exercise.id, "restSeconds", seconds);
  }, [exercise.id, updateExerciseField]);

  const handleNameChange = useCallback((text: string) => {
    updateExerciseField(exercise.id, "name", text);
  }, [exercise.id, updateExerciseField]);

  const placeholders = useMemo(
    () =>
      resolveExercisePlaceholders(exercise.name, exercise.sets, history),
    [exercise.name, exercise.sets, history]
  );

  const handleAddSet = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    addSet(exercise.id);
  }, [exercise.id, addSet]);

  const handleRemoveExercise = useCallback(() => {
    showConfirm(
      "Remove Exercise",
      `Remove "${exercise.name}"?`,
      () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        removeExercise(exercise.id);
      }
    );
  }, [exercise.id, exercise.name, removeExercise]);

  return (
    <View style={UI.SHARED.card}>
      <View style={styles.cardHeader}>
        <View style={styles.exerciseInfo}>
          <TextInput
            style={styles.exerciseNameInput}
            value={toTitleCase(exercise.name)}
            onChangeText={handleNameChange}
            placeholder="Exercise name"
            placeholderTextColor={COLORS.TEXT_TERTIARY}
            multiline={false}
          />
          <View style={styles.exerciseMetaRow}>
            <Pressable 
              style={({ pressed }) => [styles.unitPill, pressed && { opacity: 0.7 }]}
              onPress={() => toggleExerciseUnit(exercise.id)}
            >
              <Dumbbell size={10} color={COLORS.ACCENT_YELLOW} />
              <Text style={styles.unitPillText}>{exercise.weightUnit || "kg"}</Text>
            </Pressable>
            <Pressable 
              style={({ pressed }) => [styles.restPill, pressed && { opacity: 0.7 }]}
              onPress={() => setPickerVisible(true)}
            >
              <Clock size={10} color={COLORS.ACCENT_YELLOW} />
              <Text style={styles.restPillText}>{formatSecondsToMMSS(exercise.restSeconds)}</Text>
            </Pressable>
          </View>
        </View>
        <Pressable onPress={handleRemoveExercise} hitSlop={12} style={styles.cardRemoveBtn}>
          <Trash2 size={18} color={COLORS.DANGER} />
        </Pressable>
      </View>

      {exercise.notes !== "" && (
        <View style={styles.notesContainer}>
          <StickyNote size={12} color={COLORS.ACCENT_BLUE} style={{marginTop: 2}} />
          <Text style={styles.notesText}>{exercise.notes}</Text>
        </View>
      )}

      <View style={styles.setHeader}>
        <Text style={[styles.setHeaderText, { width: '15%', textAlign: 'center' }]}>Set</Text>
        <Text style={[styles.setHeaderText, { width: '30%', textAlign: 'center' }]}>Weight</Text>
        <Text style={[styles.setHeaderText, { width: '30%', textAlign: 'center' }]}>Reps</Text>
        <View style={{ width: '25%' }} />
      </View>

      {exercise.sets.map((s, i) => (
        <SetRow
          key={s.id}
          set={s}
          index={i}
          placeholder={placeholders[i] ?? { weight: null, reps: null }}
          exerciseId={exercise.id}
          exerciseName={exercise.name}
          restSeconds={exercise.restSeconds}
          weightUnit={exercise.weightUnit || "kg"}
        />
      ))}

      <Pressable 
        onPress={handleAddSet} 
        style={({ pressed }) => [
          styles.addSetBtn,
          pressed && { backgroundColor: "rgba(255,255,255,0.03)" }
        ]}
      >
        <Plus size={16} color={COLORS.ACCENT_BLUE} strokeWidth={3} />
        <Text style={styles.addSetBtnText}>Add Set</Text>
      </Pressable>

      <RestTimerPicker 
        visible={pickerVisible}
        initialSeconds={exercise.restSeconds}
        onClose={() => setPickerVisible(false)}
        onSave={handleRestSave}
      />
    </View>
  );
});

// ──────────────────────────────────────────────
// WorkoutSessionScreen
// ──────────────────────────────────────────────

const SUGGESTED_EXERCISES = [
  "Bench Press",
  "Squat",
  "Deadlift",
  "Overhead Press",
  "Pull Ups",
  "Barbell Row",
  "Dumbbell Curls",
  "Lateral Raises",
];

export default function WorkoutSessionScreen() {
  const activeSession = useWorkoutSessionStore((s) => s.activeSession);
  const addExercise = useWorkoutSessionStore((s) => s.addExercise);
  const completeSession = useWorkoutSessionStore((s) => s.completeSession);
  const discardSession = useWorkoutSessionStore((s) => s.discardSession);
  const clearExpiredTimer = useWorkoutSessionStore((s) => s.clearExpiredTimer);

  const router = useAppRouter();
  const [newExerciseName, setNewExerciseName] = React.useState("");

  const placeholderIndex = (activeSession?.exercises.length ?? 0) % SUGGESTED_EXERCISES.length;
  const currentPlaceholder = SUGGESTED_EXERCISES[placeholderIndex];

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      configureNotificationHandler();
      requestNotificationPermissions();
    });
    
    clearExpiredTimer();
    
    return () => task.cancel();
  }, [clearExpiredTimer]);

  const handleAddExercise = useCallback(() => {
    const trimmed = newExerciseName.trim();
    const finalName = trimmed === "" ? currentPlaceholder : trimmed;
    
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    addExercise(finalName);
    setNewExerciseName("");
  }, [newExerciseName, addExercise, currentPlaceholder]);

  const handleFinish = useCallback(() => {
    showConfirm(
      "Finish Workout",
      "Complete this workout session?",
      () => {
        completeSession();
        setTimeout(() => {
          router.replace("/programs/");
        }, 100);
      }
    );
  }, [completeSession, router]);

  const handleDiscard = useCallback(() => {
    showConfirm(
      "Discard Workout",
      "Are you sure? This cannot be undone.",
      () => {
        discardSession();
        setTimeout(() => {
          router.replace("/programs/");
        }, 100);
      }
    );
  }, [discardSession, router]);

  if (!activeSession) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Dumbbell size={48} color={COLORS.BORDER_LIGHT} strokeWidth={1} />
          <Text style={styles.emptyText}>No active session</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTitleGroup}>
            <View style={styles.timerRow}>
              <LiveWorkoutTimer startedAt={activeSession.startedAt} />
            </View>
            <Text style={styles.headerTitle}>Live Training</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable 
              onPress={handleDiscard} 
              style={({ pressed }) => [UI.SHARED.iconBtn, pressed && { opacity: 0.7 }]}
            >
              <X size={24} color={COLORS.DANGER} />
            </Pressable>
            <Pressable 
              onPress={handleFinish} 
              style={({ pressed }) => [UI.SHARED.actionBtn, pressed && { transform: [{scale: 0.96}] }]}
            >
              <Check size={24} color={COLORS.TEXT_PRIMARY} strokeWidth={3} />
            </Pressable>
          </View>
        </View>

        <FlatList
          data={activeSession.exercises}
          renderItem={({ item }) => <ExerciseCard exercise={item} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            <View style={styles.addExerciseSection}>
              <Text style={UI.SHARED.sectionLabel}>Next Exercise</Text>
              <View style={styles.addExerciseCard}>
                <View style={styles.addExerciseInputContainer}>
                  <TextInput
                    style={styles.addExerciseInput}
                    placeholder={currentPlaceholder}
                    placeholderTextColor={COLORS.TEXT_TERTIARY}
                    value={newExerciseName}
                    onChangeText={setNewExerciseName}
                    onSubmitEditing={handleAddExercise}
                    returnKeyType="done"
                  />
                </View>
                <Pressable 
                  onPress={handleAddExercise} 
                  style={({ pressed }) => [
                    styles.addExerciseBtn,
                    pressed && { transform: [{scale: 0.96}], opacity: 0.9 }
                  ]}
                >
                  <Plus size={24} color={COLORS.TEXT_PRIMARY} strokeWidth={3} />
                </Pressable>
              </View>
            </View>
          }
        />

        <FloatingRestTimer />
      </View>
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
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  listContent: {
    paddingHorizontal: UI.LAYOUT_PADDING,
    paddingBottom: 160,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseNameInput: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.8,
    fontFamily: FONT_FAMILIES.MEDIUM,
    marginBottom: 8,
    padding: 0,
  },
  exerciseMetaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  unitPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1D1D21",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 6,
    marginRight: 8,
  },
  unitPillText: {
    color: COLORS.ACCENT_YELLOW,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  restPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1D1D21",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 6,
  },
  restPillText: {
    color: COLORS.ACCENT_YELLOW,
    fontSize: 12,
    fontWeight: "900",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  cardRemoveBtn: {
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 12,
  },
  notesContainer: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(11, 130, 255, 0.05)",
    padding: 14,
    borderRadius: 16,
    marginBottom: 24,
  },
  notesText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT_FAMILIES.MEDIUM,
    flex: 1,
  },
  setHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
    marginBottom: 12,
  },
  setHeaderText: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  indexCol: { width: '15%', alignItems: 'center' },
  weightCol: { width: '30%', alignItems: 'center', paddingHorizontal: 4 },
  repsCol: { width: '30%', alignItems: 'center', paddingHorizontal: 4 },
  actionCol: { width: '25%', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  setRowCompleted: {
  },
  setIndexContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#1D1D21",
    justifyContent: "center",
    alignItems: "center",
  },
  setIndex: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 11,
    fontWeight: "900",
  },
  setInputGroup: {
    width: '100%',
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    height: 48,
  },
  removeSetBtn: {
    padding: 4,
  },
  addSetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "#1D1D21",
    borderWidth: 1.5,
    borderColor: "rgba(11, 130, 255, 0.2)",
  },
  addSetBtnText: {
    color: COLORS.TEXT_PRIMARY,
    fontWeight: "800",
    fontSize: 13,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  addExerciseSection: {
    marginTop: 8,
    marginBottom: 100,
  },
  addExerciseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.CARD_BG,
    padding: 12,
    borderRadius: 28,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
  },
  addExerciseInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.BG,
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 56,
  },
  addExerciseInput: {
    flex: 1,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: "800",
    padding: 0,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  addExerciseBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.ACCENT_BLUE,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    marginTop: 100,
  },
  emptyText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 20,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  completeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
  },
  checkMarkCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.ACCENT_GREEN,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.BORDER_LIGHT,
  },
});
