import React, { useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  LayoutAnimation,
} from "react-native";
import { Trash2, Hash, Clock, Dumbbell } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import { formatSecondsToMMSS } from "@/utils/conversions";
import RestTimerPicker from "./RestTimerPicker";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ExerciseFormData {
  id: string;
  name: string;
  defaultSets: number;
  restSeconds: number;
  notes: string;
  weightUnit?: "kg" | "lbs";
}

interface ExerciseEditorProps {
  exercise: ExerciseFormData;
  index: number;
  onUpdate: (id: string, updates: Partial<Omit<ExerciseFormData, "id">>) => void;
  onRemove: (id: string) => void;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

const ExerciseEditor = React.memo<ExerciseEditorProps>(function ExerciseEditor({
  exercise,
  index,
  onUpdate,
  onRemove,
}) {
  const [pickerVisible, setPickerVisible] = useState(false);

  const handleNameChange = useCallback(
    (text: string) => onUpdate(exercise.id, { name: text }),
    [exercise.id, onUpdate]
  );

  const handleDefaultSetsChange = useCallback(
    (text: string) => {
      const val = parseInt(text, 10);
      if (text === "") {
        onUpdate(exercise.id, { defaultSets: 1 });
        return;
      }
      if (!isNaN(val) && val >= 1) {
        onUpdate(exercise.id, { defaultSets: val });
      }
    },
    [exercise.id, onUpdate]
  );

  const handleRestSave = useCallback((seconds: number) => {
    onUpdate(exercise.id, { restSeconds: seconds });
  }, [exercise.id, onUpdate]);

  const handleToggleUnit = useCallback(() => {
    const nextUnit = exercise.weightUnit === "lbs" ? "kg" : "lbs";
    onUpdate(exercise.id, { weightUnit: nextUnit });
  }, [exercise.id, exercise.weightUnit, onUpdate]);

  const handleNotesChange = useCallback(
    (text: string) => onUpdate(exercise.id, { notes: text }),
    [exercise.id, onUpdate]
  );

  const handleRemove = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onRemove(exercise.id);
  }, [exercise.id, onRemove]);

  return (
    <View style={UI.SHARED.card}>
      {/* Header Area */}
      <View style={styles.header}>
        <View style={styles.indexBadge}>
          <Text style={styles.indexLabel}>{String(index + 1).padStart(2, '0')}</Text>
        </View>
        <View style={styles.nameInputContainer}>
          <TextInput
            style={styles.nameInput}
            value={exercise.name}
            onChangeText={handleNameChange}
            placeholder="Exercise name"
            placeholderTextColor={COLORS.TEXT_TERTIARY}
          />
        </View>
        <Pressable 
          onPress={handleRemove} 
          hitSlop={12}
          style={({ pressed }) => [
            styles.removeBtn,
            pressed && { backgroundColor: "rgba(239, 68, 68, 0.15)" }
          ]}
        >
          <Trash2 size={18} color={COLORS.DANGER} />
        </Pressable>
      </View>

      {/* Settings Grid */}
      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <View style={styles.fieldHeader}>
            <Hash size={12} color={COLORS.TEXT_TERTIARY} />
            <Text style={styles.fieldLabel}>Sets</Text>
          </View>
          <TextInput
            style={styles.numericInput}
            keyboardType="number-pad"
            value={String(exercise.defaultSets)}
            onChangeText={handleDefaultSetsChange}
          />
        </View>

        <View style={styles.gridItem}>
          <View style={styles.fieldHeader}>
            <Clock size={12} color={COLORS.TEXT_TERTIARY} />
            <Text style={styles.fieldLabel}>Rest</Text>
          </View>
          <Pressable 
            style={({ pressed }) => [styles.pickerTrigger, pressed && { opacity: 0.7 }]}
            onPress={() => setPickerVisible(true)}
          >
            <Text style={styles.pickerText}>{formatSecondsToMMSS(exercise.restSeconds)}</Text>
          </Pressable>
        </View>

        <View style={styles.gridItem}>
          <View style={styles.fieldHeader}>
            <Dumbbell size={12} color={COLORS.TEXT_TERTIARY} />
            <Text style={styles.fieldLabel}>Unit</Text>
          </View>
          <Pressable 
            style={({ pressed }) => [styles.unitToggle, pressed && { opacity: 0.7 }]} 
            onPress={handleToggleUnit}
          >
            <Text style={styles.unitText}>{exercise.weightUnit || "kg"}</Text>
          </Pressable>
        </View>
      </View>

      {/* Notes Area */}
      <View style={styles.notesArea}>
        <View style={styles.fieldHeader}>
          <Text style={styles.fieldLabel}>Instructions / Notes</Text>
        </View>
        <TextInput
          style={styles.notesInput}
          value={exercise.notes}
          onChangeText={handleNotesChange}
          placeholder="Notes..."
          placeholderTextColor={COLORS.TEXT_TERTIARY}
          multiline
          numberOfLines={2}
        />
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

// ──────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    gap: 12,
  },
  indexBadge: {
    backgroundColor: "#1D1D21",
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  indexLabel: {
    color: COLORS.ACCENT_YELLOW,
    fontSize: 12,
    fontWeight: "900",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  nameInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.BG,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
  },
  nameInput: {
    flex: 1,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "700",
    paddingVertical: 14,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  removeBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(239, 68, 68, 0.05)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Grid
  grid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  gridItem: {
    flex: 1,
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    paddingLeft: 4,
  },
  fieldLabel: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  numericInput: {
    backgroundColor: COLORS.BG,
    color: COLORS.TEXT_PRIMARY,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    paddingVertical: 16,
    borderRadius: UI.RADIUS_INPUT,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
  },
  pickerTrigger: {
    backgroundColor: COLORS.BG,
    paddingVertical: 16,
    borderRadius: UI.RADIUS_INPUT,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  pickerText: {
    color: COLORS.TEXT_PRIMARY,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 18,
    fontWeight: "800",
  },
  unitToggle: {
    backgroundColor: COLORS.BG,
    paddingVertical: 16,
    borderRadius: UI.RADIUS_INPUT,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  unitText: {
    color: COLORS.ACCENT_YELLOW,
    fontSize: 16,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  // Notes
  notesArea: {
    marginTop: 4,
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
    minHeight: 80,
    fontFamily: FONT_FAMILIES.MEDIUM,
    lineHeight: 22,
  },
});
