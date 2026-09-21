import React from "react";
import { StyleSheet, View } from "react-native";
import { ArrowUpDown, Check, Plus, X } from "lucide-react-native";
import { COLORS, LAYOUT, SPACE, UI } from "@/constants/theme";
import { IconButton } from "@/components/ui/IconButton";

interface HUDBarProps {
  canReorder: boolean;
  onAddPress: () => void;
  onReorderPress: () => void;
  onDiscardPress: () => void;
  onFinishPress: () => void;
}

/** Floating bottom bar of the live workout: add, reorder | discard, finish. */
export const HUDBar = React.memo(function HUDBar({
  canReorder,
  onAddPress,
  onReorderPress,
  onDiscardPress,
  onFinishPress,
}: HUDBarProps) {
  return (
    <View style={[UI.hudBar, UI.shadow, styles.bar]}>
      <View style={styles.group}>
        <IconButton tone="primary" onPress={onAddPress}>
          <Plus size={20} color={COLORS.ACCENT_BLUE} />
        </IconButton>
        <IconButton onPress={onReorderPress} disabled={!canReorder}>
          <ArrowUpDown size={20} color={COLORS.TEXT_PRIMARY} />
        </IconButton>
      </View>
      <View style={styles.group}>
        <IconButton tone="danger" onPress={onDiscardPress}>
          <X size={20} color={COLORS.DANGER} strokeWidth={3} />
        </IconButton>
        <IconButton tone="success" onPress={onFinishPress}>
          <Check size={20} color={COLORS.ACCENT_GREEN} strokeWidth={3} />
        </IconButton>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    bottom: SPACE.xxxl + SPACE.sm,
    left: LAYOUT.gutter,
    right: LAYOUT.gutter,
  },
  group: { flexDirection: "row", gap: SPACE.sm },
});
