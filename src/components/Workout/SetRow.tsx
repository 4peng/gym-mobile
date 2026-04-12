import React, { useCallback } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, LayoutAnimation, Keyboard } from "react-native";
import { Check, X } from "lucide-react-native";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import { toTitleCase } from "@/utils/string";
import type { ExerciseTrackingMode, WorkoutSet } from "@/types";
import { resolveSetOnComplete, type SetPlaceholder } from "@/utils/placeholders";
import { HapticFeedback } from "@/utils/haptics";

interface SetRowProps {
  set: WorkoutSet;
  index: number;
  placeholder: SetPlaceholder;
  exerciseId: string;
  exerciseName: string;
  restSeconds: number;
  trackingMode: ExerciseTrackingMode;
  weightUnit: "kg" | "lbs";
}

function InputBlock({
  label,
  value,
  placeholder,
  keyboardType,
  onChangeText,
  completed,
}: {
  label: string;
  value: string;
  placeholder: string;
  keyboardType: "decimal-pad" | "number-pad";
  onChangeText: (text: string) => void;
  completed: boolean;
}) {
  return (
    <View style={[styles.inputBlock, completed && styles.inputBlockCompleted]}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.inputText, completed && styles.inputTextCompleted]}
        keyboardType={keyboardType}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={COLORS.TEXT_TERTIARY}
        onChangeText={onChangeText}
      />
    </View>
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
  weightUnit,
}) {
  const updateSet = useWorkoutSessionStore((s) => s.updateSet);
  const toggleSetCompletion = useWorkoutSessionStore((s) => s.toggleSetCompletion);
  const removeSet = useWorkoutSessionStore((s) => s.removeSet);
  const startRestTimer = useWorkoutSessionStore((s) => s.startRestTimer);

  const isCompleted = !!set.completedAt;

  const handleWeightChange = useCallback(
    (text: string) => {
      const val = text === "" ? null : parseFloat(text);
      if (val !== null && isNaN(val)) return;
      updateSet(exerciseId, set.id, "weight", val);
    },
    [exerciseId, set.id, updateSet]
  );

  const handleRepsChange = useCallback(
    (text: string) => {
      const val = text === "" ? null : parseInt(text, 10);
      if (val !== null && isNaN(val)) return;
      updateSet(exerciseId, set.id, "reps", val);
    },
    [exerciseId, set.id, updateSet]
  );

  const handleDurationChange = useCallback(
    (text: string) => {
      const val = text === "" ? null : parseInt(text, 10);
      if (val !== null && isNaN(val)) return;
      updateSet(exerciseId, set.id, "durationSeconds", val);
    },
    [exerciseId, set.id, updateSet]
  );

  const handleDistanceChange = useCallback(
    (text: string) => {
      const val = text === "" ? null : parseFloat(text);
      if (val !== null && isNaN(val)) return;
      updateSet(exerciseId, set.id, "distance", val);
    },
    [exerciseId, set.id, updateSet]
  );

  const handleToggleComplete = useCallback(() => {
    if (!isCompleted) {
      Keyboard.dismiss();

      if (trackingMode === "strength") {
        const resolved = resolveSetOnComplete(set, placeholder);
        if (set.weight === null) updateSet(exerciseId, set.id, "weight", resolved.weight);
        if (set.reps === null) updateSet(exerciseId, set.id, "reps", resolved.reps);
      } else if (trackingMode === "timed") {
        if (set.durationSeconds == null) updateSet(exerciseId, set.id, "durationSeconds", 0);
      } else {
        if (set.durationSeconds == null) updateSet(exerciseId, set.id, "durationSeconds", 0);
        if (set.distance == null) updateSet(exerciseId, set.id, "distance", 0);
      }

      if (restSeconds > 0) {
        startRestTimer(exerciseId, restSeconds, toTitleCase(exerciseName));
      }
      HapticFeedback.medium();
    } else {
      HapticFeedback.light();
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    toggleSetCompletion(exerciseId, set.id);
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

  const handleRemove = useCallback(() => {
    removeSet(exerciseId, set.id);
  }, [exerciseId, set.id, removeSet]);

  const renderInputs = () => {
    if (trackingMode === "timed") {
      return (
        <InputBlock
          label="Time (sec)"
          value={
            set.durationSeconds !== null && set.durationSeconds !== undefined
              ? String(set.durationSeconds)
              : ""
          }
          placeholder="0"
          keyboardType="number-pad"
          onChangeText={handleDurationChange}
          completed={isCompleted}
        />
      );
    }

    if (trackingMode === "cardio") {
      return (
        <>
          <InputBlock
            label="Time (sec)"
            value={
              set.durationSeconds !== null && set.durationSeconds !== undefined
                ? String(set.durationSeconds)
                : ""
            }
            placeholder="0"
            keyboardType="number-pad"
            onChangeText={handleDurationChange}
            completed={isCompleted}
          />
          <InputBlock
            label="Distance"
            value={
              set.distance !== null && set.distance !== undefined ? String(set.distance) : ""
            }
            placeholder="0.00"
            keyboardType="decimal-pad"
            onChangeText={handleDistanceChange}
            completed={isCompleted}
          />
        </>
      );
    }

    return (
      <>
        <InputBlock
          label={`Weight (${weightUnit})`}
          value={set.weight !== null ? String(set.weight) : ""}
          placeholder={placeholder.weight !== null ? String(placeholder.weight) : weightUnit}
          keyboardType="decimal-pad"
          onChangeText={handleWeightChange}
          completed={isCompleted}
        />
        <InputBlock
          label="Reps"
          value={set.reps !== null ? String(set.reps) : ""}
          placeholder={placeholder.reps !== null ? String(placeholder.reps) : "-"}
          keyboardType="number-pad"
          onChangeText={handleRepsChange}
          completed={isCompleted}
        />
      </>
    );
  };

  return (
    <View style={[styles.rowCard, isCompleted && styles.rowCardCompleted]}>
      <View style={styles.rowTop}>
        <View style={[styles.setBadge, isCompleted && styles.setBadgeCompleted]}>
          <Text style={[styles.setBadgeText, isCompleted && styles.setBadgeTextCompleted]}>
            Set {index + 1}
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={handleToggleComplete}
            style={({ pressed }) => [
              isCompleted ? styles.checkButtonCompleted : styles.checkButton,
              pressed && styles.actionPressed,
            ]}
          >
            <Check
              size={isCompleted ? 13 : 16}
              color={isCompleted ? COLORS.BG : COLORS.ACCENT_GREEN}
              strokeWidth={3}
            />
          </Pressable>

          {!isCompleted ? (
            <Pressable onPress={handleRemove} hitSlop={10} style={styles.removeButton}>
              <X size={14} color={COLORS.DANGER} strokeWidth={3} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.inputsRow}>{renderInputs()}</View>
    </View>
  );
});

const styles = StyleSheet.create({
  rowCard: {
    borderRadius: 16,
    backgroundColor: COLORS.BG,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    padding: 10,
  },
  rowCardCompleted: {
    borderColor: "rgba(16, 217, 75, 0.18)",
    backgroundColor: "rgba(16, 217, 75, 0.05)",
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  setBadge: {
    minHeight: 24,
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  setBadgeCompleted: {
    backgroundColor: "rgba(16, 217, 75, 0.12)",
    borderColor: "rgba(16, 217, 75, 0.2)",
  },
  setBadgeText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  setBadgeTextCompleted: {
    color: COLORS.ACCENT_GREEN,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  checkButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.CARD_BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  checkButtonCompleted: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.ACCENT_GREEN,
    borderWidth: 1,
    borderColor: "rgba(16, 217, 75, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.94 }],
  },
  inputsRow: {
    flexDirection: "row",
    gap: 8,
  },
  inputBlock: {
    flex: 1,
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: COLORS.CARD_BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: "space-between",
  },
  inputBlockCompleted: {
    borderColor: "rgba(16, 217, 75, 0.16)",
  },
  inputLabel: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  inputText: {
    ...UI.SHARED.numericInput,
    textAlign: "left",
    fontSize: 17,
    fontFamily: FONT_FAMILIES.MEDIUM,
    fontWeight: "800",
    padding: 0,
    marginTop: 6,
  },
  inputTextCompleted: {
    color: COLORS.ACCENT_GREEN,
  },
});
