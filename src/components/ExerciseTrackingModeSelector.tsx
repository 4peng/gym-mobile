import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Check } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import type { ExerciseTrackingMode } from "@/types";
import {
  EXERCISE_TRACKING_OPTIONS,
  getTrackingModeLabel,
} from "@/utils/exerciseTracking";

interface ExerciseTrackingModeSelectorProps {
  value: ExerciseTrackingMode;
  onChange: (trackingMode: ExerciseTrackingMode) => void;
  visible?: boolean;
  onClose?: () => void;
  anchorLayout?: { x: number; y: number; width: number; height: number };
}

export default function ExerciseTrackingModeSelector({
  value,
  onChange,
  visible,
  onClose,
  anchorLayout,
}: ExerciseTrackingModeSelectorProps) {
  if (!visible || !anchorLayout) return null;

  // Position the dropdown directly below the anchor
  const menuStyle = {
    top: anchorLayout.y + anchorLayout.height + 4,
    left: anchorLayout.x,
    width: Math.max(140, anchorLayout.width * 1.5),
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.menu, menuStyle]}>
          {EXERCISE_TRACKING_OPTIONS.map((option) => {
            const isSelected = option === value;
            return (
              <Pressable
                key={option}
                onPress={() => {
                  onChange(option);
                  onClose?.();
                }}
                style={({ pressed }) => [
                  styles.option,
                  isSelected && styles.optionSelected,
                  pressed && styles.optionPressed,
                ]}
              >
                <Text style={[
                  styles.optionText,
                  isSelected && styles.optionTextSelected
                ]}>
                  {getTrackingModeLabel(option).toUpperCase()}
                </Text>
                {isSelected && <Check size={12} color={COLORS.ACCENT_BLUE} strokeWidth={3} />}
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "transparent",
  },
  menu: {
    position: "absolute",
    backgroundColor: COLORS.BG,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    gap: 8,
  },
  optionSelected: {
    backgroundColor: "rgba(0, 122, 255, 0.08)",
  },
  optionPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  optionText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MONO,
  },
  optionTextSelected: {
    color: COLORS.ACCENT_BLUE,
  },
});
