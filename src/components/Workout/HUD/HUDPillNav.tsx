import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Menu, X, Check, ChevronLeft, ChevronRight, LayoutPanelTop } from "lucide-react-native";
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
        <LayoutPanelTop size={20} color={COLORS.TEXT_PRIMARY} />
      </Pressable>

      <Pressable style={UI.SHARED.dangerBtn} onPress={onDiscardPress}>
        <X size={20} color={COLORS.DANGER} strokeWidth={3} />
      </Pressable>

      <View style={styles.pillPaginationContainer}>
        <Text style={styles.modeLabel}>MODE: LIVE_TRAINING</Text>
        <View style={styles.pillPagination}>
            <Pressable onPress={onPrevPress} disabled={activeIndex <= 0} hitSlop={12}>
                <ChevronLeft size={20} color={activeIndex <= 0 ? COLORS.TEXT_TERTIARY : COLORS.TEXT_PRIMARY} />
            </Pressable>
            <View style={styles.readout}>
                <Text style={styles.paginationText}>
                    {(activeIndex + 1).toString().padStart(2, '0')}
                    <Text style={{ color: COLORS.TEXT_TERTIARY }}> / </Text>
                    {(totalExercises || 1).toString().padStart(2, '0')}
                </Text>
            </View>
            <Pressable onPress={onNextPress} disabled={activeIndex >= totalExercises - 1} hitSlop={12}>
                <ChevronRight size={20} color={(activeIndex >= totalExercises - 1) ? COLORS.TEXT_TERTIARY : COLORS.TEXT_PRIMARY} />
            </Pressable>
        </View>
      </View>

      <Pressable style={UI.SHARED.actionBtn} onPress={onFinishPress}>
        <Check size={20} color={COLORS.ACCENT_GREEN} strokeWidth={3} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  pillNav: { position: "absolute", bottom: 40, left: 20, right: 20, height: 72, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10, backgroundColor: 'rgba(12, 12, 12, 0.95)', paddingHorizontal: 12 },
  pillPaginationContainer: { alignItems: "center", gap: 4 },
  modeLabel: { color: COLORS.ACCENT_BLUE, fontSize: 8, fontFamily: FONT_FAMILIES.MONO, fontWeight: "800", opacity: 0.8 },
  pillPagination: { flexDirection: "row", alignItems: "center", gap: 8 },
  readout: { backgroundColor: 'rgba(255, 255, 255, 0.03)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' },
  paginationText: { color: COLORS.TEXT_PRIMARY, fontSize: 13, fontFamily: FONT_FAMILIES.MONO, fontWeight: "700", textAlign: "center", minWidth: 40 },
});
