import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Animated } from "react-native";
import { Check, Activity } from "lucide-react-native";
import { COLORS } from "@/constants/colors";
import { FONT_FAMILIES } from "@/constants/fonts";
import { UI } from "@/constants/ui";
import {
  expandPrimaryMusclesForDetailedMode,
  collapseDetailedMusclesToPrimary,
  DETAILED_MODE_MUSCLE_GROUPS,
  DETAILED_MUSCLE_GROUPS,
  MUSCLE_LABELS,
  PRIMARY_MUSCLE_GROUPS,
  MuscleGroup,
} from "@/constants/muscles";
import { useUiPreferencesStore } from "@/stores/uiPreferencesStore";
import { HapticFeedback } from "@/utils/haptics";
import { useDragToClose, useSheet } from "@/hooks/useSheet";

interface MuscleSelectorProps {
  visible: boolean;
  onClose: () => void;
  selectedMuscles: MuscleGroup[];
  /** Called with the draft selection whenever the sheet closes. */
  onSelect: (muscles: MuscleGroup[]) => void;
  label?: string;
}

const DETAILED_SET = new Set<MuscleGroup>(DETAILED_MUSCLE_GROUPS);

export default function MuscleSelector({
  visible,
  onClose,
  selectedMuscles,
  onSelect,
  label = "Targeted Muscles",
}: MuscleSelectorProps) {
  const [draft, setDraft] = useState<MuscleGroup[]>([]);
  const showDetailed = useUiPreferencesStore((s) => s.showDetailedMuscleGroups);
  const toggleDetailed = useUiPreferencesStore((s) => s.toggleDetailedMuscleGroups);

  const normalizedSelected = useMemo(
    () => (showDetailed ? expandPrimaryMusclesForDetailedMode(selectedMuscles) : selectedMuscles),
    [showDetailed, selectedMuscles],
  );

  // In simple mode, keep any already-selected detailed muscles visible so they can be unticked.
  const availableMuscles: readonly MuscleGroup[] = showDetailed
    ? DETAILED_MODE_MUSCLE_GROUPS
    : Array.from(new Set([...PRIMARY_MUSCLE_GROUPS, ...selectedMuscles.filter((m) => DETAILED_SET.has(m))]));

  const applyAndClose = () => {
    onSelect(draft);
    onClose();
  };

  // Seed the draft only on the closed→open transition so toggling
  // Simple/Detailed while open doesn't discard in-progress edits.
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) setDraft(normalizedSelected);
    wasVisible.current = visible;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const { mounted, progress } = useSheet(visible);
  const { dragOffset, panHandlers } = useDragToClose(applyAndClose);
  if (!mounted) return null;

  const toggleMuscle = (muscle: MuscleGroup) =>
    setDraft((prev) => (prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle]));

  const handleToggleDetailed = () => {
    setDraft((prev) => (showDetailed ? collapseDetailedMusclesToPrimary(prev) : expandPrimaryMusclesForDetailedMode(prev)));
    toggleDetailed();
    HapticFeedback.selection();
  };

  return (
    <View style={styles.absoluteOverlay} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.85] }) }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={applyAndClose} />
      </Animated.View>
      <Animated.View
        style={[
          styles.container,
          {
            transform: [
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) },
              { translateY: dragOffset },
            ],
          },
        ]}
        {...panHandlers}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{label}</Text>
            <Pressable onPress={handleToggleDetailed} style={styles.detailedToggle}>
              <Activity size={12} color={showDetailed ? COLORS.ACCENT_BLUE : COLORS.TEXT_TERTIARY} />
              <Text style={[styles.detailedToggleText, showDetailed && { color: COLORS.ACCENT_BLUE }]}>
                {showDetailed ? "DETAILED MODE" : "SIMPLE MODE"}
              </Text>
            </Pressable>
          </View>
          <Pressable onPress={applyAndClose} style={styles.closeBtn}>
            <Check size={24} color={COLORS.ACCENT_GREEN} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {availableMuscles.map((m) => {
            const isActive = draft.includes(m);
            return (
              <Pressable key={m} onPress={() => toggleMuscle(m)} style={[styles.item, isActive && styles.itemActive]}>
                <Text style={[styles.itemText, isActive && styles.itemTextActive]}>{MUSCLE_LABELS[m]}</Text>
                {isActive && <Check size={18} color={COLORS.ACCENT_BLUE} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  absoluteOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 10000, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,1)" },
  container: {
    backgroundColor: COLORS.CARD_BG,
    borderTopLeftRadius: UI.RADIUS_HUD,
    borderTopRightRadius: UI.RADIUS_HUD,
    paddingBottom: 40,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  detailedToggle: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  detailedToggleText: {
    color: COLORS.TEXT_TERTIARY,
    fontSize: 10,
    fontWeight: "800",
    fontFamily: FONT_FAMILIES.MONO,
    letterSpacing: 0.5,
  },
  title: { color: COLORS.TEXT_PRIMARY, fontSize: 18, fontWeight: "800", fontFamily: FONT_FAMILIES.MEDIUM },
  closeBtn: { padding: 4 },
  scrollContent: { padding: 16, gap: 8 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: UI.RADIUS_CONTAINER,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
  },
  itemActive: { backgroundColor: "rgba(11, 130, 255, 0.08)", borderColor: "rgba(11, 130, 255, 0.2)" },
  itemText: { color: COLORS.TEXT_SECONDARY, fontSize: 16, fontWeight: "700", fontFamily: FONT_FAMILIES.MEDIUM },
  itemTextActive: { color: COLORS.TEXT_PRIMARY },
});
