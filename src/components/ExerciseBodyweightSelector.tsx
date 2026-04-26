import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronDown, Dumbbell, User } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";

interface ExerciseBodyweightSelectorProps {
  isBodyweight: boolean;
  onToggle: () => void;
  compact?: boolean;
}

export default function ExerciseBodyweightSelector({
  isBodyweight,
  onToggle,
  compact = false,
}: ExerciseBodyweightSelectorProps) {
  const Icon = isBodyweight ? User : Dumbbell;
  const label = isBodyweight ? "Bodyweight" : "Weighted";
  const accent = isBodyweight ? COLORS.ACCENT_GREEN : COLORS.ACCENT_BLUE;

  if (compact) {
    return (
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.compactTrigger, pressed && styles.triggerPressed]}
      >
        <Icon size={15} color={accent} strokeWidth={2.3} />
        <ChevronDown size={14} color={COLORS.TEXT_TERTIARY} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
    >
      <View style={styles.triggerLeft}>
        <View style={[styles.iconShell, { backgroundColor: `${accent}14`, borderColor: `${accent}28` }]}>
          <Icon size={14} color={accent} strokeWidth={2.3} />
        </View>
        <View style={styles.triggerCopy}>
          <Text style={styles.triggerLabel}>Load Type</Text>
          <Text style={styles.triggerValue}>{label}</Text>
        </View>
      </View>
      <View style={styles.triggerRight}>
        <Text style={styles.triggerHint}>
          {isBodyweight ? "Uses your weight" : "Log plate weight"}
        </Text>
        <ChevronDown size={16} color={COLORS.TEXT_TERTIARY} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  compactTrigger: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    backgroundColor: COLORS.BG,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    backgroundColor: COLORS.BG,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
    flex: 1,
  },
  triggerPressed: {
    opacity: 0.82,
  },
  triggerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconShell: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  triggerCopy: {
    flex: 1,
  },
  triggerLabel: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.9,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  triggerValue: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
    marginTop: 1,
  },
  triggerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "48%",
  },
  triggerHint: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 11,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
});
