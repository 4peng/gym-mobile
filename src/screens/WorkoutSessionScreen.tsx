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
  CheckCircle2
} from "lucide-react-native";
import { useAppRouter } from "@/utils/navigation";
import { showAlert, showConfirm } from "@/utils/alerts";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
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
      // Resolve null → placeholder before completing.
      const resolved = resolveSetOnComplete(set, placeholder);
      if (set.weight === null) updateSet(exerciseId, set.id, "weight", resolved.weight);
      if (set.reps === null) updateSet(exerciseId, set.id, "reps", resolved.reps);
      
      // Trigger rest timer automatically.
      if (restSeconds > 0) {
        startRestTimer(exerciseId, restSeconds, exerciseName);
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
      <View style={styles.setIndexContainer}>
        <Text style={styles.setIndex}>{index + 1}</Text>
      </View>

      <View style={styles.setInputGroup}>
        <TextInput
          style={styles.numericInput}
          keyboardType="decimal-pad"
          value={set.weight !== null ? String(set.weight) : ""}
          placeholder={placeholder.weight !== null ? String(placeholder.weight) : "—"}
          placeholderTextColor={COLORS.TEXT_TERTIARY}
          onChangeText={handleWeightChange}
          editable={!isCompleted}
        />
        <Text style={styles.unitLabel}>{weightUnit}</Text>
      </View>

      <View style={styles.setInputGroup}>
        <TextInput
          style={styles.numericInput}
          keyboardType="number-pad"
          value={set.reps !== null ? String(set.reps) : ""}
          placeholder={placeholder.reps !== null ? String(placeholder.reps) : "—"}
          placeholderTextColor={COLORS.TEXT_TERTIARY}
          onChangeText={handleRepsChange}
          editable={!isCompleted}
        />
        <Text style={styles.unitLabel}>reps</Text>
      </View>

      <View style={styles.setActionArea}>
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
            <Check size={18} color={COLORS.ACCENT_BLUE} strokeWidth={3} />
          )}
        </Pressable>

        {!isCompleted && (
          <Pressable onPress={handleRemove} hitSlop={12} style={styles.removeSetBtn}>
            <X size={14} color={COLORS.TEXT_TERTIARY} />
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
  const router = useAppRouter();
  const addSet = useWorkoutSessionStore((s) => s.addSet);
  const removeExercise = useWorkoutSessionStore((s) => s.removeExercise);
  const updateExerciseField = useWorkoutSessionStore((s) => s.updateExerciseField);
  const toggleExerciseUnit = useWorkoutSessionStore((s) => s.toggleExerciseUnit);
  const history = useWorkoutSessionStore((s) => s.history);

  const [restInput, setRestInput] = useState(formatSecondsToMMSS(exercise.restSeconds));

  useEffect(() => {
    setRestInput(formatSecondsToMMSS(exercise.restSeconds));
  }, [exercise.restSeconds]);

  const handleRestBlur = useCallback(() => {
    const totalSeconds = parseMMSSToSeconds(restInput);
    updateExerciseField(exercise.id, "restSeconds", totalSeconds);
    setRestInput(formatSecondsToMMSS(totalSeconds));
  }, [restInput, exercise.id, updateExerciseField]);

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
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.exerciseInfo}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <View style={styles.exerciseMetaRow}>
            <Pressable 
              style={({ pressed }) => [styles.unitPill, pressed && { opacity: 0.7 }]}
              onPress={() => toggleExerciseUnit(exercise.id)}
            >
              <Dumbbell size={10} color={COLORS.ACCENT_YELLOW} />
              <Text style={styles.unitPillText}>{exercise.weightUnit || "kg"}</Text>
            </Pressable>
            <View style={styles.restPill}>
              <Clock size={10} color={COLORS.TEXT_TERTIARY} />
              <TextInput
                style={styles.restTimerInput}
                value={restInput}
                onChangeText={setRestInput}
                onBlur={handleRestBlur}
              />
            </View>
          </View>
        </View>
        <Pressable onPress={handleRemoveExercise} hitSlop={12} style={styles.cardRemoveBtn}>
          <Trash2 size={18} color={COLORS.TEXT_TERTIARY} />
        </Pressable>
      </View>

      {exercise.notes !== "" && (
        <View style={styles.notesContainer}>
          <StickyNote size={12} color={COLORS.ACCENT_YELLOW} style={{marginTop: 2}} />
          <Text style={styles.notesText}>{exercise.notes}</Text>
        </View>
      )}

      <View style={styles.setHeader}>
        <Text style={styles.setHeaderText}>Set</Text>
        <Text style={styles.setHeaderText}>Weight</Text>
        <Text style={styles.setHeaderText}>Reps</Text>
        <View style={{ width: 60 }} />
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
        <Plus size={16} color={COLORS.TEXT_SECONDARY} />
        <Text style={styles.addSetBtnText}>Add Set</Text>
      </Pressable>
    </View>
  );
});

// ──────────────────────────────────────────────
// WorkoutSessionScreen
// ──────────────────────────────────────────────

export default function WorkoutSessionScreen() {
  const activeSession = useWorkoutSessionStore((s) => s.activeSession);
  const addExercise = useWorkoutSessionStore((s) => s.addExercise);
  const completeSession = useWorkoutSessionStore((s) => s.completeSession);
  const discardSession = useWorkoutSessionStore((s) => s.discardSession);
  const clearExpiredTimer = useWorkoutSessionStore((s) => s.clearExpiredTimer);

  const router = useAppRouter();
  const [newExerciseName, setNewExerciseName] = React.useState("");

  // ── App mount: notification config + expired-timer cleanup ──
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      configureNotificationHandler();
      requestNotificationPermissions();
    });
    
    // If the app was killed and reopened after rest expired, clean up.
    clearExpiredTimer();
    
    return () => task.cancel();
  }, [clearExpiredTimer]);

  const handleAddExercise = useCallback(() => {
    const trimmed = newExerciseName.trim();
    if (trimmed === "") return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    addExercise(trimmed);
    setNewExerciseName("");
  }, [newExerciseName, addExercise]);

  const handleFinish = useCallback(() => {
    showConfirm(
      "Finish Workout",
      "Complete this workout session?",
      () => {
        // Safe navigation: complete store state then transition
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

  // Guard: nothing to render if there's no active session.
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
    <View style={styles.container}>
      {/* Dynamic Header Area */}
      <View style={styles.header}>
        <View style={styles.headerTitleGroup}>
          <View style={styles.timerRow}>
            <LiveWorkoutTimer startedAt={activeSession.startedAt} />
          </View>
          <Text style={styles.headerTitle}>Workout</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable 
            onPress={handleDiscard} 
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
          >
            <X size={24} color={COLORS.DANGER} />
          </Pressable>
          <Pressable 
            onPress={handleFinish} 
            style={({ pressed }) => [styles.finishBtn, pressed && { transform: [{scale: 0.96}] }]}
          >
            <CheckCircle2 size={24} color={COLORS.TEXT_PRIMARY} strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>

      {/* Exercise list */}
      <FlatList
        data={activeSession.exercises}
        renderItem={({ item }) => <ExerciseCard exercise={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <View style={styles.addExerciseSection}>
            <Text style={styles.sectionLabel}>Next Exercise</Text>
            <View style={styles.addExerciseRow}>
              <TextInput
                style={styles.addExerciseInput}
                placeholder="Exercise name"
                placeholderTextColor={COLORS.TEXT_TERTIARY}
                value={newExerciseName}
                onChangeText={setNewExerciseName}
                onSubmitEditing={handleAddExercise}
                returnKeyType="done"
              />
              <Pressable 
                onPress={handleAddExercise} 
                style={({ pressed }) => [
                  styles.addExerciseBtn,
                  pressed && { backgroundColor: "rgba(11, 130, 255, 0.2)" }
                ]}
              >
                <Plus size={24} color={COLORS.ACCENT_BLUE} strokeWidth={3} />
              </Pressable>
            </View>
          </View>
        }
      />

      {/* Floating rest timer — isolated re-render, never triggers parent re-render */}
      <FloatingRestTimer />
    </View>
  );
}

// ──────────────────────────────────────────────
// Styles
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
    color: COLORS.ACCENT_BLUE,
    fontSize: 11,
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
  finishBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.ACCENT_GREEN,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: COLORS.ACCENT_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  // List
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 160,
  },

  // Card
  card: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 32,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
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
  exerciseName: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.8,
    fontFamily: FONT_FAMILIES.MEDIUM,
    marginBottom: 8,
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
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
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
  restTimerInput: {
    color: COLORS.ACCENT_YELLOW,
    fontSize: 12,
    fontWeight: "900",
    fontFamily: FONT_FAMILIES.MEDIUM,
    padding: 0,
    width: 45,
    textAlign: "center",
  },
  cardRemoveBtn: {
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 12,
  },
  notesContainer: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(250, 204, 0, 0.05)",
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

  // Set Area
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
    flex: 1,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  setRowCompleted: {
    opacity: 0.3,
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
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    paddingHorizontal: 8,
  },
  numericInput: {
    flex: 1,
    color: COLORS.TEXT_PRIMARY,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    paddingVertical: 12,
  },
  unitLabel: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 10,
    fontWeight: "700",
    marginLeft: 2,
    width: 24,
  },
  setActionArea: {
    width: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  completeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(11, 130, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  checkMarkCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.ACCENT_GREEN,
    justifyContent: "center",
    alignItems: "center",
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
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    borderStyle: "dashed",
  },
  addSetBtnText: {
    color: COLORS.TEXT_SECONDARY,
    fontWeight: "800",
    fontSize: 13,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },

  // Footer
  addExerciseSection: {
    marginTop: 8,
    marginBottom: 100,
  },
  sectionLabel: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 16,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  addExerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  addExerciseInput: {
    flex: 1,
    backgroundColor: COLORS.CARD_BG,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  addExerciseBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#1D1D21",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(11, 130, 255, 0.2)",
  },

  // Empty state
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
});
