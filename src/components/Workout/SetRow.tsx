import React, { useCallback } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, LayoutAnimation } from "react-native";
import { Check, X } from "lucide-react-native";
import { useWorkoutSessionStore } from "@/stores/workoutSessionStore";
import { COLORS } from "@/constants/colors";
import { UI } from "@/constants/ui";
import { toTitleCase } from "@/utils/string";
import type { WorkoutSet } from "@/types";
import { resolveSetOnComplete, type SetPlaceholder } from "@/utils/placeholders";
import { HapticFeedback } from "@/utils/haptics";

interface SetRowProps {
  set: WorkoutSet;
  index: number;
  placeholder: SetPlaceholder;
  exerciseId: string;
  exerciseName: string;
  restSeconds: number;
  weightUnit: "kg" | "lbs";
}

export const SetRow = React.memo<SetRowProps>(function SetRow({
  set,
  index,
  placeholder,
  exerciseId,
  exerciseName,
  restSeconds,
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

  const handleToggleComplete = useCallback(() => {
    if (!isCompleted) {
      const resolved = resolveSetOnComplete(set, placeholder);
      if (set.weight === null) updateSet(exerciseId, set.id, "weight", resolved.weight);
      if (set.reps === null) updateSet(exerciseId, set.id, "reps", resolved.reps);
      
      if (restSeconds > 0) {
        startRestTimer(exerciseId, restSeconds, toTitleCase(exerciseName));
      }
      HapticFeedback.medium();
    } else {
      HapticFeedback.light();
    }
    
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    toggleSetCompletion(exerciseId, set.id);
  }, [set, isCompleted, placeholder, exerciseId, updateSet, toggleSetCompletion, restSeconds, exerciseName, startRestTimer]);

  const handleRemove = useCallback(() => {
    removeSet(exerciseId, set.id);
  }, [exerciseId, set.id, removeSet]);

  return (
    <View style={styles.setRow}>
      {/* Index Column (15%) */}
      <View style={styles.indexCol}>
        <View style={[styles.setIndexContainer, isCompleted ? { backgroundColor: "rgba(16, 217, 75, 0.1)" } : { backgroundColor: "rgba(250, 204, 0, 0.1)" }]}>
          <Text style={[styles.setIndex, isCompleted ? { color: COLORS.ACCENT_GREEN } : { color: COLORS.ACCENT_YELLOW }]}>{index + 1}</Text>
        </View>
      </View>

      {/* Weight Column (30%) */}
      <View style={styles.weightCol}>
        <View style={[styles.setInputGroup, isCompleted ? { borderColor: "rgba(16, 217, 75, 0.2)" } : { borderColor: "rgba(250, 204, 0, 0.2)" }]}>
          <TextInput
            style={[UI.SHARED.numericInput, isCompleted ? { color: COLORS.ACCENT_GREEN } : { color: COLORS.ACCENT_YELLOW }]}
            keyboardType="decimal-pad"
            value={set.weight !== null ? String(set.weight) : ""}
            placeholder={placeholder.weight !== null ? String(placeholder.weight) : "—"}
            placeholderTextColor={COLORS.TEXT_TERTIARY}
            onChangeText={handleWeightChange}
            editable={!isCompleted}
          />
        </View>
      </View>

      {/* Reps Column (30%) */}
      <View style={styles.repsCol}>
        <View style={[styles.setInputGroup, isCompleted ? { borderColor: "rgba(16, 217, 75, 0.2)" } : { borderColor: "rgba(250, 204, 0, 0.2)" }]}>
          <TextInput
            style={[UI.SHARED.numericInput, isCompleted ? { color: COLORS.ACCENT_GREEN } : { color: COLORS.ACCENT_YELLOW }]}
            keyboardType="number-pad"
            value={set.reps !== null ? String(set.reps) : ""}
            placeholder={placeholder.reps !== null ? String(placeholder.reps) : "—"}
            placeholderTextColor={COLORS.TEXT_TERTIARY}
            onChangeText={handleRepsChange}
            editable={!isCompleted}
          />
        </View>
      </View>

      {/* Action Column (25%) */}
      <View style={styles.actionCol}>
        <Pressable 
          onPress={handleToggleComplete} 
          style={({ pressed }) => [
            isCompleted ? styles.checkMarkCircle : styles.completeBtn,
            pressed && { transform: [{scale: 0.92}], opacity: 0.8 }
          ]}
        >
          {isCompleted ? (
            <Check size={14} color={COLORS.BG} strokeWidth={4} />
          ) : (
            <Check size={18} color={COLORS.ACCENT_GREEN} strokeWidth={3} />
          )}
        </Pressable>

        {!isCompleted && (
          <Pressable onPress={handleRemove} hitSlop={12} style={styles.removeSetBtn}>
            <X size={16} color={COLORS.DANGER} strokeWidth={3} />
          </Pressable>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  indexCol: { width: '15%', alignItems: 'center' },
  weightCol: { width: '30%', alignItems: 'center', paddingHorizontal: 4 },
  repsCol: { width: '30%', alignItems: 'center', paddingHorizontal: 4 },
  actionCol: { width: '25%', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  setIndexContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#1D1D21",
    justifyContent: "center",
    alignItems: "center",
  },
  setIndex: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 11,
    fontWeight: "900",
  },
  setInputGroup: {
    width: '100%',
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    height: 48,
  },
  removeSetBtn: {
    padding: 4,
  },
  completeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
  },
  checkMarkCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.ACCENT_GREEN,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.BORDER_LIGHT,
  },
});
