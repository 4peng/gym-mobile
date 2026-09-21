import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS, RADIUS, SPACE, TYPE, UI } from "@/constants/theme";

interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Compact height for inline use (unit toggles). */
  compact?: boolean;
}

/** Single-choice pill group. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  compact,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.track}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              compact ? styles.segmentCompact : styles.segmentRegular,
              active && styles.segmentActive,
              pressed && UI.pressed,
            ]}
          >
            <Text style={[compact ? TYPE.monoSmall : TYPE.body, active && styles.textActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: COLORS.CARD_BG,
    borderRadius: RADIUS.item,
    padding: SPACE.xs,
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
  },
  segment: { borderRadius: RADIUS.sm + 2, justifyContent: "center", alignItems: "center" },
  segmentRegular: { flex: 1, height: 40 },
  segmentCompact: { paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs + 2 },
  segmentActive: { backgroundColor: COLORS.BORDER },
  textActive: { color: COLORS.TEXT_PRIMARY },
});
