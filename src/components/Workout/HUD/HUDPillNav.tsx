import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Menu, X, Check, ChevronLeft, ChevronRight } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";

interface HUDPillNavProps {
  activeIndex: number;
  totalExercises: number;
  onMenuPress: () => void;
  onDiscardPress: () => void;
  onFinishPress: () => void;
  onPrevPress: () => void;
  onNextPress: () => void;
}

export const HUDPillNav = React.memo(({
  activeIndex,
  totalExercises,
  onMenuPress,
  onDiscardPress,
  onFinishPress,
  onPrevPress,
  onNextPress,
}: HUDPillNavProps) => {
  return (
    <View style={[UI.SHARED.hudPill, styles.pillNav]}>
      <Pressable style={UI.SHARED.iconBtn} onPress={onMenuPress}>
        <Menu size={20} color={COLORS.TEXT_PRIMARY} />
      </Pressable>

      <Pressable style={UI.SHARED.dangerBtn} onPress={onDiscardPress}>
        <X size={20} color={COLORS.DANGER} strokeWidth={3} />
      </Pressable>

      <View style={styles.pillPagination}>
        <Pressable onPress={onPrevPress} disabled={activeIndex <= 0}>
          <ChevronLeft size={24} color={activeIndex <= 0 ? COLORS.TEXT_TERTIARY : COLORS.TEXT_PRIMARY} />
        </Pressable>
        <Text style={styles.paginationText}>{activeIndex + 1} / {totalExercises || 1}</Text>
        <Pressable onPress={onNextPress} disabled={activeIndex >= totalExercises - 1}>
          <ChevronRight size={24} color={(activeIndex >= totalExercises - 1) ? COLORS.TEXT_TERTIARY : COLORS.TEXT_PRIMARY} />
        </Pressable>
      </View>

      <Pressable style={UI.SHARED.actionBtn} onPress={onFinishPress}>
        <Check size={20} color={COLORS.ACCENT_GREEN} strokeWidth={3} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  pillNav: { position: "absolute", bottom: 40, left: 20, right: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  pillPagination: { flexDirection: "row", alignItems: "center", gap: 12 },
  paginationText: { color: COLORS.TEXT_PRIMARY, fontSize: 14, fontFamily: FONT_FAMILIES.MONO, fontWeight: "700", minWidth: 50, textAlign: "center" },
});
