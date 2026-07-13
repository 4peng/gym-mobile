'use client';

import React, { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { LayoutAnimation, StyleSheet, Text, View, InteractionManager, Animated, ScrollView, Alert, Pressable } from "react-native";
import { Dumbbell, Plus } from "lucide-react-native";
import { GestureHandlerRootView, GestureDetector, Gesture, Directions } from "react-native-gesture-handler";
import { useAppRouter } from "@/utils/navigation";
import { showConfirm } from "@/utils/alerts";
import { useAddExercise, useClearExpiredTimer, useCompleteSession, useDiscardSession, useSessionExerciseIds, useSessionExerciseNames, useSessionExerciseProgress, useSessionProgress } from "@/stores/activeSessionStore";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { useProgramStore } from "@/stores/programStore";
import { COLORS } from "@/constants/colors";
import { UI } from "@/constants/ui";
import { HapticFeedback } from "@/utils/haptics";
import { ExerciseCard } from "@/components/Workout/ExerciseCard";
import ExercisePickerModal from "@/components/ExercisePickerModal";
import ExerciseNavMenu from "@/components/Workout/ExerciseNavMenu";
import MuscleSelector from "@/components/MuscleSelector";
import type { ExerciseDefinition } from "@/types";
import { MuscleGroup } from "@/constants/muscles";

// Modular HUD Components
import { HUDHeader } from "@/components/Workout/HUD/HUDHeader";
import { ScrubberRail } from "@/components/Workout/HUD/ScrubberRail";
import { HUDPillNav } from "@/components/Workout/HUD/HUDPillNav";

const SCRUB_STEP = 76; // Match ScrubberRail logic: 64 + 12
const CONDENSE_THRESHOLD = 80;

export default function WorkoutSessionScreen() {
  const router = useAppRouter();
  const activeSessionId = useWorkoutSessionStore((s) => s.activeSession?._id);
  const startedAt = useWorkoutSessionStore((s) => s.activeSession?.startedAt);
  const activeExerciseId = useWorkoutSessionStore((s) => s.activeExerciseId);
  const setActiveExerciseId = useWorkoutSessionStore((s) => s.setActiveExerciseId);
  const updateExerciseField = useWorkoutSessionStore((s) => s.updateExerciseField);
  
  const exerciseIds = useSessionExerciseIds();
  const exerciseNames = useSessionExerciseNames();
  const exerciseProgress = useSessionExerciseProgress();
  const progressData = useSessionProgress();

  const addExercise = useAddExercise();
  const completeSession = useCompleteSession();
  const discardSession = useDiscardSession();
  const clearExpiredTimer = useClearExpiredTimer();
  const addProgram = useProgramStore((s) => s.addProgram);

const [exercisePickerVisible, setExercisePickerVisible] = useState(false);
const [navigationMenuVisible, setNavigationMenuVisible] = useState(false);
const [isScrubbing, setIsScrubbing] = useState(false);
const [scrubbingIndex, setScrubbingIndex] = useState<number | null>(null);
const [musclePicker, setMusclePicker] = useState<{ visible: boolean; exerciseId: string | null }>({ visible: false, exerciseId: null });

  const scrubberScrollRef = useRef<ScrollView>(null);
  const isFirstScrubRender = useRef(true);
  const scrollY = useRef(new Animated.Value(0)).current;

  const currentExercise = useWorkoutSessionStore((s) => s.activeSession?.exercises.find(e => e.id === activeExerciseId));
  const activeIndex = useMemo(() => activeExerciseId ? exerciseIds.indexOf(activeExerciseId) : -1, [activeExerciseId, exerciseIds]);

  useEffect(() => { if (activeSessionId && !activeExerciseId && exerciseIds.length > 0) setActiveExerciseId(exerciseIds[0]); }, [activeSessionId, activeExerciseId, exerciseIds, setActiveExerciseId]);
  useEffect(() => { InteractionManager.runAfterInteractions(() => { clearExpiredTimer(); }); }, [clearExpiredTimer]);

  useEffect(() => {
    if (isScrubbing && scrubbingIndex !== null && scrubberScrollRef.current) {
      const scrollX = scrubbingIndex * SCRUB_STEP;
      scrubberScrollRef.current.scrollTo({ x: scrollX, animated: !isFirstScrubRender.current });
      isFirstScrubRender.current = false;
    }
    if (!isScrubbing) isFirstScrubRender.current = true;
  }, [isScrubbing, scrubbingIndex]);

  // Muscle picker handlers
  const handleMusclePickerOpen = useCallback((exerciseId: string) => {
    setMusclePicker({ visible: true, exerciseId });
  }, []);

  const handleMusclePickerClose = useCallback(() => {
    setMusclePicker({ visible: false, exerciseId: null });
  }, []);

  const handleMusclesChange = useCallback((muscles: MuscleGroup[]) => {
    if (musclePicker.exerciseId) {
      updateExerciseField(musclePicker.exerciseId, "muscles", muscles);
      HapticFeedback.selection();
    }
  }, [musclePicker.exerciseId, updateExerciseField]);

  const handleFinishConfirmed = useCallback(() => { HapticFeedback.success(); completeSession(); setTimeout(() => router.replace("/programs/"), 100); }, [completeSession, router]);
  const handleDiscard = useCallback(() => { showConfirm("Discard Workout", "Are you sure? This cannot be undone.", () => { discardSession(); setTimeout(() => router.replace("/programs/"), 100); }); }, [discardSession, router]);
  
  const handleFinish = useCallback(() => {
    const session = useWorkoutSessionStore.getState().activeSession;
    if (!session) return;
    if (progressData.total === 0) {
      Alert.alert("Empty Workout", "You haven't completed any sets. What would you like to do?", [{ text: "Resume", style: "cancel" }, { text: "Discard", style: "destructive", onPress: handleDiscard }, { text: "Finish Anyway", onPress: handleFinishConfirmed }]);
    } else {
      Alert.alert("Finish Workout", "Mark this workout as complete?", [{ text: "Resume", style: "cancel" }, { text: "Save as Routine", onPress: () => { 
        Alert.prompt("Save as Routine", "Enter a name for this routine:", [
          { text: "Cancel", style: "cancel" }, 
          { text: "Save", onPress: (name?: string) => { 
            const routineName = name || "New Routine"; 
            const programExercises = session.exercises.map(ex => ({
              id: ex.id,
              exerciseDefinitionId: ex.exerciseDefinitionId || "",
              trackingMode: ex.trackingMode,
              name: ex.name,
              defaultSets: ex.sets.map(s => ({ type: s.type || "working" })),
              restSeconds: ex.restSeconds,
              notes: ex.notes,
              weightUnit: ex.weightUnit,
              initialWeight: ex.sets[0]?.weight ?? null,
              muscles: ex.muscles,
              isBodyweight: ex.isBodyweight
            }));
            addProgram(routineName, programExercises as any); handleFinishConfirmed();
          }}
        ]); 
      } }, { text: "Just Finish", onPress: handleFinishConfirmed }]);
    }
  }, [progressData.total, handleDiscard, handleFinishConfirmed, addProgram]);

  const navigateToId = useCallback((id: string, skipAnimation = false) => { if (id === activeExerciseId) return; if (!skipAnimation) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActiveExerciseId(id); HapticFeedback.selection(); }, [activeExerciseId, setActiveExerciseId]);
  const stepNavigation = useCallback((direction: 1 | -1) => { const nextIdx = activeIndex + direction; if (nextIdx >= 0 && nextIdx < exerciseIds.length) navigateToId(exerciseIds[nextIdx]); }, [activeIndex, exerciseIds, navigateToId]);

  const swipeLeft = Gesture.Fling().direction(Directions.LEFT).runOnJS(true).onStart(() => stepNavigation(1));
  const swipeRight = Gesture.Fling().direction(Directions.RIGHT).runOnJS(true).onStart(() => stepNavigation(-1));

  const scrubStartIndex = useRef(activeIndex);
  const scrubGesture = Gesture.Pan().activateAfterLongPress(250).runOnJS(true).onStart(() => { scrubStartIndex.current = activeIndex; setIsScrubbing(true); setScrubbingIndex(activeIndex); HapticFeedback.selection(); }).onUpdate((e) => {
    const sensitivity = 30; const delta = Math.round(e.translationX / sensitivity); let nextIdx = scrubStartIndex.current + delta; nextIdx = Math.max(0, Math.min(nextIdx, exerciseIds.length - 1));
    if (nextIdx !== scrubbingIndex) { setScrubbingIndex(nextIdx); navigateToId(exerciseIds[nextIdx], true); }
  }).onEnd(() => { setIsScrubbing(false); setScrubbingIndex(null); }).onFinalize(() => { setIsScrubbing(false); setScrubbingIndex(null); });
  
  const composedGesture = Gesture.Race(scrubGesture, swipeLeft, swipeRight);
  const onAddExerciseComplete = useCallback((def: ExerciseDefinition) => { addExercise(def); setExercisePickerVisible(false); }, [addExercise]);

  const toggleNavigationMenu = useCallback((visible: boolean) => {
    LayoutAnimation.configureNext({ duration: 180, create: { type: 'easeInEaseOut', property: 'opacity' }, update: { type: 'easeInEaseOut' }, delete: { type: 'easeInEaseOut', property: 'opacity' } });
    setNavigationMenuVisible(visible);
  }, []);

  if (!activeSessionId) return (<View style={styles.container}><View style={styles.emptyContainer}><Dumbbell size={48} color={COLORS.BORDER_LIGHT} strokeWidth={1} /><Text style={styles.emptyText}>No active session</Text></View></View>);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <HUDHeader scrollY={scrollY} startedAt={startedAt} progressData={progressData} condenseThreshold={CONDENSE_THRESHOLD} />
        
        <Animated.ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true} onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })} scrollEventThrottle={16}>
          <View style={styles.mainFocus}>{currentExercise ? (<ExerciseCard exercise={currentExercise} key={currentExercise.id} onMusclePickerOpen={handleMusclePickerOpen} />) : (<View style={styles.noExercise}><Text style={styles.noExerciseText}>NO EXERCISES ADDED</Text><Pressable style={UI.SHARED.iconBtn} onPress={() => setExercisePickerVisible(true)}><Plus size={20} color={COLORS.ACCENT_BLUE} /></Pressable></View>)}</View>
          <View style={{ height: 120 }} />
        </Animated.ScrollView>

        {isScrubbing && (<ScrubberRail exerciseIds={exerciseIds} exerciseNames={exerciseNames} exerciseProgress={exerciseProgress} displayIndex={scrubbingIndex ?? activeIndex} scrubberScrollRef={scrubberScrollRef} />)}
        
        <GestureDetector gesture={composedGesture}>
          <HUDPillNav activeIndex={activeIndex} totalExercises={exerciseIds.length} onMenuPress={() => toggleNavigationMenu(true)} onDiscardPress={handleDiscard} onFinishPress={handleFinish} onPrevPress={() => stepNavigation(-1)} onNextPress={() => stepNavigation(1)} />
        </GestureDetector>
        
        <ExerciseNavMenu visible={navigationMenuVisible} onClose={() => toggleNavigationMenu(false)} activeExerciseId={activeExerciseId} onSelect={setActiveExerciseId} onAddPress={() => setExercisePickerVisible(true)} />
        <ExercisePickerModal visible={exercisePickerVisible} onClose={() => setExercisePickerVisible(false)} onSelect={onAddExerciseComplete} title="Add Exercise" />
        <MuscleSelector
          visible={musclePicker.visible}
          onClose={handleMusclePickerClose}
          onSelect={handleMusclesChange}
          selectedMuscles={[]}
        />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  scrollContent: { flexGrow: 1, paddingTop: 10 },
  mainFocus: { },
  noExercise: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20, paddingTop: 100 },
  noExerciseText: { color: COLORS.TEXT_TERTIARY, fontSize: 14, fontFamily: UI.SHARED.sectionLabel.fontFamily, fontWeight: "800", letterSpacing: 2 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },
  emptyText: { color: COLORS.TEXT_SECONDARY, fontSize: 18, fontWeight: "800", marginTop: 20, fontFamily: UI.SHARED.sectionLabel.fontFamily },
});
