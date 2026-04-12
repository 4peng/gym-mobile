import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Activity, Check, ChevronDown, Dumbbell, Timer } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import type { ExerciseTrackingMode } from "@/types";
import type { LucideIcon } from "lucide-react-native";
import {
  EXERCISE_TRACKING_OPTIONS,
  getTrackingModeLabel,
} from "@/utils/exerciseTracking";

interface ExerciseTrackingModeSelectorProps {
  value: ExerciseTrackingMode;
  onChange: (trackingMode: ExerciseTrackingMode) => void;
  compact?: boolean;
}

const MODE_META: Record<
  ExerciseTrackingMode,
  { icon: LucideIcon; caption: string }
> = {
  strength: { icon: Dumbbell, caption: "Weight and reps" },
  timed: { icon: Timer, caption: "Duration only" },
  cardio: { icon: Activity, caption: "Time and distance" },
};

export default function ExerciseTrackingModeSelector({
  value,
  onChange,
  compact = false,
}: ExerciseTrackingModeSelectorProps) {
  const [visible, setVisible] = useState(false);
  const { icon: SelectedIcon, caption } = MODE_META[value];

  return (
    <>
      {compact ? (
        <Pressable
          onPress={() => setVisible(true)}
          style={({ pressed }) => [styles.compactTrigger, pressed && styles.triggerPressed]}
        >
          <SelectedIcon size={15} color={COLORS.ACCENT_BLUE} strokeWidth={2.3} />
          <ChevronDown size={14} color={COLORS.TEXT_TERTIARY} />
        </Pressable>
      ) : (
        <Pressable
          onPress={() => setVisible(true)}
          style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
        >
          <View style={styles.triggerLeft}>
            <View style={styles.iconShell}>
              <SelectedIcon size={14} color={COLORS.ACCENT_BLUE} strokeWidth={2.3} />
            </View>
            <View style={styles.triggerCopy}>
              <Text style={styles.triggerLabel}>Type</Text>
              <Text style={styles.triggerValue}>{getTrackingModeLabel(value)}</Text>
            </View>
          </View>
          <View style={styles.triggerRight}>
            <Text style={styles.triggerHint}>{caption}</Text>
            <ChevronDown size={16} color={COLORS.TEXT_TERTIARY} />
          </View>
        </Pressable>
      )}

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setVisible(false)} />

          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Exercise Type</Text>
            </View>

            <View style={styles.options}>
              {EXERCISE_TRACKING_OPTIONS.map((option) => {
                const selected = option === value;
                const { icon: Icon, caption: optionCaption } = MODE_META[option];

                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      onChange(option);
                      setVisible(false);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      selected && styles.optionSelected,
                      pressed && styles.optionPressed,
                    ]}
                  >
                    <View style={styles.optionLeft}>
                      <View style={[styles.optionIconShell, selected && styles.optionIconShellSelected]}>
                        <Icon
                          size={15}
                          color={selected ? COLORS.ACCENT_BLUE : COLORS.TEXT_SECONDARY}
                          strokeWidth={2.3}
                        />
                      </View>
                      <View>
                        <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                          {getTrackingModeLabel(option)}
                        </Text>
                        <Text style={styles.optionCaption}>{optionCaption}</Text>
                      </View>
                    </View>

                    {selected ? <Check size={18} color={COLORS.ACCENT_BLUE} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
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
    backgroundColor: "rgba(11, 130, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(11, 130, 255, 0.16)",
    alignItems: "center",
    justifyContent: "center",
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
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.CARD_BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 28,
  },
  sheetHeader: {
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  sheetTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  options: {
    gap: 8,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    backgroundColor: COLORS.BG,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  optionSelected: {
    borderColor: "rgba(11, 130, 255, 0.2)",
    backgroundColor: "rgba(11, 130, 255, 0.06)",
  },
  optionPressed: {
    opacity: 0.82,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  optionIconShell: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.CARD_BG,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  optionIconShellSelected: {
    backgroundColor: "rgba(11, 130, 255, 0.08)",
    borderColor: "rgba(11, 130, 255, 0.18)",
  },
  optionText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
  optionTextSelected: {
    color: COLORS.ACCENT_BLUE,
  },
  optionCaption: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 12,
    marginTop: 2,
    fontFamily: FONT_FAMILIES.MEDIUM,
  },
});
