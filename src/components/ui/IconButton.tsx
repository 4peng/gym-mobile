import type { ReactNode } from "react";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { LAYOUT, RADIUS, SPACE, UI } from "@/constants/theme";
import { buttonOutline, type ButtonTone } from "./Button";

const SIZE = { lg: LAYOUT.buttonLg, md: LAYOUT.buttonMd, sm: LAYOUT.buttonSm } as const;

interface IconButtonProps {
  onPress?: () => void;
  onLongPress?: () => void;
  tone?: ButtonTone;
  size?: keyof typeof SIZE;
  disabled?: boolean;
  /** Draw without the outline (inline icon tap targets). */
  ghost?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/** Square icon button: transparent fill, 1px outline in the tone colour (none when `ghost`). */
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
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={ghost ? SPACE.sm : 0}
      style={({ pressed }) => [
        styles.base,
        { width: SIZE[size], height: SIZE[size] },
        { borderColor: ghost ? "transparent" : buttonOutline(tone) },
        disabled && UI.disabled,
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
    alignItems: "center",
    justifyContent: "center",
  },
});
