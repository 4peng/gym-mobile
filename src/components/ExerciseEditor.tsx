import React, { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, LayoutAnimation } from "react-native";
import { X, Hash, Clock, Dumbbell, StickyNote, Plus, Minus } from "lucide-react-native";
import { COLORS, SET_TYPE_COLORS, withAlpha } from "@/constants/colors";
import { SetTypeLegend } from "@/components/Workout/SetTypeLegend";
import { NEXT_SET_TYPE } from "@/shared/programs.js";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import { formatSecondsToMMSS } from "@/utils/conversions";
import RestTimerPicker from "./RestTimerPicker";
import ExercisePickerModal from "@/components/ExercisePickerModal";
import MuscleSelector from "@/src/components/MuscleSelector";
import { type MuscleGroup, formatMuscleLabels } from "@/src/constants/muscles";
import type { ExerciseDefinition, ExerciseTrackingMode } from "@/types";
import { useExerciseLibraryStore } from "@/stores/exerciseLibraryStore";
import { HapticFeedback } from "@/utils/haptics";
import { inferTrackingModeFromExerciseDefinition } from "@/utils/exerciseTracking";

export interface ExerciseFormData {
  id: string;
  exerciseDefinitionId?: string;
  trackingMode: ExerciseTrackingMode;
  name: string;
  defaultSets: { type: "working" | "warmup" | "dropset" }[];
  restSeconds: number;
  notes: string;
  weightUnit?: "kg" | "lbs";
  initialWeight?: number | null;
  muscles: MuscleGroup[];
  isBodyweight?: boolean;
}

interface ExerciseEditorProps {
  exercise: ExerciseFormData;
  index: number;
  onUpdate: (id: string, updates: Partial<Omit<ExerciseFormData, "id">>) => void;
  onRemove: (id: string) => void;
}

const ExerciseEditor = React.memo<ExerciseEditorProps>(function ExerciseEditor({
  exercise,
  index,
  onUpdate,
  onRemove,
}) {
  const [exercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [musclePickerVisible, setMusclePickerVisible] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  const updateCustomExerciseMuscles = useExerciseLibraryStore(
    (state) => state.updateCustomExerciseMuscles,
  );

  const handleExerciseSelect = useCallback(
    (selectedExercise: ExerciseDefinition) => {
      onUpdate(exercise.id, {
        exerciseDefinitionId: selectedExercise.id,
        name: selectedExercise.name,
        muscles: selectedExercise.muscles,
        trackingMode: inferTrackingModeFromExerciseDefinition(selectedExercise),
      });
      setExercisePickerVisible(false);
    },
    [exercise.id, onUpdate],
  );

  const toggleSetType = useCallback(
    (setIndex: number) => {
      HapticFeedback.selection();
      const nextSets = [...exercise.defaultSets];
      nextSets[setIndex] = { type: NEXT_SET_TYPE[nextSets[setIndex].type] };
      onUpdate(exercise.id, { defaultSets: nextSets });
    },
    [exercise.defaultSets, exercise.id, onUpdate],
  );

  const handleLongPress = useCallback(() => {
    HapticFeedback.selection();
    setShowLegend(true);
  }, []);

  const handlePressOut = useCallback(() => {
    setShowLegend(false);
  }, []);

  const addSet = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onUpdate(exercise.id, {
      defaultSets: [...exercise.defaultSets, { type: "working" }],
    });
  }, [exercise.defaultSets, exercise.id, onUpdate]);

  const removeSet = useCallback(() => {
    if (exercise.defaultSets.length <= 1) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onUpdate(exercise.id, {
      defaultSets: exercise.defaultSets.slice(0, -1),
    });
  }, [exercise.defaultSets, exercise.id, onUpdate]);

  const handleRestSave = useCallback(
    (seconds: number) => {
      onUpdate(exercise.id, { restSeconds: seconds });
    },
    [exercise.id, onUpdate],
  );

  const handleToggleUnit = useCallback(() => {
    const nextUnit = exercise.weightUnit === "lbs" ? "kg" : "lbs";
    onUpdate(exercise.id, { weightUnit: nextUnit });
  }, [exercise.id, exercise.weightUnit, onUpdate]);

  const handleToggleBodyweight = useCallback(() => {
    onUpdate(exercise.id, { isBodyweight: !exercise.isBodyweight });
  }, [exercise.id, exercise.isBodyweight, onUpdate]);

  const handleNotesChange = useCallback(
    (text: string) => onUpdate(exercise.id, { notes: text }),
    [exercise.id, onUpdate],
  );

  const handleMusclesChange = useCallback(
    (muscles: MuscleGroup[]) => {
      onUpdate(exercise.id, { muscles });
      if (
        typeof exercise.exerciseDefinitionId === "string" &&
        exercise.exerciseDefinitionId.startsWith("custom-")
      ) {
        updateCustomExerciseMuscles(exercise.exerciseDefinitionId, muscles);
      }
    },
    [exercise.exerciseDefinitionId, exercise.id, onUpdate, updateCustomExerciseMuscles],
  );

  const handleRemove = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onRemove(exercise.id);
  }, [exercise.id, onRemove]);

  const muscleString = formatMuscleLabels(exercise.muscles).toUpperCase();

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <View style={styles.indexCircle}>
          <Text style={styles.indexText}>{index + 1}</Text>
        </View>
        <View style={styles.nameContainer}>
          <Pressable onPress={() => setExercisePickerVisible(true)}>
            <Text style={styles.exerciseNameText}>{exercise.name || "Select Exercise"}</Text>
          </Pressable>
          <Pressable onPress={() => setMusclePickerVisible(true)}>
            <Text style={styles.muscleText} numberOfLines={1}>
              {muscleString}
            </Text>
          </Pressable>
        </View>
        <Pressable onPress={handleRemove} style={styles.removeBtn} hitSlop={12}>
          <X size={18} color={COLORS.DANGER} />
        </Pressable>
      </View>

      <View style={styles.content}>
        {/* Sets Configuration */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.labelGroup}>
              <Hash size={12} color={COLORS.TEXT_TERTIARY} />
              <Text style={styles.sectionLabel}>SETS</Text>
            </View>
            <View style={styles.stepper}>
              <Pressable onPress={removeSet} style={styles.stepBtn}>
                <Minus size={14} color={COLORS.TEXT_PRIMARY} />
              </Pressable>
              <Text style={styles.stepCount}>{exercise.defaultSets.length}</Text>
              <Pressable onPress={addSet} style={styles.stepBtn}>
                <Plus size={14} color={COLORS.TEXT_PRIMARY} />
              </Pressable>
            </View>
          </View>

          <View style={styles.setStrip}>
            {exercise.defaultSets.map((set, i) => {
              const color = SET_TYPE_COLORS[set.type];
              const initial = { warmup: "U", working: "W", dropset: "D" }[set.type];

              return (
                <Pressable
                  key={i}
                  onPress={() => toggleSetType(i)}
                  onLongPress={handleLongPress}
                  onPressOut={handlePressOut}
                  delayLongPress={300}
                  style={[
                    styles.setNode,
                    { backgroundColor: withAlpha(color, 0.1), borderColor: withAlpha(color, 0.4) },
                  ]}
                >
                  <Text style={[styles.setNodeText, { color }]}>{initial}</Text>
                </Pressable>
              );
            })}

            {showLegend && <SetTypeLegend style={styles.legendPopup} />}
          </View>
        </View>

        {/* Row 2: Rest & Unit & BW */}
        <View style={styles.gridRow}>
          <Pressable onPress={() => setPickerVisible(true)} style={styles.gridCell}>
            <View style={styles.labelGroup}>
              <Clock size={12} color={COLORS.TEXT_TERTIARY} />
              <Text style={styles.sectionLabel}>REST</Text>
            </View>
            <Text style={styles.cellValue}>{formatSecondsToMMSS(exercise.restSeconds)}</Text>
          </Pressable>

          <Pressable onPress={handleToggleBodyweight} style={styles.gridCell}>
            <View style={styles.labelGroup}>
              <Text style={styles.sectionLabel}>BW</Text>
            </View>
            <Text
              style={[
                styles.cellValue,
                { color: exercise.isBodyweight ? COLORS.ACCENT_GREEN : COLORS.TEXT_TERTIARY },
              ]}
            >
              {exercise.isBodyweight ? "ON" : "OFF"}
            </Text>
          </Pressable>

          {!exercise.isBodyweight && (
            <Pressable onPress={handleToggleUnit} style={styles.gridCell}>
              <View style={styles.labelGroup}>
                <Dumbbell size={12} color={COLORS.TEXT_TERTIARY} />
                <Text style={styles.sectionLabel}>UNIT</Text>
              </View>
              <Text style={[styles.cellValue, { color: COLORS.ACCENT_BLUE }]}>
                {exercise.weightUnit || "kg"}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Row 3: Notes */}
        <View style={styles.notesSection}>
          <View style={styles.labelGroup}>
            <StickyNote size={12} color={COLORS.TEXT_TERTIARY} />
            <Text style={styles.sectionLabel}>NOTES</Text>
          </View>
          <TextInput
            style={styles.notesInput}
            value={exercise.notes}
            onChangeText={handleNotesChange}
            placeholder="Execution cues, setup, etc."
            placeholderTextColor={withAlpha(COLORS.TEXT_TERTIARY, 0.4)}
            multiline
          />
        </View>
      </View>

      <ExercisePickerModal
        visible={exercisePickerVisible}
        onClose={() => setExercisePickerVisible(false)}
        onSelect={handleExerciseSelect}
        title="Select Exercise"
      />

      <MuscleSelector
        visible={musclePickerVisible}
        onClose={() => setMusclePickerVisible(false)}
        selectedMuscles={exercise.muscles || []}
        onSelect={handleMusclesChange}
      />

      <RestTimerPicker
        visible={pickerVisible}
        initialSeconds={exercise.restSeconds}
        onClose={() => setPickerVisible(false)}
        onSave={handleRestSave}
      />
    </View>
  );
});

export default ExerciseEditor;

const styles = StyleSheet.create({
  shell: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: UI.RADIUS_CONTAINER,
    borderWidth: 1,
    borderColor: withAlpha(COLORS.TEXT_PRIMARY, 0.08),
    marginBottom: 16,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: withAlpha(COLORS.TEXT_PRIMARY, 0.03),
    borderBottomWidth: 1,
    borderBottomColor: withAlpha(COLORS.TEXT_PRIMARY, 0.05),
  },
  indexCircle: {
    width: 28,
    height: 24,
    borderRadius: 6,
    backgroundColor: withAlpha(COLORS.ACCENT_BLUE, 0.1),
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  indexText: {
    color: COLORS.ACCENT_BLUE,
    fontSize: 14,
    fontFamily: FONT_FAMILIES.MONO,
    fontWeight: "900",
  },
  nameContainer: {
    flex: 1,
  },
  exerciseNameText: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.TEXT_PRIMARY,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  muscleText: {
    color: "#FF4500",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
    fontFamily: FONT_FAMILIES.MONO,
  },
  removeBtn: {
    padding: 8,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  labelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionLabel: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 10,
    fontFamily: FONT_FAMILIES.MONO,
    fontWeight: "700",
    letterSpacing: 1,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: withAlpha(COLORS.TEXT_PRIMARY, 0.05),
    borderRadius: UI.RADIUS_ITEM,
    paddingHorizontal: 4,
  },
  stepBtn: {
    padding: 8,
  },
  stepCount: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontFamily: FONT_FAMILIES.MONO,
    fontWeight: "700",
    minWidth: 20,
    textAlign: "center",
  },
  setStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    position: "relative",
  },
  setNode: {
    width: 36,
    height: 36,
    borderRadius: UI.RADIUS_ITEM,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  setNodeText: {
    fontSize: 14,
    fontFamily: FONT_FAMILIES.MONO,
    fontWeight: "900",
  },
  legendPopup: { position: "absolute", left: 0, top: -44 },
  gridRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  gridCell: {
    flex: 1,
    backgroundColor: withAlpha(COLORS.TEXT_PRIMARY, 0.03),
    padding: 12,
    borderRadius: UI.RADIUS_ITEM,
    borderWidth: 1,
    borderColor: withAlpha(COLORS.TEXT_PRIMARY, 0.05),
  },
  cellValue: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontFamily: FONT_FAMILIES.MONO,
    fontWeight: "700",
    marginTop: 6,
  },
  notesSection: {
    marginBottom: 4,
  },
  notesInput: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontFamily: FONT_FAMILIES.MEDIUM,
    paddingTop: 10,
    paddingBottom: 4,
    minHeight: 40,
  },
});
