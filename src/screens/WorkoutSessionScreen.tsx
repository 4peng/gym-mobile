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
import { Directions, Gesture, GestureDetector } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { showConfirm } from "@/utils/alerts";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { useProgramStore } from "@/stores/programStore";
import { COLORS, LAYOUT, SPACE, TYPE, UI } from "@/constants/theme";
import { HapticFeedback } from "@/utils/haptics";
import { ExerciseCard } from "@/components/Workout/ExerciseCard";
import ExercisePickerModal from "@/components/ExercisePickerModal";
import ExerciseNavMenu from "@/components/Workout/ExerciseNavMenu";
import MuscleSelector from "@/components/MuscleSelector";
import { Sheet } from "@/components/ui/Sheet";
import { IconButton } from "@/components/ui/IconButton";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ExerciseDefinition } from "@/types";
import type { MuscleGroup } from "@/constants/muscles";
import { sessionExercisesToProgramExercises } from "@/utils/workoutToProgram";
import { HUDHeader } from "@/components/Workout/HUD/HUDHeader";
import { ScrubberRail, SCRUB_STEP } from "@/components/Workout/HUD/ScrubberRail";
import { HUDPillNav } from "@/components/Workout/HUD/HUDPillNav";

const EMPTY_MUSCLES: MuscleGroup[] = [];

export default function WorkoutSessionScreen() {
  const router = useRouter();
  const activeSessionId = useWorkoutSessionStore((s) => s.activeSession?._id);
  const startedAt = useWorkoutSessionStore((s) => s.activeSession?.startedAt);
  const activeExerciseId = useWorkoutSessionStore((s) => s.activeExerciseId);
  const setActiveExerciseId = useWorkoutSessionStore((s) => s.setActiveExerciseId);
  const updateExerciseField = useWorkoutSessionStore((s) => s.updateExerciseField);
  const addExercise = useWorkoutSessionStore((s) => s.addExercise);
  const completeSession = useWorkoutSessionStore((s) => s.completeSession);
  const discardSession = useWorkoutSessionStore((s) => s.discardSession);
  const clearExpiredTimer = useWorkoutSessionStore((s) => s.clearExpiredTimer);
  const addProgram = useProgramStore((s) => s.addProgram);

  const exerciseIds = useWorkoutSessionStore(
    useShallow((s) => s.activeSession?.exercises.map((e) => e.id) ?? []),
  );
  const exerciseNames = useWorkoutSessionStore(
    useShallow((s) => s.activeSession?.exercises.map((e) => e.name) ?? []),
  );
  const exerciseProgress = useWorkoutSessionStore(
    useShallow((s) =>
      (s.activeSession?.exercises ?? []).map((e) =>
        e.sets.length > 0 ? e.sets.filter((st) => !!st.completedAt).length / e.sets.length : 0,
      ),
    ),
  );
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
  const currentExercise = useWorkoutSessionStore((s) =>
    s.activeSession?.exercises.find((e) => e.id === activeExerciseId),
  );

  const [pickerVisible, setPickerVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [scrubbingIndex, setScrubbingIndex] = useState<number | null>(null);
  const [muscleExerciseId, setMuscleExerciseId] = useState<string | null>(null);
  const [routineNameVisible, setRoutineNameVisible] = useState(false);
  const musclePickerMuscles = useWorkoutSessionStore(
    (s) =>
      s.activeSession?.exercises.find((e) => e.id === muscleExerciseId)?.muscles ?? EMPTY_MUSCLES,
  );

  const scrubberScrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollHandler = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      }),
    [scrollY],
  );
  const activeIndex = activeExerciseId ? exerciseIds.indexOf(activeExerciseId) : -1;

  useEffect(() => {
    if (activeSessionId && !activeExerciseId && exerciseIds.length > 0)
      setActiveExerciseId(exerciseIds[0]);
  }, [activeSessionId, activeExerciseId, exerciseIds, setActiveExerciseId]);
  useEffect(() => clearExpiredTimer(), [clearExpiredTimer]);
  useEffect(() => {
    if (scrubbingIndex !== null)
      scrubberScrollRef.current?.scrollTo({ x: scrubbingIndex * SCRUB_STEP, animated: true });
  }, [scrubbingIndex]);

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

  const navigateToId = useCallback(
    (id: string, animated = true) => {
      if (id === activeExerciseId) return;
      if (animated) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setActiveExerciseId(id);
      HapticFeedback.selection();
    },
    [activeExerciseId, setActiveExerciseId],
  );
  const step = useCallback(
    (dir: 1 | -1) => {
      const next = activeIndex + dir;
      if (next >= 0 && next < exerciseIds.length) navigateToId(exerciseIds[next]);
    },
    [activeIndex, exerciseIds, navigateToId],
  );

  const scrubStart = useRef(activeIndex);
  const gesture = useMemo(() => {
    const flingLeft = Gesture.Fling()
      .direction(Directions.LEFT)
      .runOnJS(true)
      .onStart(() => step(1));
    const flingRight = Gesture.Fling()
      .direction(Directions.RIGHT)
      .runOnJS(true)
      .onStart(() => step(-1));
    const scrub = Gesture.Pan()
      .activateAfterLongPress(250)
      .runOnJS(true)
      .onStart(() => {
        scrubStart.current = activeIndex;
        setScrubbingIndex(activeIndex);
        HapticFeedback.selection();
      })
      .onUpdate((e) => {
        const next = Math.max(
          0,
          Math.min(scrubStart.current + Math.round(e.translationX / 30), exerciseIds.length - 1),
        );
        if (next !== scrubbingIndex) {
          setScrubbingIndex(next);
          navigateToId(exerciseIds[next], false);
        }
      })
      .onFinalize(() => setScrubbingIndex(null));
    return Gesture.Race(scrub, flingLeft, flingRight);
  }, [activeIndex, exerciseIds, scrubbingIndex, navigateToId, step]);

  if (!activeSessionId) {
    return (
      <View style={[UI.screen, { justifyContent: "center" }]}>
        <EmptyState
          icon={<Dumbbell size={48} color={COLORS.BORDER_LIGHT} strokeWidth={1} />}
          title="No active session"
        />
      </View>
    );
  }

  return (
    <View style={UI.screen}>
      <HUDHeader scrollY={scrollY} startedAt={startedAt} progressData={progressData} />

      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {currentExercise ? (
          <ExerciseCard
            exercise={currentExercise}
            key={currentExercise.id}
            onMusclePickerOpen={setMuscleExerciseId}
          />
        ) : (
          <View style={styles.noExercise}>
            <Text style={TYPE.label}>No exercises added</Text>
            <IconButton tone="primary" onPress={() => setPickerVisible(true)}>
              <Plus size={20} color={COLORS.ACCENT_BLUE} />
            </IconButton>
          </View>
        )}
        <View style={{ height: 120 }} />
      </Animated.ScrollView>

      {scrubbingIndex !== null && (
        <ScrubberRail
          exerciseIds={exerciseIds}
          exerciseNames={exerciseNames}
          exerciseProgress={exerciseProgress}
          displayIndex={scrubbingIndex}
          scrubberScrollRef={scrubberScrollRef}
        />
      )}

      <GestureDetector gesture={gesture}>
        <HUDPillNav
          activeIndex={activeIndex}
          totalExercises={exerciseIds.length}
          onMenuPress={() => setMenuVisible(true)}
          onDiscardPress={handleDiscardPress}
          onFinishPress={handleFinishPress}
          onPrevPress={() => step(-1)}
          onNextPress={() => step(1)}
        />
      </GestureDetector>

      <ExerciseNavMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        activeExerciseId={activeExerciseId}
        onSelect={setActiveExerciseId}
        onAddPress={() => setPickerVisible(true)}
      />
      <ExercisePickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={(def: ExerciseDefinition) => addExercise(def)}
        title="Add exercise"
      />
      <MuscleSelector
        visible={muscleExerciseId !== null}
        onClose={() => setMuscleExerciseId(null)}
        selectedMuscles={musclePickerMuscles}
        onSelect={(muscles) => {
          if (muscleExerciseId) updateExerciseField(muscleExerciseId, "muscles", muscles);
        }}
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
  scrollContent: { flexGrow: 1, paddingTop: SPACE.sm + 2 },
  noExercise: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: SPACE.xl,
    paddingTop: 100,
  },
  promptInput: {
    ...TYPE.body,
    fontSize: 16,
    paddingHorizontal: LAYOUT.gutter + SPACE.sm,
    paddingVertical: SPACE.xl,
  },
});
