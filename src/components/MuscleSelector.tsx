import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";
import { COLORS, SPACE, SURFACE, TYPE, UI } from "@/constants/theme";
import {
  collapseDetailedMusclesToPrimary,
  DETAILED_MODE_MUSCLE_GROUPS,
  DETAILED_MUSCLE_GROUPS,
  expandPrimaryMusclesForDetailedMode,
  MUSCLE_LABELS,
  MuscleGroup,
  PRIMARY_MUSCLE_GROUPS,
} from "@/constants/muscles";
import { useUiPreferencesStore } from "@/stores/uiPreferencesStore";
import { HapticFeedback } from "@/utils/haptics";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const MODES = [
  { value: "simple", label: "Simple" },
  { value: "detailed", label: "Detailed" },
] as const;

interface MuscleSelectorProps {
  visible: boolean;
  onClose: () => void;
  selectedMuscles: MuscleGroup[];
  /** Called with the draft selection whenever the sheet closes. */
  onSelect: (muscles: MuscleGroup[]) => void;
  label?: string;
}

const DETAILED_SET = new Set<MuscleGroup>(DETAILED_MUSCLE_GROUPS);

/** Multi-select muscle picker with a simple/detailed toggle. Applies on close. */
export default function MuscleSelector({
  visible,
  onClose,
  selectedMuscles,
  onSelect,
  label = "Targeted muscles",
}: MuscleSelectorProps) {
  const [draft, setDraft] = useState<MuscleGroup[]>([]);
  const showDetailed = useUiPreferencesStore((s) => s.showDetailedMuscleGroups);
  const toggleDetailed = useUiPreferencesStore((s) => s.toggleDetailedMuscleGroups);

  const normalizedSelected = useMemo(
    () => (showDetailed ? expandPrimaryMusclesForDetailedMode(selectedMuscles) : selectedMuscles),
    [showDetailed, selectedMuscles],
  );

  // In simple mode, already-selected detailed muscles stay visible so they can be unticked.
  const available: readonly MuscleGroup[] = showDetailed
    ? DETAILED_MODE_MUSCLE_GROUPS
    : Array.from(
        new Set([...PRIMARY_MUSCLE_GROUPS, ...selectedMuscles.filter((m) => DETAILED_SET.has(m))]),
      );

  // Seed the draft only on the closed→open transition so toggling
  // simple/detailed while open doesn't discard in-progress edits.
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) setDraft(normalizedSelected);
    wasVisible.current = visible;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const applyAndClose = () => {
    onSelect(draft);
    onClose();
  };

  const toggleMuscle = (m: MuscleGroup) =>
    setDraft((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const handleToggleDetailed = () => {
    setDraft((prev) =>
      showDetailed
        ? collapseDetailedMusclesToPrimary(prev)
        : expandPrimaryMusclesForDetailedMode(prev),
    );
    toggleDetailed();
    HapticFeedback.selection();
  };

  return (
    <Sheet
      visible={visible}
      onClose={applyAndClose}
      dragToClose
      title={label}
      closeButton
      footer={
        <Button
          label="Done"
          tone="primary"
          variant="filled"
          onPress={applyAndClose}
          style={styles.action}
        />
      }
    >
      <View style={styles.modeToggle}>
        <SegmentedControl
          compact
          options={MODES}
          value={showDetailed ? "detailed" : "simple"}
          onChange={(mode) => {
            if ((mode === "detailed") !== showDetailed) handleToggleDetailed();
          }}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {available.map((m) => {
          const active = draft.includes(m);
          return (
            <Pressable
              key={m}
              onPress={() => toggleMuscle(m)}
              style={({ pressed }) => [
                UI.inset,
                styles.item,
                active && styles.itemActive,
                pressed && UI.pressed,
              ]}
            >
              <Text style={[TYPE.body, !active && { color: COLORS.TEXT_SECONDARY }]}>
                {MUSCLE_LABELS[m]}
              </Text>
              {active && <Check size={18} color={COLORS.ACCENT_BLUE} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  modeToggle: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.md },
  list: { padding: SPACE.lg, gap: SPACE.sm },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACE.lg,
    paddingHorizontal: SPACE.xl,
  },
  itemActive: { backgroundColor: SURFACE.blueTint, borderColor: SURFACE.blueBorder },
  action: { flex: 1 },
});
