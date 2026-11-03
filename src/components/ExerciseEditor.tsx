import React, { useCallback, useState } from "react";
import { LayoutAnimation, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Clock, Dumbbell, Hash, Minus, Plus, StickyNote, X } from "lucide-react-native";
import {
  COLORS,
  LAYOUT,
  RADIUS,
  SET_TYPE_COLORS,
  SPACE,
  SURFACE,
  TYPE,
  UI,
  withAlpha,
} from "@/constants/theme";
import { formatSecondsToMMSS } from "@/utils/conversions";
import { SetTypeLegend } from "@/components/Workout/SetTypeLegend";
import { IconButton } from "@/components/ui/IconButton";
import { formatMuscleLabels, type MuscleGroup } from "@/constants/muscles";
import type { ExerciseTrackingMode } from "@/types";
import { HapticFeedback } from "@/utils/haptics";
import { NEXT_SET_TYPE } from "@/shared/programs.js";

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

export type ExerciseEditorPicker = "exercise" | "muscles" | "rest";

interface ExerciseEditorProps {
  exercise: ExerciseFormData;
  index: number;
  onUpdate: (id: string, updates: Partial<Omit<ExerciseFormData, "id">>) => void;
  onRemove: (id: string) => void;
  /** Pickers are rendered by the screen so they float over the whole form, not one card. */
  onOpenPicker: (picker: ExerciseEditorPicker, exerciseId: string) => void;
}

const SET_INITIAL = { warmup: "U", working: "W", dropset: "D" } as const;

/** One exercise row of the routine editor: name, muscles, set template, rest, unit, notes. */
const ExerciseEditor = React.memo<ExerciseEditorProps>(function ExerciseEditor({
  exercise,
  index,
  onUpdate,
  onRemove,
  onOpenPicker,
}) {
  const [showLegend, setShowLegend] = useState(false);

  const update = useCallback(
    (updates: Partial<Omit<ExerciseFormData, "id">>) => onUpdate(exercise.id, updates),
    [exercise.id, onUpdate],
  );
  const animate = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

  const toggleSetType = (i: number) => {
    HapticFeedback.selection();
    const next = [...exercise.defaultSets];
    next[i] = { type: NEXT_SET_TYPE[next[i].type] };
    update({ defaultSets: next });
  };

  return (
    <View style={[UI.card, styles.shell]}>
      <View style={styles.header}>
        <View style={styles.indexBadge}>
          <Text style={[TYPE.mono, { color: COLORS.TEXT_SECONDARY }]}>{index + 1}</Text>
        </View>
        <View style={styles.grow}>
          <Pressable
            onPress={() => onOpenPicker("exercise", exercise.id)}
            style={({ pressed }) => pressed && UI.pressed}
          >
            <Text style={TYPE.titleSm}>{exercise.name || "Select exercise"}</Text>
          </Pressable>
          <Pressable
            onPress={() => onOpenPicker("muscles", exercise.id)}
            style={({ pressed }) => pressed && UI.pressed}
          >
            <Text style={[TYPE.monoSmall, styles.muscleText]} numberOfLines={1}>
              {formatMuscleLabels(exercise.muscles).toUpperCase()}
            </Text>
          </Pressable>
        </View>
        <IconButton
          size="sm"
          ghost
          tone="danger"
          onPress={() => {
            animate();
            onRemove(exercise.id);
          }}
        >
          <X size={18} color={COLORS.DANGER} />
        </IconButton>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <View style={UI.rowBetween}>
            <View style={styles.labelGroup}>
              <Hash size={12} color={COLORS.TEXT_TERTIARY} />
              <Text style={TYPE.label}>Sets</Text>
            </View>
            <View style={[UI.inset, styles.stepper]}>
              <IconButton
                size="sm"
                ghost
                disabled={exercise.defaultSets.length <= 1}
                onPress={() => {
                  animate();
                  update({ defaultSets: exercise.defaultSets.slice(0, -1) });
                }}
              >
                <Minus size={14} color={COLORS.TEXT_PRIMARY} />
              </IconButton>
              <Text style={[TYPE.mono, styles.stepCount]}>{exercise.defaultSets.length}</Text>
              <IconButton
                size="sm"
                ghost
                onPress={() => {
                  animate();
                  update({ defaultSets: [...exercise.defaultSets, { type: "working" }] });
                }}
              >
                <Plus size={14} color={COLORS.TEXT_PRIMARY} />
              </IconButton>
            </View>
          </View>

          <View style={styles.setStrip}>
            {exercise.defaultSets.map((set, i) => {
              const color = SET_TYPE_COLORS[set.type];
              return (
                <Pressable
                  key={i}
                  onPress={() => toggleSetType(i)}
                  onLongPress={() => {
                    HapticFeedback.selection();
                    setShowLegend(true);
                  }}
                  onPressOut={() => setShowLegend(false)}
                  delayLongPress={300}
                  style={({ pressed }) => [
                    styles.setNode,
                    { backgroundColor: withAlpha(color, 0.1), borderColor: withAlpha(color, 0.4) },
                    pressed && UI.pressed,
                  ]}
                >
                  <Text style={[TYPE.mono, { color }]}>{SET_INITIAL[set.type]}</Text>
                </Pressable>
              );
            })}
            {showLegend && <SetTypeLegend style={styles.legend} />}
          </View>
        </View>

        <View style={styles.gridRow}>
          <Pressable
            onPress={() => onOpenPicker("rest", exercise.id)}
            style={({ pressed }) => [UI.inset, styles.cell, pressed && UI.pressed]}
          >
            <View style={styles.labelGroup}>
              <Clock size={12} color={COLORS.TEXT_TERTIARY} />
              <Text style={TYPE.label}>Rest</Text>
            </View>
            <Text style={styles.cellValue}>{formatSecondsToMMSS(exercise.restSeconds)}</Text>
          </Pressable>

          <Pressable
            onPress={() => update({ isBodyweight: !exercise.isBodyweight })}
            style={({ pressed }) => [UI.inset, styles.cell, pressed && UI.pressed]}
          >
            <Text style={TYPE.label}>BW</Text>
            <Text
              style={[
                styles.cellValue,
                { color: exercise.isBodyweight ? COLORS.ACCENT_BLUE : COLORS.TEXT_TERTIARY },
              ]}
            >
              {exercise.isBodyweight ? "ON" : "OFF"}
            </Text>
          </Pressable>

          {!exercise.isBodyweight && (
            <Pressable
              onPress={() => update({ weightUnit: exercise.weightUnit === "lbs" ? "kg" : "lbs" })}
              style={({ pressed }) => [UI.inset, styles.cell, pressed && UI.pressed]}
            >
              <View style={styles.labelGroup}>
                <Dumbbell size={12} color={COLORS.TEXT_TERTIARY} />
                <Text style={TYPE.label}>Unit</Text>
              </View>
              <Text style={[styles.cellValue, { color: COLORS.ACCENT_BLUE }]}>
                {(exercise.weightUnit || "kg").toUpperCase()}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.labelGroup}>
          <StickyNote size={12} color={COLORS.TEXT_TERTIARY} />
          <Text style={TYPE.label}>Notes</Text>
        </View>
        <TextInput
          style={styles.notesInput}
          value={exercise.notes}
          onChangeText={(notes) => update({ notes })}
          placeholder="Execution cues, setup, etc."
          placeholderTextColor={COLORS.TEXT_TERTIARY}
          multiline
        />
      </View>
    </View>
  );
});

export default ExerciseEditor;

const styles = StyleSheet.create({
  shell: { marginBottom: SPACE.lg, overflow: "hidden" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACE.lg,
    backgroundColor: SURFACE.raised,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE.hairline,
    gap: SPACE.md,
  },
  indexBadge: {
    minWidth: SPACE.xxl,
    height: SPACE.xxl,
    paddingHorizontal: SPACE.xs,
    justifyContent: "center",
    alignItems: "center",
  },
  grow: { flex: 1 },
  muscleText: { color: COLORS.TEXT_SECONDARY, marginTop: SPACE.xs },
  content: { padding: SPACE.lg },
  section: { marginBottom: SPACE.xl },
  labelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    marginBottom: SPACE.sm,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingHorizontal: SPACE.xs,
  },
  stepCount: { minWidth: SPACE.xl, textAlign: "center" },
  setStrip: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm, position: "relative" },
  setNode: {
    width: LAYOUT.buttonSm,
    height: LAYOUT.buttonSm,
    borderRadius: RADIUS.item,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  legend: { position: "absolute", left: 0, top: -(LAYOUT.buttonMd + SPACE.xs) },
  gridRow: { flexDirection: "row", gap: SPACE.md, marginBottom: SPACE.xl },
  cell: { flex: 1, padding: SPACE.md },
  cellValue: { ...TYPE.monoMedium, marginTop: SPACE.xs },
  notesInput: {
    ...TYPE.bodyMuted,
    paddingTop: SPACE.sm,
    paddingBottom: SPACE.xs,
    minHeight: LAYOUT.buttonMd,
  },
});
