'use client';

import React, { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  FlatList,
  InteractionManager,
} from "react-native";
import {
  Check,
  Copy,
  Dumbbell,
  Plus,
  Save,
  StickyNote,
  X,
} from "lucide-react-native";
import { useAppRouter } from "@/utils/navigation";
import { showAlert, showConfirm } from "@/utils/alerts";
import {
  useActiveSession,
  useAddExercise,
  useClearExpiredTimer,
  useCompleteSession,
  useDiscardSession,
} from "@/stores/activeSessionStore";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { useProgramStore } from "@/stores/programStore";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import {
  configureNotificationHandler,
  requestNotificationPermissions,
} from "@/utils/notifications";
import FloatingRestTimer from "@/components/FloatingRestTimer";
import LiveWorkoutTimer from "@/components/LiveWorkoutTimer";
import { HapticFeedback } from "@/utils/haptics";
import { ExerciseCard } from "@/components/Workout/ExerciseCard";
import ExerciseReorderModal from "@/components/Workout/ExerciseReorderModal";
import { copyExercises, createRoutineSnapshot, normalizeExercises } from "@/shared/programs.js";
import { generateId } from "@/utils/id";
import type { Program, ProgramExercise, WorkoutExercise, WorkoutSession } from "@/types";

function areIdArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((id, index) => id === right[index]);
}

function getExerciseInitialWeight(
  exercise: WorkoutExercise,
  sourceExercise?: ProgramExercise
) {
  if (typeof sourceExercise?.initialWeight === "number") {
    return sourceExercise.initialWeight;
  }

  const firstLoggedWeight = exercise.sets.find(
    (set) => typeof set.weight === "number" && Number.isFinite(set.weight)
  )?.weight;

  return typeof firstLoggedWeight === "number" ? firstLoggedWeight : null;
}

function buildRoutineExercisesFromSession(
  session: WorkoutSession,
  sourceProgram?: Program
) {
  const sourceById = new Map(
    (sourceProgram?.exercises || []).map((exercise) => [exercise.id, exercise])
  );

  return normalizeExercises(
    session.exercises
      .filter((exercise) => exercise.name.trim().length > 0)
      .map((exercise) => {
        const sourceExercise = exercise.programExerciseId
          ? sourceById.get(exercise.programExerciseId)
          : undefined;

        return {
          id: sourceExercise?.id ?? generateId(),
          name: exercise.name,
          defaultSets: Math.max(1, exercise.sets.length),
          restSeconds: exercise.restSeconds,
          notes: exercise.notes,
          weightUnit: exercise.weightUnit ?? sourceExercise?.weightUnit ?? "kg",
          initialWeight: getExerciseInitialWeight(exercise, sourceExercise),
          muscles: exercise.muscles ?? sourceExercise?.muscles ?? [],
        };
      })
  );
}

export default function WorkoutSessionScreen() {
  const activeSession = useActiveSession();
  const addExercise = useAddExercise();
  const completeSession = useCompleteSession();
  const discardSession = useDiscardSession();
  const clearExpiredTimer = useClearExpiredTimer();
  const updateWorkoutNotes = useWorkoutSessionStore((s) => s.updateWorkoutNotes);
  const reorderExercises = useWorkoutSessionStore((s) => s.reorderExercises);

  const updateProgram = useProgramStore((s) => s.updateProgram);
  const addProgram = useProgramStore((s) => s.addProgram);
  const sourceProgram = useProgramStore((s) =>
    activeSession?.programId ? s.programs.find((p) => p._id === activeSession.programId) : undefined
  );

  const router = useAppRouter();
  const [localExerciseOrder, setLocalExerciseOrder] = useState<string[] | null>(null);
  const [reorderVisible, setReorderVisible] = useState(false);
  const [routinePromptVisible, setRoutinePromptVisible] = useState(false);
  const [saveAsNewVisible, setSaveAsNewVisible] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState("");

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      configureNotificationHandler();
      requestNotificationPermissions();
    });

    clearExpiredTimer();

    return () => task.cancel();
  }, [clearExpiredTimer]);

  useEffect(() => {
    if (!sourceProgram) {
      setNewRoutineName("");
      return;
    }
    setNewRoutineName(`${sourceProgram.name} Copy`);
  }, [sourceProgram]);

  useEffect(() => {
    if (!activeSession) {
      setLocalExerciseOrder(null);
      return;
    }
    if (!localExerciseOrder) return;

    const sessionIds = activeSession.exercises.map((exercise) => exercise.id);
    const sameMembership =
      sessionIds.length === localExerciseOrder.length &&
      localExerciseOrder.every((id) => sessionIds.includes(id));

    if (!sameMembership || areIdArraysEqual(sessionIds, localExerciseOrder)) {
      setLocalExerciseOrder(null);
    }
  }, [activeSession, localExerciseOrder]);

  const displayedExercises = useMemo(() => {
    if (!activeSession) return [];

    const exercises = activeSession.exercises;
    if (!localExerciseOrder) return exercises;

    const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
    const ordered = localExerciseOrder
      .map((id) => byId.get(id))
      .filter((exercise): exercise is WorkoutExercise => !!exercise);

    return ordered.length === exercises.length ? ordered : exercises;
  }, [activeSession, localExerciseOrder]);

  const reorderItems = useMemo(
    () =>
      displayedExercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
      })),
    [displayedExercises]
  );
  const getDerivedRoutineExercises = useCallback(
    () =>
      activeSession
        ? buildRoutineExercisesFromSession(
            {
              ...activeSession,
              exercises: displayedExercises,
            },
            sourceProgram
          )
        : [],
    [activeSession, displayedExercises, sourceProgram]
  );
  const getRoutineHasChanges = useCallback(() => {
    if (!activeSession?.programId || !sourceProgram) return false;

    const derivedRoutineExercises = getDerivedRoutineExercises();
    return (
      createRoutineSnapshot("", sourceProgram.exercises) !==
      createRoutineSnapshot("", derivedRoutineExercises)
    );
  }, [activeSession?.programId, getDerivedRoutineExercises, sourceProgram]);

  const handleAddExercise = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    addExercise("");
  }, [addExercise]);

  const finishWorkout = useCallback(() => {
    HapticFeedback.success();
    completeSession();
    setTimeout(() => {
      router.replace("/programs/");
    }, 100);
  }, [completeSession, router]);

  const handleFinishConfirmed = useCallback(() => {
    if (getRoutineHasChanges()) {
      setRoutinePromptVisible(true);
      return;
    }

    showConfirm(
      "Finish Workout",
      "Complete this workout session?",
      finishWorkout
    );
  }, [finishWorkout, getRoutineHasChanges]);

  const handleSaveRoutineChanges = useCallback(
    (mode: "current" | "workout-only") => {
      const derivedRoutineExercises = getDerivedRoutineExercises();

      if (mode === "current") {
        if (!sourceProgram) {
          showAlert("Routine Missing", "The original routine could not be found.");
          return;
        }
        if (derivedRoutineExercises.length === 0) {
          showAlert("No Routine To Save", "Add at least one named exercise before saving routine changes.");
          return;
        }
        updateProgram(sourceProgram._id, { exercises: derivedRoutineExercises });
      }

      setRoutinePromptVisible(false);
      finishWorkout();
    },
    [finishWorkout, getDerivedRoutineExercises, sourceProgram, updateProgram]
  );

  const handleCreateRoutineAndFinish = useCallback(() => {
    const derivedRoutineExercises = getDerivedRoutineExercises();
    const trimmedName = newRoutineName.trim();
    if (trimmedName.length === 0) {
      showAlert("Routine Name Required", "Enter a name for the new routine.");
      return;
    }
    if (derivedRoutineExercises.length === 0) {
      showAlert("No Routine To Save", "Add at least one named exercise before creating a routine.");
      return;
    }

    addProgram(trimmedName, copyExercises(derivedRoutineExercises, generateId));
    setSaveAsNewVisible(false);
    setRoutinePromptVisible(false);
    finishWorkout();
  }, [addProgram, finishWorkout, getDerivedRoutineExercises, newRoutineName]);

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

  const handleReorderSave = useCallback((exerciseIds: string[]) => {
    setLocalExerciseOrder(exerciseIds);
    InteractionManager.runAfterInteractions(() => {
      startTransition(() => {
        reorderExercises(exerciseIds);
      });
    });
  }, [reorderExercises]);

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
    <>
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
                onPress={handleFinishConfirmed}
                style={({ pressed }) => [UI.SHARED.actionBtn, pressed && { transform: [{ scale: 0.96 }] }]}
              >
                <Check size={24} color={COLORS.TEXT_PRIMARY} strokeWidth={3} />
              </Pressable>
            </View>
          </View>

          <FlatList
            data={displayedExercises}
            renderItem={({ item }) => <ExerciseCard exercise={item} />}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={
              <View style={styles.footerSection}>
                <Text style={UI.SHARED.sectionLabel}>Workout Notes</Text>
                <View style={styles.workoutNotesCard}>
                  <StickyNote size={16} color={COLORS.ACCENT_BLUE} style={{ marginTop: 4 }} />
                  <TextInput
                    style={styles.workoutNotesInput}
                    value={activeSession.notes}
                    onChangeText={updateWorkoutNotes}
                    placeholder="Add end-of-workout notes..."
                    placeholderTextColor={COLORS.TEXT_TERTIARY}
                    multiline
                  />
                </View>

                <View style={styles.footerActionsRow}>
                  <Pressable
                    onPress={handleAddExercise}
                    style={({ pressed }) => [
                      styles.footerActionBtn,
                      pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Plus size={18} color={COLORS.ACCENT_BLUE} strokeWidth={3} />
                    <Text style={styles.footerActionText}>Add Exercise</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setReorderVisible(true)}
                    style={({ pressed }) => [
                      styles.footerActionBtn,
                      pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Text style={styles.footerActionText}>Reorder</Text>
                  </Pressable>
                </View>
              </View>
            }
          />

          <FloatingRestTimer />
        </View>
      </KeyboardAvoidingView>

      <ExerciseReorderModal
        visible={reorderVisible}
        exercises={reorderItems}
        onClose={() => setReorderVisible(false)}
        onSave={handleReorderSave}
      />

      <Modal
        visible={routinePromptVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRoutinePromptVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRoutinePromptVisible(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Routine Changed During Workout</Text>
            <Text style={styles.modalDescription}>
              Save these exercise-stack changes back to your routine, turn them into a new routine,
              or keep them only in this workout.
            </Text>

            <Pressable
              style={({ pressed }) => [styles.optionBtn, pressed && { backgroundColor: "#1D1D21" }]}
              onPress={() => handleSaveRoutineChanges("current")}
            >
              <View style={[styles.optionIcon, { backgroundColor: "rgba(11, 130, 255, 0.1)" }]}>
                <Save size={20} color={COLORS.ACCENT_BLUE} />
              </View>
              <View style={styles.optionCopy}>
                <Text style={styles.optionLabel}>Save To Current Routine</Text>
                <Text style={styles.optionDesc}>Update the routine you started from.</Text>
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.optionBtn, pressed && { backgroundColor: "#1D1D21" }]}
              onPress={() => {
                setRoutinePromptVisible(false);
                setSaveAsNewVisible(true);
              }}
            >
              <View style={[styles.optionIcon, { backgroundColor: "rgba(16, 217, 75, 0.1)" }]}>
                <Copy size={20} color={COLORS.ACCENT_GREEN} />
              </View>
              <View style={styles.optionCopy}>
                <Text style={styles.optionLabel}>Save As New Routine</Text>
                <Text style={styles.optionDesc}>Keep the original routine untouched.</Text>
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.optionBtn, pressed && { backgroundColor: "#1D1D21" }]}
              onPress={() => handleSaveRoutineChanges("workout-only")}
            >
              <View style={[styles.optionIcon, { backgroundColor: "rgba(255,255,255,0.06)" }]}>
                <Check size={20} color={COLORS.TEXT_PRIMARY} />
              </View>
              <View style={styles.optionCopy}>
                <Text style={styles.optionLabel}>Workout Only</Text>
                <Text style={styles.optionDesc}>Finish now without changing any saved routine.</Text>
              </View>
            </Pressable>

            <Pressable style={styles.modalCancelBtn} onPress={() => setRoutinePromptVisible(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={saveAsNewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setSaveAsNewVisible(false);
          setRoutinePromptVisible(true);
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setSaveAsNewVisible(false);
              setRoutinePromptVisible(true);
            }}
          />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>New Routine Name</Text>
            <Text style={styles.modalDescription}>
              This will save the adjusted exercise stack as a separate routine.
            </Text>

            <View style={styles.newRoutineInputShell}>
              <TextInput
                style={styles.newRoutineInput}
                value={newRoutineName}
                onChangeText={setNewRoutineName}
                placeholder="Routine name"
                placeholderTextColor={COLORS.TEXT_TERTIARY}
                autoFocus
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.primaryModalBtn,
                pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
              ]}
              onPress={handleCreateRoutineAndFinish}
            >
              <Text style={styles.primaryModalBtnText}>Save New Routine And Finish</Text>
            </Pressable>

            <Pressable
              style={styles.modalCancelBtn}
              onPress={() => {
                setSaveAsNewVisible(false);
                setRoutinePromptVisible(true);
              }}
            >
              <Text style={styles.modalCancelText}>Back</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
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
    paddingBottom: 180,
  },
  footerSection: {
    marginTop: 8,
    marginBottom: 100,
  },
  workoutNotesCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: COLORS.CARD_BG,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
    padding: 16,
    minHeight: 120,
  },
  workoutNotesInput: {
    flex: 1,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: FONT_FAMILIES.MEDIUM,
    padding: 0,
    textAlignVertical: "top",
  },
  footerActionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  footerActionBtn: {
    flex: 1,
    height: 58,
    borderRadius: 20,
    backgroundColor: COLORS.CARD_BG,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  footerActionText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: COLORS.CARD_BG,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
  },
  modalTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: "900",
    fontFamily: FONT_FAMILIES.MEDIUM,
    marginBottom: 8,
  },
  modalDescription: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONT_FAMILIES.MEDIUM,
    marginBottom: 20,
  },
  optionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  optionCopy: {
    flex: 1,
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
    marginTop: 3,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  modalCancelBtn: {
    marginTop: 8,
    paddingVertical: 16,
    alignItems: "center",
  },
  modalCancelText: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 15,
    fontWeight: "700",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  newRoutineInputShell: {
    backgroundColor: COLORS.BG,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  newRoutineInput: {
    height: 60,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
    padding: 0,
  },
  primaryModalBtn: {
    height: 58,
    borderRadius: 22,
    backgroundColor: COLORS.ACCENT_BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryModalBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    fontFamily: FONT_FAMILIES.MEDIUM,
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
});
