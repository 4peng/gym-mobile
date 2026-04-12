import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import type { ExerciseDefinition } from "@/types";
import { toTitleCase } from "@/utils/string";
import ExercisePickerModal from "@/components/ExercisePickerModal";

interface ExercisePickerFieldProps {
  label?: string;
  placeholder?: string;
  value: string;
  selectedDefinitionId?: string;
  onSelect: (exercise: ExerciseDefinition) => void;
}

export default function ExercisePickerField({
  label = "Exercise",
  placeholder = "Select exercise",
  value,
  selectedDefinitionId,
  onSelect,
}: ExercisePickerFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={() => setVisible(true)}
        style={({ pressed }) => [
          styles.trigger,
          pressed && styles.triggerPressed,
        ]}
      >
        <View style={styles.triggerInfo}>
          {label ? <Text style={styles.triggerLabel}>{label}</Text> : null}
          <Text
            style={[
              styles.triggerValue,
              value.trim().length === 0 && styles.triggerPlaceholder,
              !label && styles.triggerValueCompact,
            ]}
            numberOfLines={1}
          >
            {value.trim().length > 0 ? toTitleCase(value) : placeholder}
          </Text>
        </View>
        <ChevronDown size={18} color={COLORS.TEXT_TERTIARY} />
      </Pressable>

      <ExercisePickerModal
        visible={visible}
        onClose={() => setVisible(false)}
        onSelect={onSelect}
        selectedDefinitionId={selectedDefinitionId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.BG,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    minHeight: 46,
  },
  triggerPressed: {
    opacity: 0.8,
  },
  triggerInfo: {
    flex: 1,
    marginRight: 12,
  },
  triggerLabel: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  triggerValue: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  triggerValueCompact: {
    fontSize: 17,
  },
  triggerPlaceholder: {
    color: COLORS.TEXT_TERTIARY,
  },
});
