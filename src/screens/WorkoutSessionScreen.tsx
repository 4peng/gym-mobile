import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  LayoutAnimation,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Check, Dumbbell, Plus, X } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { showConfirm } from "@/utils/alerts";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { useProgramStore } from "@/stores/programStore";
import { COLORS, LAYOUT, SPACE, TYPE, UI } from "@/constants/theme";
import { HapticFeedback } from "@/utils/haptics";
import {
  ExerciseCard,
  type AnchorLayout,
  type ExerciseCardPicker,
} from "@/components/Workout/ExerciseCard";
import ExercisePickerModal from "@/components/ExercisePickerModal";
import ExerciseReorderModal from "@/components/Workout/ExerciseReorderModal";
import ExerciseTrackingModeSelector from "@/components/ExerciseTrackingModeSelector";
import MuscleSelector from "@/components/MuscleSelector";
import RestTimerPicker from "@/components/RestTimerPicker";
import { Sheet } from "@/components/ui/Sheet";
import { IconButton } from "@/components/ui/IconButton";
import { Button, buttonForeground } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ExerciseDefinition, WorkoutExercise } from "@/types";
import type { MuscleGroup } from "@/constants/muscles";
import { sessionExercisesToProgramExercises } from "@/utils/workoutToProgram";
import { HUDHeader } from "@/components/Workout/HUD/HUDHeader";
import { HUDBar } from "@/components/Workout/HUD/HUDBar";

const EMPTY_MUSCLES: MuscleGroup[] = [];
const EMPTY_EXERCISES: WorkoutExercise[] = [];

/** Which overlay is open. Pickers live here so they float over the whole screen. */
type Picker =
  | { kind: "add" }
  | { kind: Exclude<ExerciseCardPicker, "tracking">; exerciseId: string }
  | { kind: "tracking"; exerciseId: string; anchor: AnchorLayout }
  | null;

export default function WorkoutSessionScreen() {
  const router = useRouter();
  const activeSessionId = useWorkoutSessionStore((s) => s.activeSession?._id);
  const startedAt = useWorkoutSessionStore((s) => s.activeSession?.startedAt);
  // Immer keeps untouched exercise objects referentially stable, so each memoised card
  // re-renders only when its own exercise changes.
  const exercises = useWorkoutSessionStore((s) => s.activeSession?.exercises ?? EMPTY_EXERCISES);
  const updateExerciseField = useWorkoutSessionStore((s) => s.updateExerciseField);
  const selectExerciseDefinition = useWorkoutSessionStore((s) => s.selectExerciseDefinition);
  const addExercise = useWorkoutSessionStore((s) => s.addExercise);
  const reorderExercises = useWorkoutSessionStore((s) => s.reorderExercises);
  const completeSession = useWorkoutSessionStore((s) => s.completeSession);
  const discardSession = useWorkoutSessionStore((s) => s.discardSession);
  const clearExpiredTimer = useWorkoutSessionStore((s) => s.clearExpiredTimer);
  const addProgram = useProgramStore((s) => s.addProgram);

  const progressData = useWorkoutSessionStore(
    useShallow((s) => {
      let total = 0;
      let completed = 0;
      for (const ex of s.activeSession?.exercises ?? []) {
        total += ex.sets.length;
        for (const st of ex.sets) if (st.completedAt) completed++;
      }
      return { progress: total > 0 ? completed / total : 0, completed, total };
    }),
  );

  const [picker, setPicker] = useState<Picker>(null);
  const [reorderVisible, setReorderVisible] = useState(false);
  const [routineNameVisible, setRoutineNameVisible] = useState(false);
  const target =
    picker && "exerciseId" in picker
      ? exercises.find((e) => e.id === picker.exerciseId)
      : undefined;
  const closePicker = useCallback(() => setPicker(null), []);
  const openPicker = useCallback(
    (kind: ExerciseCardPicker, exerciseId: string, anchor?: AnchorLayout) => {
      if (kind === "tracking") {
        if (anchor) setPicker({ kind, exerciseId, anchor });
        return;
      }
      setPicker({ kind, exerciseId });
    },
    [],
  );

  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollHandler = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      }),
    [scrollY],
  );

  useEffect(() => clearExpiredTimer(), [clearExpiredTimer]);

  const goHome = () => setTimeout(() => router.replace("/programs/"), 100);
  const finish = useCallback(() => {
    HapticFeedback.success();
    completeSession();
    goHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completeSession]);
  const discard = useCallback(() => {
    discardSession();
    goHome();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discardSession]);

  const handleDiscardPress = () =>
    showConfirm("Discard workout", "Are you sure? This cannot be undone.", discard);
  const handleFinishPress = () => {
    if (progressData.completed === 0) {
      Alert.alert("Nothing completed", "No sets are marked done, so there is nothing to save.", [
        { text: "Resume", style: "cancel" },
        { text: "Discard workout", style: "destructive", onPress: discard },
      ]);
      return;
    }
    Alert.alert("Finish workout", "Mark this workout as complete?", [
      { text: "Resume", style: "cancel" },
      { text: "Save as routine", onPress: () => setRoutineNameVisible(true) },
      { text: "Finish", onPress: finish },
    ]);
  };
  const handleSaveRoutine = (name: string) => {
    const session = useWorkoutSessionStore.getState().activeSession;
    if (session) addProgram(name, sessionExercisesToProgramExercises(session.exercises));
    setRoutineNameVisible(false);
    finish();
  };

  const handleExerciseSelect = (def: ExerciseDefinition) => {
    if (picker?.kind === "exercise") {
      selectExerciseDefinition(picker.exerciseId, def);
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    addExercise(def);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  if (!activeSessionId) {
    return (
      <View style={[UI.screen, { justifyContent: "center" }]}>
        <EmptyState
          icon={<Dumbbell size={48} color={COLORS.BORDER} strokeWidth={1} />}
          title="No active session"
        />
      </View>
    );
  }

  return (
    <View style={UI.screen}>
      <HUDHeader scrollY={scrollY} startedAt={startedAt} progressData={progressData} />

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {exercises.map((exercise) => (
          <ExerciseCard key={exercise.id} exercise={exercise} onOpenPicker={openPicker} />
        ))}
        {exercises.length === 0 ? (
          <View style={styles.noExercise}>
            <Text style={TYPE.label}>No exercises added</Text>
            <Button
              label="Add exercise"
              tone="primary"
              variant="filled"
              icon={<Plus size={18} color={buttonForeground("primary", "filled")} />}
              onPress={() => setPicker({ kind: "add" })}
            />
          </View>
        ) : null}
      </Animated.ScrollView>

      <HUDBar
        canReorder={exercises.length > 1}
        onAddPress={() => setPicker({ kind: "add" })}
        onReorderPress={() => setReorderVisible(true)}
        onDiscardPress={handleDiscardPress}
        onFinishPress={handleFinishPress}
      />

      <ExercisePickerModal
        visible={picker?.kind === "add" || picker?.kind === "exercise"}
        onClose={closePicker}
        onSelect={handleExerciseSelect}
        selectedDefinitionId={
          picker?.kind === "exercise" ? target?.exerciseDefinitionId : undefined
        }
        title={picker?.kind === "exercise" ? "Change exercise" : "Add exercise"}
      />
      <MuscleSelector
        visible={picker?.kind === "muscles"}
        onClose={closePicker}
        selectedMuscles={target?.muscles ?? EMPTY_MUSCLES}
        onSelect={(muscles) => {
          if (target) updateExerciseField(target.id, "muscles", muscles);
        }}
      />
      <RestTimerPicker
        visible={picker?.kind === "rest"}
        initialSeconds={target?.restSeconds ?? 90}
        onClose={closePicker}
        onSave={(seconds) => {
          if (target) updateExerciseField(target.id, "restSeconds", seconds);
        }}
      />
      <ExerciseTrackingModeSelector
        visible={picker?.kind === "tracking"}
        onClose={closePicker}
        anchorLayout={picker?.kind === "tracking" ? picker.anchor : undefined}
        value={target?.trackingMode ?? "strength"}
        onChange={(mode) => {
          if (target) updateExerciseField(target.id, "trackingMode", mode);
        }}
      />
      <ExerciseReorderModal
        visible={reorderVisible}
        exercises={exercises.map((e) => ({ id: e.id, name: e.name }))}
        onClose={() => setReorderVisible(false)}
        onSave={reorderExercises}
      />
      <RoutineNamePrompt
        visible={routineNameVisible}
        onCancel={() => setRoutineNameVisible(false)}
        onSave={handleSaveRoutine}
      />
    </View>
  );
}

/** Asks for a routine name when finishing a workout as a new routine. */
function RoutineNamePrompt({
  visible,
  onCancel,
  onSave,
}: {
  visible: boolean;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const fallback = useMemo(() => `Routine ${new Date().toLocaleDateString()}`, []);
  const [name, setName] = useState("");
  useEffect(() => {
    if (visible) setName(fallback);
  }, [visible, fallback]);
  const save = () => onSave(name.trim() || fallback);

  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title="Save as routine"
      headerLeft={
        <IconButton size="md" tone="danger" onPress={onCancel}>
          <X size={20} color={COLORS.DANGER} />
        </IconButton>
      }
      headerRight={
        <IconButton size="md" tone="success" onPress={save}>
          <Check size={20} color={COLORS.ACCENT_GREEN} />
        </IconButton>
      }
    >
      <TextInput
        style={styles.promptInput}
        value={name}
        onChangeText={setName}
        placeholder="Routine name"
        placeholderTextColor={COLORS.TEXT_TERTIARY}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={save}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, paddingTop: SPACE.sm + 2, paddingBottom: 140 },
  noExercise: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: SPACE.xl,
    paddingTop: 100,
  },
  promptInput: {
    ...TYPE.body,
    paddingHorizontal: LAYOUT.gutter + SPACE.sm,
    paddingVertical: SPACE.xl,
  },
});
