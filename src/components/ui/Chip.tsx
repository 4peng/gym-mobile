import { Pressable, StyleSheet, Text } from "react-native";
import { COLORS, RADIUS, SPACE, SURFACE, TYPE, UI } from "@/constants/theme";

interface ChipProps {
  label: string;
  active?: boolean;
  onPress: () => void;
}

/** Toggleable filter pill. */
export function Chip({ label, active, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.active, pressed && UI.pressed]}
    >
      <Text style={[TYPE.bodyMuted, styles.text, active && styles.textActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.item,
    backgroundColor: SURFACE.raised,
    borderWidth: 1,
    borderColor: SURFACE.hairline,
  },
  active: { backgroundColor: SURFACE.blueTintStrong, borderColor: SURFACE.blueBorder },
  text: { color: COLORS.TEXT_TERTIARY, lineHeight: undefined },
  textActive: { color: COLORS.ACCENT_BLUE },
});
