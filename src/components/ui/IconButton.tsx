import type { ReactNode } from "react";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { COLORS, LAYOUT, RADIUS, UI } from "@/constants/theme";

type Tone = "neutral" | "primary" | "success" | "danger";

const BORDER: Record<Tone, string> = {
  neutral: COLORS.BORDER_LIGHT,
  primary: COLORS.ACCENT_BLUE,
  success: COLORS.ACCENT_GREEN,
  danger: COLORS.DANGER,
};

/** Icon colour that matches a tone; use it for the child icon. */
const ICON_TONE: Record<Tone, string> = {
  neutral: COLORS.TEXT_PRIMARY,
  primary: COLORS.ACCENT_BLUE,
  success: COLORS.ACCENT_GREEN,
  danger: COLORS.DANGER,
};

interface IconButtonProps {
  onPress?: () => void;
  onLongPress?: () => void;
  tone?: Tone;
  size?: "lg" | "md" | "sm";
  disabled?: boolean;
  /** Draw without the outline (inline icon tap targets). */
  ghost?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/** Square ghost button: transparent fill, 1px outline in the tone colour. */
export function IconButton({
  onPress,
  onLongPress,
  tone = "neutral",
  size = "lg",
  disabled,
  ghost,
  style,
  children,
}: IconButtonProps) {
  const px = size === "lg" ? LAYOUT.buttonLg : size === "md" ? LAYOUT.buttonMd : LAYOUT.buttonSm;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={ghost ? 8 : 0}
      style={({ pressed }) => [
        styles.base,
        { width: px, height: px, borderColor: ghost ? "transparent" : BORDER[tone] },
        disabled && styles.disabled,
        pressed && UI.pressed,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.item,
    borderWidth: 1,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.3 },
});
