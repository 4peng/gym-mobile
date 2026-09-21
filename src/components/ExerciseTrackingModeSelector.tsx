import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";
import { COLORS, RADIUS, SPACE, SURFACE, TYPE, UI } from "@/constants/theme";
import type { ExerciseTrackingMode } from "@/types";
import { EXERCISE_TRACKING_OPTIONS, getTrackingModeLabel } from "@/utils/exerciseTracking";
import { useSheet } from "@/hooks/useSheet";

interface AnchorLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ExerciseTrackingModeSelectorProps {
  value: ExerciseTrackingMode;
  onChange: (trackingMode: ExerciseTrackingMode) => void;
  visible: boolean;
  onClose: () => void;
  /** Window-space layout of the trigger; the menu drops down below it. */
  anchorLayout?: AnchorLayout;
}

/** Dropdown anchored to its trigger (the only non-sheet overlay in the app). */
export default function ExerciseTrackingModeSelector({
  value,
  onChange,
  visible,
  onClose,
  anchorLayout,
}: ExerciseTrackingModeSelectorProps) {
  const { mounted, progress } = useSheet(visible && !!anchorLayout);
  if (!mounted || !anchorLayout) return null;

  const menuStyle = {
    top: anchorLayout.y + anchorLayout.height + SPACE.xs,
    left: anchorLayout.x,
    width: Math.max(140, anchorLayout.width * 1.5),
  };

  return (
    <View style={[UI.fill, styles.overlay]} pointerEvents="box-none">
      <Animated.View style={[UI.fill, styles.backdrop, { opacity: progress }]}>
        <Pressable style={UI.fill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.menu, UI.shadow, menuStyle, { opacity: progress }]}>
        {EXERCISE_TRACKING_OPTIONS.map((option) => {
          const isSelected = option === value;
          return (
            <Pressable
              key={option}
              onPress={() => {
                onChange(option);
                onClose();
              }}
              style={({ pressed }) => [
                styles.option,
                isSelected && styles.optionSelected,
                pressed && UI.pressed,
              ]}
            >
              <Text
                style={[TYPE.label, styles.optionText, isSelected && { color: COLORS.ACCENT_BLUE }]}
              >
                {getTrackingModeLabel(option)}
              </Text>
              {isSelected && <Check size={12} color={COLORS.ACCENT_BLUE} strokeWidth={3} />}
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 1000 },
  backdrop: { backgroundColor: SURFACE.backdrop, opacity: 0.6 },
  menu: {
    position: "absolute",
    backgroundColor: COLORS.CARD_BG,
    borderRadius: RADIUS.item,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: SPACE.xs,
    zIndex: 1000,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm + 2,
    borderRadius: RADIUS.sm,
    gap: SPACE.sm,
  },
  optionSelected: { backgroundColor: SURFACE.blueTint },
  optionText: { color: COLORS.TEXT_SECONDARY, letterSpacing: 0.5 },
});
