import React, { useCallback, useState } from "react";
import { LayoutAnimation, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Clock, Dumbbell, Hash, Minus, Plus, StickyNote, X } from "lucide-react-native";
import {
  COLORS,
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
          <Text style={[TYPE.mono, { color: COLORS.ACCENT_BLUE }]}>{index + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Pressable onPress={() => onOpenPicker("exercise", exercise.id)}>
            <Text style={TYPE.titleSm}>{exercise.name || "Select exercise"}</Text>
          </Pressable>
          <Pressable onPress={() => onOpenPicker("muscles", exercise.id)}>
            <Text style={styles.muscleText} numberOfLines={1}>
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
              <Pressable
                onPress={() => {
                  if (exercise.defaultSets.length <= 1) return;
                  animate();
                  update({ defaultSets: exercise.defaultSets.slice(0, -1) });
                }}
                style={styles.stepBtn}
              >
                <Minus size={14} color={COLORS.TEXT_PRIMARY} />
              </Pressable>
              <Text style={[TYPE.mono, styles.stepCount]}>{exercise.defaultSets.length}</Text>
              <Pressable
                onPress={() => {
                  animate();
                  update({ defaultSets: [...exercise.defaultSets, { type: "working" }] });
                }}
                style={styles.stepBtn}
              >
                <Plus size={14} color={COLORS.TEXT_PRIMARY} />
              </Pressable>
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
                  style={[
                    styles.setNode,
                    { backgroundColor: withAlpha(color, 0.1), borderColor: withAlpha(color, 0.4) },
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
            style={[UI.inset, styles.cell]}
          >
            <View style={styles.labelGroup}>
              <Clock size={12} color={COLORS.TEXT_TERTIARY} />
              <Text style={TYPE.label}>Rest</Text>
            </View>
            <Text style={styles.cellValue}>{formatSecondsToMMSS(exercise.restSeconds)}</Text>
          </Pressable>

          <Pressable
            onPress={() => update({ isBodyweight: !exercise.isBodyweight })}
            style={[UI.inset, styles.cell]}
          >
            <Text style={TYPE.label}>BW</Text>
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
            <Pressable
              onPress={() => update({ weightUnit: exercise.weightUnit === "lbs" ? "kg" : "lbs" })}
              style={[UI.inset, styles.cell]}
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
    width: 28,
    height: 24,
    borderRadius: RADIUS.sm,
    backgroundColor: SURFACE.blueTint,
    justifyContent: "center",
    alignItems: "center",
  },
  muscleText: { ...TYPE.monoSmall, color: COLORS.ORANGE, marginTop: 2 },
  content: { padding: SPACE.lg },
  section: { marginBottom: SPACE.xl },
  labelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm - 2,
    marginBottom: SPACE.sm,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingHorizontal: SPACE.xs,
  },
  stepBtn: { padding: SPACE.sm },
  stepCount: { minWidth: 20, textAlign: "center" },
  setStrip: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm, position: "relative" },
  setNode: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.item,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  legend: { position: "absolute", left: 0, top: -44 },
  gridRow: { flexDirection: "row", gap: SPACE.md, marginBottom: SPACE.xl },
  cell: { flex: 1, padding: SPACE.md },
  cellValue: { ...TYPE.monoMedium, marginTop: SPACE.xs },
  notesInput: { ...TYPE.bodyMuted, paddingTop: SPACE.sm, paddingBottom: SPACE.xs, minHeight: 40 },
});
