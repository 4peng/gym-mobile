import React, { useState, useCallback, useMemo } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, LayoutAnimation } from "react-native";
import { Trash2, Clock, StickyNote, Dumbbell, Plus } from "lucide-react-native";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import { toTitleCase } from "@/utils/string";
import type { WorkoutExercise } from "@/types";
import { resolveExercisePlaceholders } from "@/utils/placeholders";
import { formatSecondsToMMSS } from "@/utils/conversions";
import RestTimerPicker from "@/components/RestTimerPicker";
import { showConfirm } from "@/utils/alerts";
import { HapticFeedback } from "@/utils/haptics";
import { SetRow } from "./SetRow";

import MuscleSelector from "@/src/components/MuscleSelector";
import { MuscleGroup } from "@/src/constants/muscles";

interface ExerciseCardProps {
  exercise: WorkoutExercise;
}

export const ExerciseCard = React.memo<ExerciseCardProps>(function ExerciseCard({
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

  const handleUnitToggle = useCallback(() => {
    HapticFeedback.selection();
    toggleExerciseUnit(exercise.id);
  }, [exercise.id, toggleExerciseUnit]);

  const handleMusclesChange = useCallback((muscles: MuscleGroup[]) => {
    updateExerciseField(exercise.id, "muscles", muscles);
    HapticFeedback.selection();
  }, [exercise.id, updateExerciseField]);

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
            <MuscleSelector 
              selectedMuscles={exercise.muscles || []}
              onSelect={handleMusclesChange}
            />
            <View style={{ width: '100%', height: 12 }} />
            <Pressable 
              style={({ pressed }) => [styles.unitPill, pressed && { opacity: 0.7 }]}
              onPress={handleUnitToggle}
            >
              <Dumbbell size={10} color={COLORS.ACCENT_BLUE} />
              <Text style={styles.unitPillText}>{exercise.weightUnit || "kg"}</Text>
            </Pressable>
            <Pressable 
              style={({ pressed }) => [styles.restPill, pressed && { opacity: 0.7 }]}
              onPress={() => setPickerVisible(true)}
            >
              <Clock size={10} color={COLORS.ACCENT_BLUE} />
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

const styles = StyleSheet.create({
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
    flexWrap: 'wrap',
  },
  unitPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.CARD_HOVER,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
  },
  unitPillText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  restPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.CARD_HOVER,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
  },
  restPillText: {
    color: COLORS.TEXT_SECONDARY,
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
  addSetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "rgba(11, 130, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(11, 130, 255, 0.2)",
  },
  addSetBtnText: {
    color: COLORS.ACCENT_BLUE,
    fontWeight: "800",
    fontSize: 14,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
});
