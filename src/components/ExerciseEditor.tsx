import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  LayoutAnimation,
} from "react-native";
import { Trash2, Hash, Clock, Dumbbell } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import { formatSecondsToMMSS } from "@/utils/conversions";
import RestTimerPicker from "./RestTimerPicker";
import ExercisePickerField from "@/components/ExercisePickerField";
import ExerciseTrackingModeSelector from "@/components/ExerciseTrackingModeSelector";
import MuscleSelector from "@/src/components/MuscleSelector";
import { MuscleGroup } from "@/src/constants/muscles";
import type { ExerciseDefinition, ExerciseTrackingMode } from "@/types";
import { useExerciseLibraryStore } from "@/stores/exerciseLibraryStore";

export interface ExerciseFormData {
  id: string;
  exerciseDefinitionId?: string;
  trackingMode: ExerciseTrackingMode;
  name: string;
  defaultSets: number;
  restSeconds: number;
  notes: string;
  weightUnit?: "kg" | "lbs";
  initialWeight?: number | null;
  muscles: MuscleGroup[];
}

interface ExerciseEditorProps {
  exercise: ExerciseFormData;
  index: number;
  onUpdate: (id: string, updates: Partial<Omit<ExerciseFormData, "id">>) => void;
  onRemove: (id: string) => void;
}

function MetricCard({
  icon,
  label,
  value,
  onPress,
  accent = COLORS.TEXT_PRIMARY,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onPress?: () => void;
  accent?: string;
}) {
  const content = (
    <>
      <View style={styles.metricLabelRow}>
        {icon}
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, { color: accent }]}>{value}</Text>
    </>
  );

  if (!onPress) {
    return <View style={styles.metricCard}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.metricCard, pressed && styles.metricCardPressed]}
    >
      {content}
    </Pressable>
  );
}

const ExerciseEditor = React.memo<ExerciseEditorProps>(function ExerciseEditor({
  exercise,
  index,
  onUpdate,
  onRemove,
}) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [defaultSetsText, setDefaultSetsText] = useState(String(exercise.defaultSets));
  const updateCustomExerciseMuscles = useExerciseLibraryStore(
    (state) => state.updateCustomExerciseMuscles
  );

  useEffect(() => {
    setDefaultSetsText(String(exercise.defaultSets));
  }, [exercise.defaultSets, exercise.id]);

  const handleExerciseSelect = useCallback(
    (selectedExercise: ExerciseDefinition) => {
      onUpdate(exercise.id, {
        exerciseDefinitionId: selectedExercise.id,
        name: selectedExercise.name,
        muscles: selectedExercise.muscles,
      });
    },
    [exercise.id, onUpdate]
  );

  const handleDefaultSetsChange = useCallback(
    (text: string) => {
      if (!/^\d*$/.test(text)) {
        return;
      }

      setDefaultSetsText(text);

      const val = parseInt(text, 10);
      if (!isNaN(val) && val >= 1) {
        onUpdate(exercise.id, { defaultSets: val });
      }
    },
    [exercise.id, onUpdate]
  );

  const commitDefaultSets = useCallback(() => {
    const val = parseInt(defaultSetsText, 10);
    const normalized = !isNaN(val) && val >= 1 ? val : 1;
    setDefaultSetsText(String(normalized));
    onUpdate(exercise.id, { defaultSets: normalized });
  }, [defaultSetsText, exercise.id, onUpdate]);

  const handleRestSave = useCallback(
    (seconds: number) => {
      onUpdate(exercise.id, { restSeconds: seconds });
    },
    [exercise.id, onUpdate]
  );

  const handleToggleUnit = useCallback(() => {
    const nextUnit = exercise.weightUnit === "lbs" ? "kg" : "lbs";
    onUpdate(exercise.id, { weightUnit: nextUnit });
  }, [exercise.id, exercise.weightUnit, onUpdate]);

  const handleNotesChange = useCallback(
    (text: string) => onUpdate(exercise.id, { notes: text }),
    [exercise.id, onUpdate]
  );

  const handleTrackingModeChange = useCallback(
    (trackingMode: ExerciseTrackingMode) => {
      onUpdate(exercise.id, { trackingMode });
    },
    [exercise.id, onUpdate]
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
    [exercise.exerciseDefinitionId, exercise.id, onUpdate, updateCustomExerciseMuscles]
  );

  const handleRemove = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onRemove(exercise.id);
  }, [exercise.id, onRemove]);

  return (
    <View style={UI.SHARED.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.indexBadge}>
            <Text style={styles.indexLabel}>{String(index + 1).padStart(2, "0")}</Text>
          </View>
          <Text style={styles.headerTitle}>Exercise Setup</Text>
        </View>
        <Pressable
          onPress={handleRemove}
          hitSlop={12}
          style={({ pressed }) => [styles.removeBtn, pressed && styles.removeBtnPressed]}
        >
          <Trash2 size={18} color={COLORS.DANGER} />
        </Pressable>
      </View>

      <ExercisePickerField
        value={exercise.name}
        selectedDefinitionId={exercise.exerciseDefinitionId}
        onSelect={handleExerciseSelect}
      />

      <View style={styles.panel}>
        <Text style={styles.panelLabel}>Tracking Format</Text>
        <ExerciseTrackingModeSelector
          value={exercise.trackingMode}
          onChange={handleTrackingModeChange}
        />
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricFlex}>
          <View style={styles.metricCard}>
            <View style={styles.metricLabelRow}>
              <Hash size={12} color={COLORS.TEXT_TERTIARY} />
              <Text style={styles.metricLabel}>Sets</Text>
            </View>
            <TextInput
              style={styles.metricInput}
              keyboardType="number-pad"
              value={defaultSetsText}
              onChangeText={handleDefaultSetsChange}
              onBlur={commitDefaultSets}
              onEndEditing={commitDefaultSets}
            />
          </View>
        </View>

        <View style={styles.metricFlex}>
          <MetricCard
            icon={<Clock size={12} color={COLORS.TEXT_TERTIARY} />}
            label="Rest"
            value={formatSecondsToMMSS(exercise.restSeconds)}
            onPress={() => setPickerVisible(true)}
          />
        </View>

        {exercise.trackingMode === "strength" ? (
          <View style={styles.metricFlex}>
            <MetricCard
              icon={<Dumbbell size={12} color={COLORS.TEXT_TERTIARY} />}
              label="Unit"
              value={exercise.weightUnit || "kg"}
              onPress={handleToggleUnit}
              accent={COLORS.ACCENT_BLUE}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.notesBlock}>
        <Text style={styles.panelLabel}>Notes</Text>
        <TextInput
          style={styles.notesInput}
          value={exercise.notes}
          onChangeText={handleNotesChange}
          placeholder="Execution cues, machine setup, pacing..."
          placeholderTextColor={COLORS.TEXT_TERTIARY}
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.muscleSection}>
        <MuscleSelector selectedMuscles={exercise.muscles || []} onSelect={handleMusclesChange} />
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

export default ExerciseEditor;

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: "900",
    fontFamily: FONT_FAMILIES.MEDIUM,
    letterSpacing: -0.3,
  },
  indexBadge: {
    backgroundColor: "rgba(11, 130, 255, 0.12)",
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(11, 130, 255, 0.2)",
  },
  indexLabel: {
    color: COLORS.ACCENT_BLUE,
    fontSize: 12,
    fontWeight: "900",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  removeBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(239, 68, 68, 0.06)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.12)",
  },
  removeBtnPressed: {
    backgroundColor: "rgba(239, 68, 68, 0.14)",
  },
  panel: {
    marginTop: 18,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  panelLabel: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    flexWrap: "wrap",
  },
  metricFlex: {
    flex: 1,
    minWidth: 0,
  },
  metricCard: {
    minHeight: 82,
    borderRadius: 20,
    backgroundColor: COLORS.BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: "space-between",
  },
  metricCardPressed: {
    opacity: 0.82,
  },
  metricLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metricLabel: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "900",
    fontFamily: FONT_FAMILIES.MEDIUM,
    textTransform: "uppercase",
    letterSpacing: -0.4,
    marginTop: 10,
  },
  metricInput: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "900",
    fontFamily: FONT_FAMILIES.MEDIUM,
    textAlign: "left",
    padding: 0,
    marginTop: 10,
  },
  notesBlock: {
    marginTop: 18,
  },
  notesInput: {
    backgroundColor: COLORS.BG,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: UI.RADIUS_INPUT,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    textAlignVertical: "top",
    minHeight: 96,
    fontFamily: FONT_FAMILIES.MEDIUM,
    lineHeight: 22,
    marginTop: 10,
  },
  muscleSection: {
    marginTop: 22,
  },
});
