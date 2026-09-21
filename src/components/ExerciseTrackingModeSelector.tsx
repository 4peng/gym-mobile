import { Pressable, StyleSheet, Text, View, Animated } from "react-native";
import { Check } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
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
    top: anchorLayout.y + anchorLayout.height + 4,
    left: anchorLayout.x,
    width: Math.max(140, anchorLayout.width * 1.5),
  };

  return (
    <View style={styles.absoluteOverlay} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.menu, menuStyle, { opacity: progress }]}>
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
                pressed && styles.optionPressed,
              ]}
            >
              <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                {getTrackingModeLabel(option).toUpperCase()}
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
  absoluteOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  menu: {
    position: "absolute",
    backgroundColor: COLORS.BG,
    borderRadius: UI.RADIUS_ITEM,
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
  optionSelected: { backgroundColor: "rgba(0, 122, 255, 0.08)" },
  optionPressed: { backgroundColor: "rgba(255, 255, 255, 0.05)" },
  optionText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MONO,
  },
  optionTextSelected: { color: COLORS.ACCENT_BLUE },
});
