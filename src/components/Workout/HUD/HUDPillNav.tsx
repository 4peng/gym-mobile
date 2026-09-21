import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check, ChevronLeft, ChevronRight, Menu, X } from "lucide-react-native";
import { COLORS, LAYOUT, SPACE, TYPE, UI } from "@/constants/theme";
import { IconButton } from "@/components/ui/IconButton";

interface HUDPillNavProps {
  activeIndex: number;
  totalExercises: number;
  onMenuPress: () => void;
  onDiscardPress: () => void;
  onFinishPress: () => void;
  onPrevPress: () => void;
  onNextPress: () => void;
}

/** Floating bottom bar of the live workout: menu, discard, pager, finish. */
export const HUDPillNav = React.memo(function HUDPillNav({
  activeIndex,
  totalExercises,
  onMenuPress,
  onDiscardPress,
  onFinishPress,
  onPrevPress,
  onNextPress,
}: HUDPillNavProps) {
  const atStart = activeIndex <= 0;
  const atEnd = activeIndex >= totalExercises - 1;
  return (
    <View style={[UI.hudPill, UI.shadow, styles.pill]}>
      <IconButton onPress={onMenuPress}>
        <Menu size={20} color={COLORS.TEXT_PRIMARY} />
      </IconButton>
      <IconButton tone="danger" onPress={onDiscardPress}>
        <X size={20} color={COLORS.DANGER} strokeWidth={3} />
      </IconButton>

      <View style={styles.pager}>
        <Pressable onPress={onPrevPress} disabled={atStart} hitSlop={8}>
          <ChevronLeft size={24} color={atStart ? COLORS.TEXT_TERTIARY : COLORS.TEXT_PRIMARY} />
        </Pressable>
        <Text style={styles.pagerText}>
          {activeIndex + 1} / {totalExercises || 1}
        </Text>
        <Pressable onPress={onNextPress} disabled={atEnd} hitSlop={8}>
          <ChevronRight size={24} color={atEnd ? COLORS.TEXT_TERTIARY : COLORS.TEXT_PRIMARY} />
        </Pressable>
      </View>

      <IconButton tone="success" onPress={onFinishPress}>
        <Check size={20} color={COLORS.ACCENT_GREEN} strokeWidth={3} />
      </IconButton>
    </View>
  );
});

const styles = StyleSheet.create({
  pill: {
    position: "absolute",
    bottom: SPACE.xxxl + SPACE.sm,
    left: LAYOUT.gutter + SPACE.xs,
    right: LAYOUT.gutter + SPACE.xs,
  },
  pager: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  pagerText: { ...TYPE.mono, minWidth: 50, textAlign: "center" },
});
