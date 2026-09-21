import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { COLORS, LAYOUT, RADIUS, SPACE, TYPE, UI } from "@/constants/theme";

type Tone = "neutral" | "primary" | "success" | "danger";
type Variant = "filled" | "outline";

const TONE: Record<Tone, string> = {
  neutral: COLORS.TEXT_PRIMARY,
  primary: COLORS.ACCENT_BLUE,
  success: COLORS.ACCENT_GREEN,
  danger: COLORS.DANGER,
};

/** Foreground colour for a button's label and icon. */
export const buttonForeground = (tone: Tone = "neutral", variant: Variant = "outline") =>
  variant === "filled" ? COLORS.BG : TONE[tone];

interface ButtonProps {
  label: string;
  onPress: () => void;
  /** Icon drawn before the label; colour it with `buttonForeground(tone, variant)`. */
  icon?: ReactNode;
  tone?: Tone;
  /** `outline` = 1px outline, tone-coloured text. `filled` = solid tone colour, dark text. */
  variant?: Variant;
  size?: "lg" | "md";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Text button. The labelled sibling of `IconButton`: same radius, heights and tones. */
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
  const outline = tone === "neutral" ? COLORS.BORDER : TONE[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { height: size === "lg" ? LAYOUT.buttonLg : LAYOUT.buttonMd },
        variant === "filled"
          ? { backgroundColor: TONE[tone] }
          : { borderWidth: 1, borderColor: outline },
        disabled && styles.disabled,
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
  },
  disabled: { opacity: 0.3 },
});
