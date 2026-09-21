import type { ReactNode } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS, RADIUS, SPACE, SURFACE, TYPE, UI } from "@/constants/theme";
import { useDragToClose, useSheet } from "@/hooks/useSheet";

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Slot left of the title (e.g. cancel button). */
  headerLeft?: ReactNode;
  /** Slot right of the title (e.g. confirm button). */
  headerRight?: ReactNode;
  /** Bottom sheet (default) or centred dialog. */
  placement?: "bottom" | "center";
  /** Allow swipe-down to dismiss (bottom sheets only). */
  dragToClose?: boolean;
  /** Called when the backdrop is tapped; defaults to onClose. */
  onBackdropPress?: () => void;
  children: ReactNode;
}

/**
 * The app's only overlay container: absolute view + 180ms animation, no native
 * Modal. Stays mounted until the close animation finishes.
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  headerLeft,
  headerRight,
  placement = "bottom",
  dragToClose,
  onBackdropPress,
  children,
}: SheetProps) {
  const { mounted, progress } = useSheet(visible);
  const drag = useDragToClose(onBackdropPress ?? onClose);
  if (!mounted) return null;

  const isBottom = placement === "bottom";
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [isBottom ? 600 : 24, 0],
  });
  const hasHeader = !!(title || headerLeft || headerRight);

  return (
    <View
      style={[UI.fill, styles.overlay, isBottom ? styles.alignBottom : styles.alignCenter]}
      pointerEvents="box-none"
    >
      <Animated.View style={[UI.fill, styles.backdrop, { opacity: progress }]}>
        <Pressable style={UI.fill} onPress={onBackdropPress ?? onClose} />
      </Animated.View>

      <Animated.View
        style={[
          isBottom ? styles.bottomSheet : styles.dialog,
          {
            opacity: isBottom ? 1 : progress,
            transform: [
              { translateY },
              ...(dragToClose && isBottom ? [{ translateY: drag.dragOffset }] : []),
            ],
          },
        ]}
        {...(dragToClose && isBottom ? drag.panHandlers : {})}
      >
        {hasHeader ? (
          <View style={styles.header}>
            {headerLeft}
            <View style={styles.titles}>
              {title ? <Text style={TYPE.heading}>{title}</Text> : null}
              {subtitle ? <Text style={[TYPE.caption, styles.subtitle]}>{subtitle}</Text> : null}
            </View>
            {headerRight}
          </View>
        ) : null}
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 10000 },
  alignBottom: { justifyContent: "flex-end" },
  alignCenter: { justifyContent: "center", paddingHorizontal: SPACE.xl },
  backdrop: { backgroundColor: SURFACE.backdrop },
  bottomSheet: {
    backgroundColor: COLORS.CARD_BG,
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    paddingBottom: SPACE.xxxl + SPACE.sm,
    maxHeight: "85%",
  },
  dialog: {
    backgroundColor: COLORS.CARD_BG,
    borderRadius: RADIUS.sheet,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: SPACE.xl,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingHorizontal: SPACE.xl,
    paddingTop: SPACE.xl,
    paddingBottom: SPACE.lg,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE.hairline,
  },
  titles: { flex: 1 },
  subtitle: { marginTop: SPACE.xs },
});
