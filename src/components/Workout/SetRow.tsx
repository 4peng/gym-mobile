import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Check, X } from "lucide-react-native";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { COLORS, RADIUS, SET_TYPE_COLORS, SPACE, SURFACE, TYPE, UI } from "@/constants/theme";
import { toTitleCase } from "@/utils/string";
import type { ExerciseTrackingMode, WorkoutSet } from "@/types";
import { resolveSetOnComplete, type SetPlaceholder } from "@/utils/placeholders";
import { HapticFeedback } from "@/utils/haptics";
import { SetTypeLegend } from "./SetTypeLegend";

interface SetRowProps {
  set: WorkoutSet;
  index: number;
  placeholder: SetPlaceholder;
  exerciseId: string;
  exerciseName: string;
  restSeconds: number;
  trackingMode: ExerciseTrackingMode;
}

/** Numeric cell. Decimal fields keep a local draft so "12." survives typing. */
function NumberCell({
  value,
  placeholder,
  decimal,
  completed,
  onCommit,
}: {
  value: number | null | undefined;
  placeholder: string;
  decimal?: boolean;
  completed: boolean;
  onCommit: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!focused) setDraft(value == null ? "" : String(value));
  }, [focused, value]);

  const handleChange = (text: string) => {
    const normalized = decimal ? text.replace(",", ".") : text;
    setDraft(normalized);
    if (normalized === "") return onCommit(null);
    if (decimal && normalized.endsWith(".")) return;
    const parsed = decimal ? Number(normalized) : parseInt(normalized, 10);
    if (Number.isFinite(parsed)) onCommit(parsed);
  };

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.inputCell}>
      <TextInput
        ref={inputRef}
        style={[styles.inputText, completed && styles.inputTextCompleted]}
        keyboardType={decimal ? "decimal-pad" : "number-pad"}
        value={draft}
        placeholder={placeholder}
        placeholderTextColor={COLORS.TEXT_TERTIARY}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </Pressable>
  );
}

export const SetRow = React.memo<SetRowProps>(function SetRow({
  set,
  index,
  placeholder,
  exerciseId,
  exerciseName,
  restSeconds,
  trackingMode,
}) {
  const updateSet = useWorkoutSessionStore((s) => s.updateSet);
  const toggleSetCompletion = useWorkoutSessionStore((s) => s.toggleSetCompletion);
  const toggleSetType = useWorkoutSessionStore((s) => s.toggleSetType);
  const removeSet = useWorkoutSessionStore((s) => s.removeSet);
  const startRestTimer = useWorkoutSessionStore((s) => s.startRestTimer);
  const [showLegend, setShowLegend] = useState(false);
  const isCompleted = !!set.completedAt;

  const commit = useCallback(
    (field: "weight" | "reps" | "durationSeconds" | "distance") => (value: number | null) =>
      updateSet(exerciseId, set.id, field, value),
    [exerciseId, set.id, updateSet],
  );

  const handleToggleComplete = useCallback(() => {
    if (!isCompleted) {
      Keyboard.dismiss();
      if (trackingMode === "strength") {
        const resolved = resolveSetOnComplete(set, placeholder);
        if (set.weight === null) updateSet(exerciseId, set.id, "weight", resolved.weight);
        if (set.reps === null) updateSet(exerciseId, set.id, "reps", resolved.reps);
      } else {
        if (set.durationSeconds == null) updateSet(exerciseId, set.id, "durationSeconds", 0);
        if (trackingMode === "cardio" && set.distance == null)
          updateSet(exerciseId, set.id, "distance", 0);
      }
      HapticFeedback.medium();
    } else {
      HapticFeedback.light();
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    toggleSetCompletion(exerciseId, set.id);
    if (!isCompleted && restSeconds > 0)
      void startRestTimer(exerciseId, restSeconds, toTitleCase(exerciseName));
  }, [
    exerciseId,
    exerciseName,
    isCompleted,
    placeholder,
    restSeconds,
    set,
    startRestTimer,
    toggleSetCompletion,
    trackingMode,
    updateSet,
  ]);

  const setTypeColor = SET_TYPE_COLORS[set.type ?? "working"];

  return (
    <View style={[styles.row, isCompleted && styles.rowCompleted]}>
      <Pressable
        style={styles.indexCell}
        onPress={() => {
          HapticFeedback.selection();
          toggleSetType(exerciseId, set.id);
        }}
        onLongPress={() => {
          HapticFeedback.selection();
          setShowLegend(true);
        }}
        onPressOut={() => setShowLegend(false)}
        delayLongPress={300}
        hitSlop={8}
      >
        <Text style={[TYPE.monoSmall, { color: setTypeColor }]}>{index + 1}</Text>
      </Pressable>
      {showLegend && <SetTypeLegend style={styles.legend} />}

      <View style={styles.inputs}>
        {trackingMode === "strength" ? (
          <>
            <NumberCell
              value={set.weight}
              placeholder={placeholder.weight !== null ? String(placeholder.weight) : "-"}
              decimal
              completed={isCompleted}
              onCommit={commit("weight")}
            />
            <NumberCell
              value={set.reps}
              placeholder={placeholder.reps !== null ? String(placeholder.reps) : "-"}
              completed={isCompleted}
              onCommit={commit("reps")}
            />
          </>
        ) : (
          <>
            <NumberCell
              value={set.durationSeconds}
              placeholder="0"
              completed={isCompleted}
              onCommit={commit("durationSeconds")}
            />
            {trackingMode === "cardio" ? (
              <NumberCell
                value={set.distance}
                placeholder="0.00"
                decimal
                completed={isCompleted}
                onCommit={commit("distance")}
              />
            ) : null}
          </>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={handleToggleComplete}
          style={({ pressed }) => [
            styles.check,
            isCompleted && styles.checkCompleted,
            pressed && UI.pressed,
          ]}
        >
          {isCompleted ? <Check size={14} color={COLORS.ACCENT_GREEN} strokeWidth={3} /> : null}
        </Pressable>
        {!isCompleted ? (
          <Pressable
            onPress={() => removeSet(exerciseId, set.id)}
            hitSlop={10}
            style={styles.remove}
          >
            <X size={12} color={COLORS.DANGER} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

export const SET_ROW_LAYOUT = {
  indexWidth: 32,
  inputWidth: 72,
  gap: SPACE.md,
  actionsWidth: 60,
} as const;

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", minHeight: 44, paddingHorizontal: SPACE.xs },
  rowCompleted: { backgroundColor: COLORS.ACCENT_GREEN_DEEP, borderRadius: RADIUS.item },
  indexCell: { width: SET_ROW_LAYOUT.indexWidth, alignItems: "center", justifyContent: "center" },
  legend: { position: "absolute", left: 40, top: -40 },
  inputs: { flex: 1, flexDirection: "row", justifyContent: "center", gap: SET_ROW_LAYOUT.gap },
  inputCell: {
    width: SET_ROW_LAYOUT.inputWidth,
    height: 32,
    backgroundColor: SURFACE.raised,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    justifyContent: "center",
  },
  inputText: { ...TYPE.mono, textAlign: "center", padding: 0 },
  inputTextCompleted: { color: COLORS.ACCENT_GREEN },
  actions: {
    width: SET_ROW_LAYOUT.actionsWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: SPACE.sm,
    paddingRight: SPACE.xs,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCompleted: { borderColor: COLORS.ACCENT_GREEN },
  remove: { padding: SPACE.xs },
});
