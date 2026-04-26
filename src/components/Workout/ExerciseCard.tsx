import React, { useState, useCallback, useMemo } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, LayoutAnimation } from "react-native";
import { Trash2, Clock, StickyNote, Dumbbell, Plus } from "lucide-react-native";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import type { WorkoutExercise } from "@/types";
import { resolveExercisePlaceholders } from "@/utils/placeholders";
import { formatSecondsToMMSS } from "@/utils/conversions";
import RestTimerPicker from "@/components/RestTimerPicker";
import { showConfirm } from "@/utils/alerts";
import { HapticFeedback } from "@/utils/haptics";
import { SetRow } from "./SetRow";
import ExercisePickerField from "@/components/ExercisePickerField";
import ExerciseTrackingModeSelector from "@/components/ExerciseTrackingModeSelector";
import ExerciseBodyweightSelector from "@/components/ExerciseBodyweightSelector";
import MuscleSelector from "@/src/components/MuscleSelector";
import { MuscleGroup } from "@/src/constants/muscles";
import type { ExerciseDefinition, ExerciseTrackingMode } from "@/types";
import { getExerciseIdentityKey } from "@/utils/exerciseIdentity";

interface ExerciseCardProps {
  exercise: WorkoutExercise;
}

function StatChip({
  value,
  icon,
  onPress,
  accent,
}: {
  value: string;
  icon: React.ReactNode;
  onPress?: () => void;
  accent?: string;
}) {
  const content = (
    <View style={styles.statChipContent}>
      {icon}
      <Text style={[styles.statChipValue, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  );

  if (!onPress) {
    return <View style={styles.statChip}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.statChip, pressed && styles.statChipPressed]}
    >
      {content}
    </Pressable>
  );
}

export const ExerciseCard = React.memo<ExerciseCardProps>(function ExerciseCard({
  exercise,
}) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const addSet = useWorkoutSessionStore((s) => s.addSet);
  const removeExercise = useWorkoutSessionStore((s) => s.removeExercise);
  const updateExerciseField = useWorkoutSessionStore((s) => s.updateExerciseField);
  const toggleExerciseUnit = useWorkoutSessionStore((s) => s.toggleExerciseUnit);
  const toggleExerciseBodyweight = useWorkoutSessionStore((s) => s.toggleExerciseBodyweight);
  const selectExerciseDefinition = useWorkoutSessionStore((s) => s.selectExerciseDefinition);
  const history = useWorkoutSessionStore((s) => s.history);

  const handleRestSave = useCallback(
    (seconds: number) => {
      updateExerciseField(exercise.id, "restSeconds", seconds);
    },
    [exercise.id, updateExerciseField]
  );

  const handleExerciseSelect = useCallback(
    (selectedExercise: ExerciseDefinition) => {
      selectExerciseDefinition(exercise.id, selectedExercise);
    },
    [exercise.id, selectExerciseDefinition]
  );

  const handleNotesChange = useCallback(
    (text: string) => {
      updateExerciseField(exercise.id, "notes", text);
    },
    [exercise.id, updateExerciseField]
  );

  const handleTrackingModeChange = useCallback(
    (trackingMode: ExerciseTrackingMode) => {
      updateExerciseField(exercise.id, "trackingMode", trackingMode);
    },
    [exercise.id, updateExerciseField]
  );

  const placeholders = useMemo(
    () =>
      exercise.trackingMode === "strength"
        ? resolveExercisePlaceholders(
            getExerciseIdentityKey(exercise),
            exercise.sets,
            history,
            exercise.weightUnit || "kg"
          )
        : [],
    [exercise, history]
  );

  const handleAddSet = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    addSet(exercise.id);
  }, [exercise.id, addSet]);

  const handleRemoveExercise = useCallback(() => {
    showConfirm("Remove Exercise", `Remove "${exercise.name}"?`, () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      removeExercise(exercise.id);
    });
  }, [exercise.id, exercise.name, removeExercise]);

  const handleUnitToggle = useCallback(() => {
    HapticFeedback.selection();
    toggleExerciseUnit(exercise.id);
  }, [exercise.id, toggleExerciseUnit]);

  const handleBodyweightToggle = useCallback(() => {
    HapticFeedback.selection();
    toggleExerciseBodyweight(exercise.id);
  }, [exercise.id, toggleExerciseBodyweight]);

  const handleMusclesChange = useCallback(
    (muscles: MuscleGroup[]) => {
      updateExerciseField(exercise.id, "muscles", muscles);
      HapticFeedback.selection();
    },
    [exercise.id, updateExerciseField]
  );

  const hasNotes = exercise.notes.trim().length > 0;

  return (
    <View style={[UI.SHARED.card, styles.card]}>
      <View style={styles.topRow}>
        <View style={styles.topContent}>
          <ExercisePickerField
            label=""
            value={exercise.name}
            selectedDefinitionId={exercise.exerciseDefinitionId}
            onSelect={handleExerciseSelect}
          />
        </View>
        <Pressable onPress={handleRemoveExercise} hitSlop={12} style={styles.cardRemoveBtn}>
          <Trash2 size={16} color={COLORS.DANGER} />
        </Pressable>
      </View>

      <View style={styles.controlsSection}>
        <View style={styles.quickRow}>
          <ExerciseTrackingModeSelector
            value={exercise.trackingMode}
            onChange={handleTrackingModeChange}
            compact
          />

          {exercise.trackingMode === "strength" ? (
            <ExerciseBodyweightSelector
              isBodyweight={!!exercise.isBodyweight}
              onToggle={handleBodyweightToggle}
              compact
            />
          ) : null}

          <StatChip
            value={`Rest ${formatSecondsToMMSS(exercise.restSeconds)}`}
            icon={<Clock size={12} color={COLORS.TEXT_TERTIARY} />}
            onPress={() => setPickerVisible(true)}
          />

          {exercise.trackingMode === "strength" ? (
            <StatChip
              value={(exercise.weightUnit || "kg").toUpperCase()}
              icon={<Dumbbell size={12} color={COLORS.TEXT_TERTIARY} />}
              onPress={handleUnitToggle}
              accent={COLORS.ACCENT_BLUE}
            />
          ) : null}
        </View>

        <MuscleSelector
          selectedMuscles={exercise.muscles || []}
          onSelect={handleMusclesChange}
          label="Muscles"
        />
      </View>

      <Pressable
        onPress={() => setIsEditingNotes(true)}
        style={({ pressed }) => [
          styles.notesContainer,
          pressed && !isEditingNotes && { opacity: 0.85 },
        ]}
      >
        <StickyNote
          size={12}
          color={COLORS.TEXT_TERTIARY}
          style={{ marginTop: isEditingNotes ? 3 : 1 }}
        />
        {isEditingNotes ? (
          <TextInput
            style={styles.notesInput}
            value={exercise.notes}
            onChangeText={handleNotesChange}
            onBlur={() => setIsEditingNotes(false)}
            placeholder="Add cues, pace targets, machine settings..."
            placeholderTextColor={COLORS.TEXT_TERTIARY}
            autoFocus
            multiline
          />
        ) : (
          <Text
            style={[
              styles.notesText,
              !hasNotes && styles.notesPlaceholder,
              !hasNotes && styles.notesTextCompact,
            ]}
          >
            {hasNotes ? exercise.notes : "Add notes"}
          </Text>
        )}
      </Pressable>

      <View style={styles.setsShell}>
        <View style={styles.setsHeaderRow}>
          <View>
            <Text style={styles.setsTitle}>Sets</Text>
            <Text style={styles.setsSubtitle}>
              {exercise.trackingMode === "strength"
                ? "Log weight and reps"
                : exercise.trackingMode === "timed"
                  ? "Log duration for each set"
                  : "Log duration and distance"}
            </Text>
          </View>
          <Text style={styles.setCount}>{exercise.sets.length}</Text>
        </View>

        <View style={styles.rowsWrap}>
          {exercise.sets.map((s, i) => (
            <SetRow
              key={s.id}
              set={s}
              index={i}
              placeholder={placeholders[i] ?? { weight: null, reps: null }}
              exerciseId={exercise.id}
              exerciseName={exercise.name}
              restSeconds={exercise.restSeconds}
              trackingMode={exercise.trackingMode}
              weightUnit={exercise.weightUnit || "kg"}
            />
          ))}
        </View>

        <Pressable
          onPress={handleAddSet}
          style={({ pressed }) => [
            styles.addSetBtn,
            pressed && { backgroundColor: "rgba(11, 130, 255, 0.1)" },
          ]}
        >
          <Plus size={15} color={COLORS.ACCENT_BLUE} strokeWidth={3} />
          <Text style={styles.addSetBtnText}>Add Set</Text>
        </Pressable>
      </View>

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
  card: {
    padding: 16,
    borderRadius: 22,
    marginBottom: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  topContent: {
    flex: 1,
  },
  cardRemoveBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  controlsSection: {
    marginTop: 12,
    gap: 10,
  },
  quickRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  statChip: {
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: COLORS.BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: "center",
  },
  statChipPressed: {
    opacity: 0.82,
  },
  statChipContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statChipValue: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  notesContainer: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 10,
    minHeight: 44,
  },
  notesText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT_FAMILIES.MEDIUM,
    flex: 1,
  },
  notesTextCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  notesPlaceholder: {
    color: COLORS.TEXT_TERTIARY,
  },
  notesInput: {
    flex: 1,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT_FAMILIES.MEDIUM,
    padding: 0,
    minHeight: 20,
    textAlignVertical: "top",
  },
  setsShell: {
    marginTop: 12,
  },
  setsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  setsTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  setsSubtitle: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 11,
    marginTop: 2,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  setCount: {
    color: COLORS.ACCENT_BLUE,
    fontSize: 20,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
    lineHeight: 22,
  },
  rowsWrap: {
    gap: 8,
  },
  addSetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: "rgba(11, 130, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(11, 130, 255, 0.14)",
  },
  addSetBtnText: {
    color: COLORS.ACCENT_BLUE,
    fontWeight: "800",
    fontSize: 13,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
});
