import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { COLORS, LAYOUT, RADIUS, SPACE, TYPE, UI } from "@/constants/theme";

export type ButtonTone = "neutral" | "primary" | "success" | "danger";
type Variant = "filled" | "outline";

const TONE: Record<ButtonTone, string> = {
  neutral: COLORS.TEXT_PRIMARY,
  primary: COLORS.ACCENT_BLUE,
  success: COLORS.ACCENT_GREEN,
  danger: COLORS.DANGER,
};

/** Foreground colour for a button's label and icon. */
export const buttonForeground = (tone: ButtonTone = "neutral", variant: Variant = "outline") =>
  variant === "filled" ? COLORS.BG : TONE[tone];

/** Outline colour for a button: the grey border for neutral, the tone colour otherwise. */
export const buttonOutline = (tone: ButtonTone = "neutral") =>
  tone === "neutral" ? COLORS.BORDER : TONE[tone];

interface ButtonProps {
  label: string;
  onPress: () => void;
  /** Icon drawn before the label; colour it with `buttonForeground(tone, variant)`. */
  icon?: ReactNode;
  tone?: ButtonTone;
  /** `outline` = 1px tone outline and text; `filled` = solid tone, dark text. */
  variant?: Variant;
  size?: "lg" | "md";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Text button; the labelled sibling of `IconButton` (same radius, heights, tones). */
export function Button({
  label,
  onPress,
  icon,
  tone = "neutral",
  variant = "outline",
  size = "lg",
  disabled,
  style,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { height: size === "lg" ? LAYOUT.buttonLg : LAYOUT.buttonMd },
        variant === "filled"
          ? { backgroundColor: TONE[tone], borderColor: TONE[tone] }
          : { borderColor: buttonOutline(tone) },
        disabled && UI.disabled,
        pressed && UI.pressed,
        style,
      ]}
    >
      {icon}
      <Text style={[TYPE.body, { color: buttonForeground(tone, variant) }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.item,
    borderWidth: 1,
  },
});
